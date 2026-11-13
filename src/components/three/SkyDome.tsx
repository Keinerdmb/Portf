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
  uniform float uTime;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = clamp(dir.y, -0.1, 1.0);

    // Atardecer cálido durazno-dorado -> lavanda suave -> azul crepuscular
    vec3 horizonColor = vec3(0.96, 0.77, 0.50);
    vec3 midColor     = vec3(0.81, 0.56, 0.50);
    vec3 zenithColor  = vec3(0.30, 0.35, 0.50);

    vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
    col = mix(col, zenithColor, smoothstep(0.18, 0.72, h));

    // Bandas suaves de nubes en el horizonte (sin geometría extra)
    float az = atan(dir.x, -dir.z);
    float cloudWave1 = sin(az * 4.0 + uTime * 0.02) * 0.5 + sin(az * 9.0 - uTime * 0.015) * 0.5;
    float cloudBand1 = smoothstep(0.03, 0.14, h) * (1.0 - smoothstep(0.12, 0.28, h));
    float cloudMask = smoothstep(-0.1, 0.65, cloudWave1) * cloudBand1;
    col = mix(col, vec3(0.95, 0.72, 0.56), cloudMask * 0.42);

    float cloudWave2 = cos(az * 6.0 - uTime * 0.018) * 0.5 + sin(az * 13.0) * 0.5;
    float cloudBand2 = smoothstep(0.14, 0.26, h) * (1.0 - smoothstep(0.26, 0.44, h));
    col = mix(col, vec3(0.70, 0.55, 0.62), smoothstep(0.0, 0.7, cloudWave2) * cloudBand2 * 0.35);

    // Halo dorado alrededor del sol
    float sunGlow = max(dot(dir, normalize(uSunDir)), 0.0);
    col += vec3(1.0, 0.80, 0.46) * pow(sunGlow, 8.0) * 0.48;
    col += vec3(1.0, 0.95, 0.78) * pow(sunGlow, 48.0) * 0.55;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function SkyDome() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uSunDir: { value: new THREE.Vector3(-0.14, 0.07, -1).normalize() },
      uTime: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[285, 24, 16]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={SKY_VERTEX_SHADER}
          fragmentShader={SKY_FRAGMENT_SHADER}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Sol dorado bajo en el horizonte */}
      <mesh position={[-32, 15, -230]}>
        <circleGeometry args={[17, 28]} />
        <meshBasicMaterial color="#fff7d6" fog={false} />
      </mesh>
      <mesh position={[-32, 15, -232]}>
        <circleGeometry args={[28, 28]} />
        <meshBasicMaterial color="#ffd180" transparent opacity={0.32} fog={false} />
      </mesh>
    </group>
  );
}
