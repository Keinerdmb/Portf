import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SKY_FRAGMENT_SHADER = `
  varying vec3 vWorldPosition;
  uniform vec3 uSunDir;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = clamp(dir.y, -0.1, 1.0);

    // Degradado fiel al atardecer dorado -> durazno -> lavanda -> azul crepúsculo
    vec3 horizonColor = vec3(0.96, 0.72, 0.45);
    vec3 midColor     = vec3(0.76, 0.50, 0.49);
    vec3 zenithColor  = vec3(0.24, 0.30, 0.46);

    vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.24, h));
    col = mix(col, zenithColor, smoothstep(0.20, 0.75, h));

    // Halo cálido alrededor del sol en el horizonte
    float sunGlow = max(dot(dir, normalize(uSunDir)), 0.0);
    col += vec3(1.0, 0.76, 0.42) * pow(sunGlow, 10.0) * 0.45;
    col += vec3(1.0, 0.92, 0.75) * pow(sunGlow, 64.0) * 0.5;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const CLOUD_DATA = [
  { pos: [-80, 38, -160] as [number, number, number], scale: [18, 3.2, 6] as [number, number, number], speed: 0.5 },
  { pos: [25, 44, -185] as [number, number, number], scale: [24, 3.8, 7] as [number, number, number], speed: 0.35 },
  { pos: [110, 34, -140] as [number, number, number], scale: [16, 2.8, 5] as [number, number, number], speed: 0.45 },
  { pos: [-120, 42, -90] as [number, number, number], scale: [20, 3.2, 6] as [number, number, number], speed: 0.4 },
];

export function SkyDome() {
  const cloudsRef = useRef<(THREE.Mesh | null)[]>([]);

  const uniforms = useMemo(
    () => ({
      uSunDir: { value: new THREE.Vector3(-0.14, 0.08, -1).normalize() },
    }),
    []
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    cloudsRef.current.forEach((cloud, i) => {
      if (!cloud) return;
      cloud.position.x += CLOUD_DATA[i].speed * dt;
      if (cloud.position.x > 160) cloud.position.x = -160;
    });
  });

  return (
    <group>
      {/* Cúpula degradada de cielo */}
      <mesh>
        <sphereGeometry args={[280, 20, 14]} />
        <shaderMaterial
          vertexShader={SKY_VERTEX_SHADER}
          fragmentShader={SKY_FRAGMENT_SHADER}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Sol cálido en el horizonte */}
      <mesh position={[-32, 16, -230]}>
        <circleGeometry args={[18, 24]} />
        <meshBasicMaterial color="#fff3c4" fog={false} />
      </mesh>
      <mesh position={[-32, 16, -232]}>
        <circleGeometry args={[27, 24]} />
        <meshBasicMaterial color="#ffd180" transparent opacity={0.35} fog={false} />
      </mesh>

      {/* Nubes estilizadas low-poly desplazándose suave */}
      {CLOUD_DATA.map((c, idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            cloudsRef.current[idx] = el;
          }}
          position={c.pos}
          scale={c.scale}
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#f5cbb0" transparent opacity={0.5} fog={false} />
        </mesh>
      ))}
    </group>
  );
}
