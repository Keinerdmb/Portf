import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import type { IslandData, IslandId, QualityMode } from '../../types/portfolio';

interface IslandsProps {
  quality: QualityMode;
  nearbyIsland: IslandId | null;
  minigameActive: boolean;
  hitTargets: number[];
  onHitTarget: (idx: number) => void;
}

function IslandMesh({
  island,
  isNearby,
  quality,
}: {
  island: IslandData;
  isNearby: boolean;
  quality: QualityMode;
}) {
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (beaconRef.current) {
      const t = clock.getElapsedTime();
      beaconRef.current.position.y = 11.5 + Math.sin(t * 2.2) * 0.6;
      beaconRef.current.rotation.y = t * 1.4;
    }
  });

  return (
    <group position={[island.position[0], 0, island.position[1]]}>
      {/* Base de arena de la isla */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[10, 13.5, 2.2, 8]} />
        <meshStandardMaterial color="#e0b589" flatShading roughness={0.9} />
      </mesh>

      {/* Terreno elevado según el tipo de isla */}
      <mesh position={[-1, 2.3, 0.5]}>
        <dodecahedronGeometry
          args={[5.6, 0]}
        />
        <meshStandardMaterial
          color={island.landmark === 'skull' ? '#3f3749' : '#3a6b4c'}
          flatShading
          roughness={0.85}
        />
      </mesh>

      {/* Landmark único por cada isla */}
      {island.landmark === 'lighthouse' && (
        <group position={[2.5, 1.5, -1.5]}>
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[0.7, 1.15, 6.4, 7]} />
            <meshStandardMaterial color="#f1f5f9" flatShading />
          </mesh>
          <mesh position={[0, 6.6, 0]}>
            <cylinderGeometry args={[0.8, 0.8, 0.9, 7]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={2}
              flatShading
            />
          </mesh>
          <mesh position={[0, 7.6, 0]}>
            <coneGeometry args={[1.05, 1.2, 7]} />
            <meshStandardMaterial color="#b91c1c" flatShading />
          </mesh>
        </group>
      )}

      {island.landmark === 'treasure' && (
        <group position={[2.2, 1.6, 2.2]}>
          {/* Cofre del tesoro brillante */}
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[1.8, 1.1, 1.2]} />
            <meshStandardMaterial color="#78350f" flatShading />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[1.9, 0.25, 1.3]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#d97706"
              emissiveIntensity={1.2}
              flatShading
            />
          </mesh>
          {/* Palmeras */}
          <mesh position={[-4.5, 2.2, -3]} rotation={[0.1, 0, 0.15]}>
            <cylinderGeometry args={[0.2, 0.35, 4.5, 5]} />
            <meshStandardMaterial color="#6f4e37" flatShading />
          </mesh>
          <mesh position={[-4.8, 4.4, -3]}>
            <coneGeometry args={[1.8, 1.4, 5]} />
            <meshStandardMaterial color="#2d6a4f" flatShading />
          </mesh>
        </group>
      )}

      {island.landmark === 'observatory' && (
        <group position={[0, 4.5, 0]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[1.2, 1.6, 3.2, 6]} />
            <meshStandardMaterial color="#334155" flatShading />
          </mesh>
          <mesh position={[0, 3.6, 0]}>
            <octahedronGeometry args={[1.2, 0]} />
            <meshStandardMaterial
              color="#34d399"
              emissive="#10b981"
              emissiveIntensity={1.8}
              flatShading
            />
          </mesh>
        </group>
      )}

      {island.landmark === 'skull' && (
        <group position={[0, 4.8, 0]}>
          {/* Roca calavera estilizada */}
          <mesh position={[0, 1.4, 0]}>
            <dodecahedronGeometry args={[2.5, 0]} />
            <meshStandardMaterial color="#cbd5e1" flatShading />
          </mesh>
          <mesh position={[-0.75, 1.6, 1.9]}>
            <boxGeometry args={[0.6, 0.6, 0.4]} />
            <meshStandardMaterial
              color="#fb7185"
              emissive="#e11d48"
              emissiveIntensity={2.2}
              flatShading
            />
          </mesh>
          <mesh position={[0.75, 1.6, 1.9]}>
            <boxGeometry args={[0.6, 0.6, 0.4]} />
            <meshStandardMaterial
              color="#fb7185"
              emissive="#e11d48"
              emissiveIntensity={2.2}
              flatShading
            />
          </mesh>
        </group>
      )}

      {/* Baliza flotante encima de cada isla para verlas desde el horizonte */}
      <mesh ref={beaconRef} position={[0, 11.5, 0]}>
        <octahedronGeometry args={[isNearby ? 1.3 : 0.9, 0]} />
        <meshStandardMaterial
          color={island.accentColor}
          emissive={island.accentColor}
          emissiveIntensity={isNearby ? 2.6 : 1.5}
          flatShading
        />
      </mesh>

      {quality === 'high' && isNearby && (
        <pointLight
          position={[0, 6, 0]}
          color={island.accentColor}
          intensity={10}
          distance={30}
        />
      )}
    </group>
  );
}

const TARGET_OFFSETS: [number, number][] = [
  [-17, -10],
  [-16, 12],
  [18, -14],
  [16, 15],
];

export function Islands({
  quality,
  nearbyIsland,
  minigameActive,
  hitTargets,
  onHitTarget,
}: IslandsProps) {
  const skullIsland = ISLANDS.find((i) => i.id === 'minigame');

  return (
    <group>
      {ISLANDS.map((island) => (
        <IslandMesh
          key={island.id}
          island={island}
          isNearby={nearbyIsland === island.id}
          quality={quality}
        />
      ))}

      {/* Barriles/dianas flotantes del Mini-Juego alrededor de Arrecife Calavera */}
      {skullIsland &&
        TARGET_OFFSETS.map(([ox, oz], idx) => {
          const isHit = hitTargets.includes(idx);
          if (isHit) return null;
          return (
            <group
              key={idx}
              position={[
                skullIsland.position[0] + ox,
                0.7,
                skullIsland.position[1] + oz,
              ]}
              onClick={(e) => {
                if (!minigameActive) return;
                e.stopPropagation();
                onHitTarget(idx);
              }}
            >
              <mesh>
                <cylinderGeometry args={[0.9, 0.9, 1.5, 8]} />
                <meshStandardMaterial color="#b45309" flatShading />
              </mesh>
              <mesh position={[0, 0.95, 0]}>
                <octahedronGeometry args={[0.55, 0]} />
                <meshStandardMaterial
                  color="#fb7185"
                  emissive="#f43f5e"
                  emissiveIntensity={minigameActive ? 2.5 : 0.8}
                  flatShading
                />
              </mesh>
            </group>
          );
        })}
    </group>
  );
}
