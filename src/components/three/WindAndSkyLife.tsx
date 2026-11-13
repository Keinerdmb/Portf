import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import type { OceanParams } from '../../types/portfolio';

interface WindAndSkyLifeProps {
  shipPosRef: React.RefObject<{ x: number; z: number }>;
  oceanParamsRef: React.RefObject<OceanParams>;
}

const WIND_COUNT = 22;

const STREAKS_META = Array.from({ length: WIND_COUNT }, (_, i) => ({
  y: 2.2 + (i % 5) * 1.4,
  len: 2.5 + (i % 3) * 1.4,
  speedOffset: 0.8 + (i % 4) * 0.2,
}));

export function WindAndSkyLife({ shipPosRef, oceanParamsRef }: WindAndSkyLifeProps) {
  const streakRefs = useRef<(THREE.Mesh | null)[]>([]);
  const birdGroupsRef = useRef<(THREE.Group | null)[]>([]);
  const leftWingsRef = useRef<(THREE.Mesh | null)[]>([]);
  const rightWingsRef = useRef<(THREE.Mesh | null)[]>([]);

  const streakOffsetsRef = useRef(
    Array.from({ length: WIND_COUNT }, (_, i) => ({
      ox: Math.sin(i * 19.3) * 0.5 * 90,
      oz: Math.cos(i * 7.7) * 0.5 * 90,
    }))
  );

  // Bandadas de gaviotas low-poly sobrevolando cerca de las islas
  const birdsData = useMemo(
    () =>
      ISLANDS.flatMap((island, iIdx) =>
        [0, 1].map((bIdx) => ({
          cx: island.position[0],
          cz: island.position[1],
          radius: 11 + bIdx * 4,
          height: 12 + (iIdx % 2) * 2.5 + bIdx * 1.5,
          speed: 0.35 + bIdx * 0.1,
          phase: iIdx * 1.7 + bIdx * 2.4,
        }))
      ),
    []
  );

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.getElapsedTime();
    const params = oceanParamsRef.current;

    const sinW = Math.sin(params.currentAngle);
    const cosW = Math.cos(params.currentAngle);
    const sx = shipPosRef.current.x;
    const sz = shipPosRef.current.z;

    // Ráfagas visibles de viento viajando alrededor del barco
    for (let i = 0; i < STREAKS_META.length; i += 1) {
      const meta = STREAKS_META[i];
      const pos = streakOffsetsRef.current[i];
      const mesh = streakRefs.current[i];
      if (!mesh) continue;

      const travel = params.windSpeed * 1.45 * meta.speedOffset * dt;
      pos.ox += sinW * travel;
      pos.oz -= cosW * travel;

      if (pos.ox > 55) pos.ox -= 110;
      if (pos.ox < -55) pos.ox += 110;
      if (pos.oz > 55) pos.oz -= 110;
      if (pos.oz < -55) pos.oz += 110;

      mesh.position.set(sx + pos.ox, meta.y, sz + pos.oz);
      mesh.rotation.y = -params.currentAngle;
    }

    // Gaviotas planeando y batiendo alas suavemente
    for (let i = 0; i < birdsData.length; i += 1) {
      const b = birdsData[i];
      const grp = birdGroupsRef.current[i];
      if (!grp) continue;

      const ang = t * b.speed + b.phase;
      const bx = b.cx + Math.cos(ang) * b.radius;
      const bz = b.cz + Math.sin(ang) * b.radius;
      const by = b.height + Math.sin(t * 2 + b.phase) * 0.5;

      grp.position.set(bx, by, bz);
      grp.rotation.y = -ang;

      const flap = Math.sin(t * 7.5 + b.phase * 3) * 0.45;
      const lw = leftWingsRef.current[i];
      const rw = rightWingsRef.current[i];
      if (lw) lw.rotation.z = flap;
      if (rw) rw.rotation.z = -flap;
    }
  });

  return (
    <group>
      {/* Líneas de viento estilizadas */}
      {STREAKS_META.map((s, idx) => (
        <mesh
          key={`wind-${idx}`}
          ref={(el) => {
            streakRefs.current[idx] = el;
          }}
        >
          <boxGeometry args={[0.04, 0.04, s.len]} />
          <meshBasicMaterial color="#fff8e7" transparent opacity={0.28} />
        </mesh>
      ))}

      {/* Gaviotas estilizadas */}
      {birdsData.map((_, idx) => (
        <group
          key={`bird-${idx}`}
          ref={(el) => {
            birdGroupsRef.current[idx] = el;
          }}
        >
          <mesh
            ref={(el) => {
              leftWingsRef.current[idx] = el;
            }}
            position={[-0.25, 0, 0]}
          >
            <boxGeometry args={[0.5, 0.05, 0.16]} />
            <meshBasicMaterial color="#fef3c7" />
          </mesh>
          <mesh
            ref={(el) => {
              rightWingsRef.current[idx] = el;
            }}
            position={[0.25, 0, 0]}
          >
            <boxGeometry args={[0.5, 0.05, 0.16]} />
            <meshBasicMaterial color="#fef3c7" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
