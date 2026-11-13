import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ATARDECER_PALETTE } from '../../data/palette';

const SKY_VERTEX_SHADER = `
  varying vec3 vLocalDir;
  void main() {
    vLocalDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = `
  varying vec3 vLocalDir;
  uniform vec3 uSunDir;

  void main() {
    vec3 dir = normalize(vLocalDir);
    float h = clamp(dir.y, -0.15, 1.0);

    // Paleta de paleta/atardecer.jpg:
    // Horizonte rosa polvo -> durazno -> melocotón crema -> malva suave en el cenit
    vec3 belowHorizon = vec3(0.945, 0.761, 0.698);
    vec3 horizonColor = vec3(0.969, 0.816, 0.702);
    vec3 apricotBand  = vec3(1.000, 0.875, 0.722);
    vec3 creamBand    = vec3(1.000, 0.949, 0.776);
    vec3 zenithColor  = vec3(0.576, 0.486, 0.569);

    vec3 col = mix(belowHorizon, horizonColor, smoothstep(-0.08, 0.05, h));
    col = mix(col, apricotBand, smoothstep(0.04, 0.24, h));
    col = mix(col, creamBand, smoothstep(0.20, 0.48, h));
    col = mix(col, zenithColor, smoothstep(0.45, 0.92, h));

    // Sol luminoso integrado suavemente en el horizonte
    float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
    float sunDisc = smoothstep(0.9965, 0.9982, sunDot);
    float innerGlow = pow(sunDot, 26.0) * 0.48;
    float outerGlow = pow(sunDot, 5.0) * 0.30;

    col += vec3(1.00, 0.875, 0.702) * outerGlow;
    col += vec3(1.00, 0.949, 0.816) * innerGlow;
    col = mix(col, vec3(1.0, 1.0, 1.0), sunDisc);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface CloudSpec {
  angle: number;
  distance: number;
  height: number;
  scale: number;
  speed: number;
}

const CLOUD_SPECS: CloudSpec[] = [
  { angle: 0.15, distance: 175, height: 32, scale: 1.4, speed: 0.004 },
  { angle: 0.62, distance: 195, height: 42, scale: 1.8, speed: 0.003 },
  { angle: 1.15, distance: 165, height: 28, scale: 1.2, speed: 0.005 },
  { angle: 1.72, distance: 205, height: 48, scale: 2.0, speed: 0.0028 },
  { angle: 2.28, distance: 180, height: 35, scale: 1.5, speed: 0.0035 },
  { angle: 2.85, distance: 190, height: 38, scale: 1.6, speed: 0.0042 },
  { angle: 3.45, distance: 170, height: 30, scale: 1.3, speed: 0.0046 },
  { angle: 4.02, distance: 200, height: 45, scale: 1.9, speed: 0.0031 },
  { angle: 4.65, distance: 185, height: 36, scale: 1.5, speed: 0.0038 },
  { angle: 5.22, distance: 175, height: 31, scale: 1.35, speed: 0.0044 },
  { angle: 5.78, distance: 195, height: 40, scale: 1.7, speed: 0.0033 },
  { angle: -0.25, distance: 210, height: 54, scale: 2.1, speed: 0.0025 },
];

/**
 * Nube esponjosa de paleta/atardecer.jpg (copos crema-albaricoque + base rosa-durazno).
 */
function StylizedCloud({
  spec,
  setGroupRef,
}: {
  spec: CloudSpec;
  setGroupRef: (el: THREE.Group | null) => void;
}) {
  return (
    <group ref={setGroupRef} scale={spec.scale}>
      {/* Sombra inferior rosada-durazno */}
      <mesh position={[0, -0.8, 0]} scale={[7.2, 2.2, 3.6]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={ATARDECER_PALETTE.cloudWarmShadow} fog={false} />
      </mesh>
      {/* Copo central crema cálido */}
      <mesh position={[0, 1.0, 0]} scale={[4.8, 3.1, 3.2]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={ATARDECER_PALETTE.cloudCream} fog={false} />
      </mesh>
      {/* Copo izquierdo melocotón */}
      <mesh position={[-4.2, 0.2, 0.3]} scale={[3.4, 2.3, 2.5]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={ATARDECER_PALETTE.cloudApricot} fog={false} />
      </mesh>
      {/* Copo derecho crema dorado */}
      <mesh position={[4.5, 0.35, -0.2]} scale={[3.8, 2.5, 2.7]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={ATARDECER_PALETTE.cloudCream} fog={false} />
      </mesh>
    </group>
  );
}

export function SkyDome() {
  const { camera } = useThree();
  const skyGroupRef = useRef<THREE.Group>(null);
  const cloudRefs = useRef<(THREE.Group | null)[]>([]);
  const anglesRef = useRef<number[]>(CLOUD_SPECS.map((c) => c.angle));

  const uniforms = useMemo(
    () => ({
      uSunDir: { value: new THREE.Vector3(-0.18, 0.14, -1).normalize() },
    }),
    []
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);

    // El domo del cielo SIEMPRE sigue la posición de la cámara para que nunca se deforme ni se recorte
    if (skyGroupRef.current) {
      skyGroupRef.current.position.copy(camera.position);
    }

    for (let i = 0; i < CLOUD_SPECS.length; i += 1) {
      const spec = CLOUD_SPECS[i];
      const grp = cloudRefs.current[i];
      if (!grp) continue;

      anglesRef.current[i] += spec.speed * dt;
      const a = anglesRef.current[i];
      grp.position.set(
        Math.sin(a) * spec.distance,
        spec.height - camera.position.y * 0.2,
        -Math.cos(a) * spec.distance
      );
      grp.rotation.y = -a;
    }
  });

  return (
    <group ref={skyGroupRef}>
      <mesh renderOrder={-2}>
        <sphereGeometry args={[520, 28, 18]} />
        <shaderMaterial
          vertexShader={SKY_VERTEX_SHADER}
          fragmentShader={SKY_FRAGMENT_SHADER}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {CLOUD_SPECS.map((spec, idx) => (
        <StylizedCloud
          key={idx}
          spec={spec}
          setGroupRef={(el) => {
            cloudRefs.current[idx] = el;
          }}
        />
      ))}
    </group>
  );
}
