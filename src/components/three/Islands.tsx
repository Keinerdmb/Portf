import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import type { IslandData, IslandId } from '../../types/portfolio';
import { getWaveHeight } from '../../utils/oceanMath';

interface IslandsProps {
  nearbyIsland: IslandId | null;
  minigameActive: boolean;
  hitTargets: number[];
  onHitTarget: (idx: number) => void;
}

/**
 * Genera una textura de letrero de madera en memoria (0 archivos externos)
 * para mostrar el nombre de cada isla como en la referencia.
 */
function createWoodSignTexture(label: string, accentColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#3d2414';
    ctx.fillRect(0, 0, 512, 160);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 492, 140);

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 58px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 84);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function PalmTree({
  position,
  scale = 1,
  phaseOffset = 0,
}: {
  position: [number, number, number];
  scale?: number;
  phaseOffset?: number;
}) {
  const crownRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (crownRef.current) {
      const t = clock.getElapsedTime();
      crownRef.current.rotation.z = Math.sin(t * 1.5 + phaseOffset) * 0.06;
      crownRef.current.rotation.x = Math.cos(t * 1.2 + phaseOffset) * 0.04;
    }
  });

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 2.0, 0]} rotation={[0.08, 0, -0.14]}>
        <cylinderGeometry args={[0.16, 0.3, 4.2, 5]} />
        <meshStandardMaterial color="#6b442a" flatShading />
      </mesh>
      <group ref={crownRef} position={[0.3, 3.9, -0.15]}>
        {[0, 1.25, 2.5, 3.75, 5.0].map((angle) => (
          <mesh key={angle} rotation={[0.45, angle, 0.85]} position={[0, 0, 0]}>
            <coneGeometry args={[0.55, 2.3, 4]} />
            <meshStandardMaterial color="#2f6f4e" flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function IslandMesh({
  island,
  isNearby,
}: {
  island: IslandData;
  isNearby: boolean;
}) {
  const beaconRef = useRef<THREE.Mesh>(null);
  const lighthouseLightRef = useRef<THREE.Group>(null);

  const signTexture = useMemo(
    () => createWoodSignTexture(island.signLabel, island.accentColor),
    [island.signLabel, island.accentColor]
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beaconRef.current) {
      beaconRef.current.position.y = 13.5 + Math.sin(t * 2.2) * 0.6;
      beaconRef.current.rotation.y = t * 1.4;
    }
    if (lighthouseLightRef.current) {
      lighthouseLightRef.current.rotation.y = t * 1.6;
    }
  });

  return (
    <group position={[island.position[0], 0, island.position[1]]}>
      {/* Playa de arena */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[10.5, 13.8, 2.2, 9]} />
        <meshStandardMaterial color="#dfb07c" flatShading roughness={0.9} />
      </mesh>

      {/* Acantilados y roca facetada (fiel al estilo de la referencia) */}
      <mesh position={[-1.4, 2.8, 0.4]}>
        <dodecahedronGeometry args={[5.8, 0]} />
        <meshStandardMaterial
          color={island.landmark === 'skull' ? '#494256' : '#4a6b53'}
          flatShading
          roughness={0.85}
        />
      </mesh>
      <mesh position={[3.2, 2.1, -1.8]}>
        <dodecahedronGeometry args={[3.4, 0]} />
        <meshStandardMaterial
          color={island.landmark === 'skull' ? '#363042' : '#585168'}
          flatShading
          roughness={0.9}
        />
      </mesh>

      {/* Palmeras animadas con el viento */}
      <PalmTree position={[-4.5, 1.3, 3.2]} scale={1.05} phaseOffset={0.4} />
      <PalmTree position={[4.6, 1.3, 2.8]} scale={0.9} phaseOffset={1.9} />
      <PalmTree position={[-2.2, 1.4, -4.8]} scale={1.1} phaseOffset={3.1} />

      {/* Letrero de madera en la costa mirando hacia el sur (+Z) */}
      <group position={[0, 1.6, 8.2]}>
        <mesh position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 2.8, 5]} />
          <meshStandardMaterial color="#4a2e1b" flatShading />
        </mesh>
        <mesh position={[0, 2.6, 0]}>
          <boxGeometry args={[4.4, 1.45, 0.22]} />
          <meshStandardMaterial map={signTexture} flatShading />
        </mesh>
      </group>

      {/* Landmark específico */}
      {island.landmark === 'lighthouse' && (
        <group position={[2.2, 2.5, -1.5]}>
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[0.75, 1.2, 6.4, 7]} />
            <meshStandardMaterial color="#f1f5f9" flatShading />
          </mesh>
          <mesh position={[0, 6.6, 0]}>
            <cylinderGeometry args={[0.85, 0.85, 0.9, 7]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={2.2}
              flatShading
            />
          </mesh>
          {/* Haz de luz giratorio del faro */}
          <group ref={lighthouseLightRef} position={[0, 6.6, 0]}>
            <mesh position={[0, 0, 4.5]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[1.6, 8.5, 6]} />
              <meshBasicMaterial color="#bae6fd" transparent opacity={0.18} depthWrite={false} />
            </mesh>
          </group>
          <mesh position={[0, 7.6, 0]}>
            <coneGeometry args={[1.1, 1.2, 7]} />
            <meshStandardMaterial color="#b91c1c" flatShading />
          </mesh>
        </group>
      )}

      {island.landmark === 'treasure' && (
        <group position={[1.8, 1.8, 3.6]}>
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[2.1, 1.2, 1.3]} />
            <meshStandardMaterial color="#78350f" flatShading />
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <boxGeometry args={[2.2, 0.3, 1.4]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#d97706"
              emissiveIntensity={1.4}
              flatShading
            />
          </mesh>
        </group>
      )}

      {island.landmark === 'observatory' && (
        <group position={[0, 5.2, 0]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[1.2, 1.6, 3.2, 6]} />
            <meshStandardMaterial color="#334155" flatShading />
          </mesh>
          <mesh position={[0, 3.8, 0]}>
            <octahedronGeometry args={[1.3, 0]} />
            <meshStandardMaterial
              color="#34d399"
              emissive="#10b981"
              emissiveIntensity={2}
              flatShading
            />
          </mesh>
        </group>
      )}

      {island.landmark === 'skull' && (
        <group position={[0, 5.4, 0]}>
          <mesh position={[0, 1.4, 0]}>
            <dodecahedronGeometry args={[2.6, 0]} />
            <meshStandardMaterial color="#cbd5e1" flatShading />
          </mesh>
          <mesh position={[-0.75, 1.6, 1.95]}>
            <boxGeometry args={[0.62, 0.62, 0.4]} />
            <meshStandardMaterial
              color="#fb7185"
              emissive="#e11d48"
              emissiveIntensity={2.4}
              flatShading
            />
          </mesh>
          <mesh position={[0.75, 1.6, 1.95]}>
            <boxGeometry args={[0.62, 0.62, 0.4]} />
            <meshStandardMaterial
              color="#fb7185"
              emissive="#e11d48"
              emissiveIntensity={2.4}
              flatShading
            />
          </mesh>
        </group>
      )}

      {/* Baliza superior para ubicar la isla desde lejos */}
      <mesh ref={beaconRef} position={[0, 13.5, 0]}>
        <octahedronGeometry args={[isNearby ? 1.35 : 0.9, 0]} />
        <meshStandardMaterial
          color={island.accentColor}
          emissive={island.accentColor}
          emissiveIntensity={isNearby ? 2.6 : 1.5}
          flatShading
        />
      </mesh>
    </group>
  );
}

