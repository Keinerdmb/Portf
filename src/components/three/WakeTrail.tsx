import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { OceanParams, ShipTelemetry } from '../../types/portfolio';
import { sampleGerstnerSurface } from '../../utils/oceanMath';

interface WakeTrailProps {
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  oceanParamsRef: React.RefObject<OceanParams>;
}

const FOAM_COUNT = 24;

interface FoamNode {
  x: number;
  z: number;
  age: number;
  life: number;
}

export function WakeTrail({ shipTelemetryRef, oceanParamsRef }: WakeTrailProps) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const nodesRef = useRef<FoamNode[]>(
    Array.from({ length: FOAM_COUNT }, () => ({ x: 0, z: 0, age: 10, life: 1 }))
  );
  const spawnAccumRef = useRef(0);
  const cursorRef = useRef(0);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.getElapsedTime();
    const ship = shipTelemetryRef.current;
    const params = oceanParamsRef.current;
    const speedAbs = Math.abs(ship.speed);

    if (speedAbs > 1.2) {
      spawnAccumRef.current += dt * (4.5 + speedAbs * 0.45);
      while (spawnAccumRef.current >= 1) {
        spawnAccumRef.current -= 1;
        const idx = cursorRef.current % FOAM_COUNT;
        cursorRef.current += 1;

        const sternDist = 3.2;
        const jitter = (Math.random() - 0.5) * 1.1;
        const sinH = Math.sin(ship.heading);
        const cosH = Math.cos(ship.heading);

        nodesRef.current[idx] = {
          x: ship.x + sinH * sternDist + cosH * jitter,
          z: ship.z + cosH * sternDist - sinH * jitter,
          age: 0,
          life: 1.35,
        };
      }
    }

    for (let i = 0; i < FOAM_COUNT; i += 1) {
      const node = nodesRef.current[i];
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      node.age += dt;
      if (node.age >= node.life) {
        mesh.visible = false;
        continue;
      }

      const progress = node.age / node.life;
      const sample = sampleGerstnerSurface(node.x, node.z, t, params);
      const scale = 0.55 + progress * 1.6;

      mesh.visible = true;
      mesh.position.set(node.x, sample.height + 0.08, node.z);
      mesh.scale.set(scale, 1, scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - progress) * 0.62;
    }
  });

  return (
    <group>
      {Array.from({ length: FOAM_COUNT }).map((_, idx) => (
        <mesh
          key={idx}
          ref={(el) => {
            meshRefs.current[idx] = el;
          }}
          visible={false}
          rotation={[-Math.PI / 2, 0, Math.PI / 4]}
        >
          <planeGeometry args={[0.9, 0.9]} />
          <meshBasicMaterial color="#effcf9" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