const TARGET_OFFSETS: [number, number][] = [
  [-18, -10],
  [-17, 13],
  [18, -14],
  [17, 15],
];

function FloatingBarrel({
  baseX,
  baseZ,
  phaseOffset,
  minigameActive,
  onHit,
}: {
  baseX: number;
  baseZ: number;
  phaseOffset: number;
  minigameActive: boolean;
  onHit: () => void;
}) {
  const barrelRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const grp = barrelRef.current;
    if (!grp) return;
    const t = clock.getElapsedTime();
    const y = getWaveHeight(baseX, baseZ, t) + 0.35;
    grp.position.set(baseX, y, baseZ);
    grp.rotation.z = Math.sin(t * 2.1 + phaseOffset) * 0.14;
    grp.rotation.x = Math.cos(t * 1.7 + phaseOffset) * 0.12;
  });

  return (
    <group
      ref={barrelRef}
      position={[baseX, 0.4, baseZ]}
      onClick={(e) => {
        if (!minigameActive) return;
        e.stopPropagation();
        onHit();
      }}
    >
      <mesh>
        <cylinderGeometry args={[0.95, 0.95, 1.55, 8]} />
        <meshStandardMaterial color="#b45309" flatShading />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <octahedronGeometry args={[0.58, 0]} />
        <meshStandardMaterial
          color="#fb7185"
          emissive="#f43f5e"
          emissiveIntensity={minigameActive ? 2.6 : 0.9}
          flatShading
        />
      </mesh>
    </group>
  );
}

export function Islands({
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
        />
      ))}

      {/* Barriles del mini-juego cabalgando el oleaje real */}
      {skullIsland &&
        TARGET_OFFSETS.map(([ox, oz], idx) => {
          if (hitTargets.includes(idx)) return null;
          return (
            <FloatingBarrel
              key={idx}
              baseX={skullIsland.position[0] + ox}
              baseZ={skullIsland.position[1] + oz}
              phaseOffset={idx * 1.5}
              minigameActive={minigameActive}
              onHit={() => onHitTarget(idx)}
            />
          );
        })}
    </group>
  );
}
