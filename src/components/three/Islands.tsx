import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import { ATARDECER_PALETTE } from '../../data/palette';
import type { DynamicWindState, IslandData, IslandId } from '../../types/portfolio';
import { sampleGerstnerSurface, stepBuoyantBody } from '../../utils/oceanMath';
import {
  buildSculptedBeachGeometry,
  queueSandStamp,
  setupBeachSandMaterial,
  syncBeachSandMaterial,
  type SandSharedState,
  type SandStampItem,
} from '../../utils/sandDeformation';

interface IslandsProps {
  nearbyIsland: IslandId | null;
  liveWindRef: React.RefObject<DynamicWindState>;
  sandStateRef: React.RefObject<SandSharedState>;
  stampQueueRef: React.RefObject<SandStampItem[]>;
  minigameActive: boolean;
  hitTargets: number[];
  onHitTarget: (idx: number) => void;
}

/**
 * Crea geometrías compartidas de palmera curva + hojas arqueadas (cero aspecto Lego).
 */
function buildPalmGeometries() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.32, 1.5, 0.1),
    new THREE.Vector3(0.78, 3.0, 0.25),
    new THREE.Vector3(1.1, 4.3, 0.35),
  ]);
  const trunkGeo = new THREE.TubeGeometry(curve, 7, 0.18, 6, false);

  // Hoja arqueada puntiaguda
  const frondGeo = new THREE.PlaneGeometry(0.65, 2.3, 2, 5);
  const pos = frondGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i) + 1.15; // 0 en la base -> 2.3 en la punta
    const t = y / 2.3;
    const widthScale = Math.sin(t * Math.PI) * 1.15;
    const droopZ = -(t * t) * 0.95; // Se curva hacia abajo suavemente
    pos.setXYZ(i, x * widthScale, droopZ, y);
  }
  frondGeo.computeVertexNormals();

  // Acantilado orgánico desplazado (silueta de peñasco natural)
  const cliffGeo = new THREE.DodecahedronGeometry(5.5, 1);
  const cPos = cliffGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < cPos.count; i += 1) {
    const vx = cPos.getX(i);
    const vy = cPos.getY(i);
    const vz = cPos.getZ(i);
    const noise = 0.82 + Math.sin(vx * 0.7 + vz * 0.9) * 0.22;
    cPos.setXYZ(i, vx * noise, Math.max(-0.5, vy * 1.15), vz * noise);
  }
  cliffGeo.computeVertexNormals();

  return { trunkGeo, frondGeo, cliffGeo };
}

function createWoodSignTexture(label: string, accentColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = ATARDECER_PALETTE.woodPost;
    ctx.fillRect(0, 0, 512, 144);

    // Vetas sutiles de madera
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, 34, 512, 6);
    ctx.fillRect(0, 98, 512, 6);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 128);

    ctx.fillStyle = ATARDECER_PALETTE.cloudCream;
    ctx.font = 'bold 54px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 75);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function CurvedPalm({
  position,
  rotationY = 0,
  scale = 1,
  phaseOffset = 0,
  trunkGeo,
  frondGeo,
}: {
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  phaseOffset?: number;
  trunkGeo: THREE.BufferGeometry;
  frondGeo: THREE.BufferGeometry;
}) {
  const crownRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (crownRef.current) {
      const t = clock.getElapsedTime();
      crownRef.current.rotation.z = Math.sin(t * 1.5 + phaseOffset) * 0.07;
      crownRef.current.rotation.x = Math.cos(t * 1.2 + phaseOffset) * 0.05;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh geometry={trunkGeo}>
        <meshStandardMaterial color={ATARDECER_PALETTE.woodPlank} flatShading />
      </mesh>
      <group ref={crownRef} position={[1.1, 4.3, 0.35]}>
        {[0, 1.05, 2.1, 3.15, 4.2, 5.25].map((angle) => (
          <mesh
            key={angle}
            geometry={frondGeo}
            rotation={[-0.18, angle, 0]}
          >
            <meshStandardMaterial
              color={ATARDECER_PALETTE.palmOlive}
              flatShading
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function IslandMesh({
  island,
  tileIndex,
  isNearby,
  geometries,
  liveWindRef,
  sandStateRef,
  stampQueueRef,
}: {
  island: IslandData;
  tileIndex: number;
  isNearby: boolean;
  geometries: ReturnType<typeof buildPalmGeometries>;
  liveWindRef: React.RefObject<DynamicWindState>;
  sandStateRef: React.RefObject<SandSharedState>;
  stampQueueRef: React.RefObject<SandStampItem[]>;
}) {
  const beaconRef = useRef<THREE.Mesh>(null);
  const lighthouseLightRef = useRef<THREE.Group>(null);
  const sandMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const beachGeo = useMemo(
    () => buildSculptedBeachGeometry(17.5, tileIndex),
    [tileIndex]
  );

  const signTexture = useMemo(
    () => createWoodSignTexture(island.signLabel, island.accentColor),
    [island.signLabel, island.accentColor]
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (beaconRef.current) {
      beaconRef.current.position.y = 14.5 + Math.sin(t * 2.2) * 0.6;
      beaconRef.current.rotation.y = t * 1.4;
    }
    if (lighthouseLightRef.current) {
      lighthouseLightRef.current.rotation.y = t * 1.6;
    }
    syncBeachSandMaterial(sandMatRef.current, sandStateRef.current, liveWindRef.current.liveOcean);
  });

  const stampPointerFootprint = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    const ang = e.point.x * 1.7 + e.point.z * 2.3;
    queueSandStamp(stampQueueRef, {
      x: e.point.x,
      z: e.point.z,
      dirX: Math.cos(ang),
      dirZ: Math.sin(ang),
      radius: 0.38,
      depth: 0.12,
      aspect: 1.55,
    });
  };

  return (
    <group position={[island.position[0], 0, island.position[1]]}>
      {/* Playa esculpida reactiva a marea y deformación dinámica en RenderTarget */}
      <mesh geometry={beachGeo} position={[0, 0, 0]} onClick={stampPointerFootprint}>
        <meshStandardMaterial
          ref={(el) => {
            sandMatRef.current = el;
            setupBeachSandMaterial(el);
          }}
          color={ATARDECER_PALETTE.sandGold}
          roughness={0.9}
        />
      </mesh>

      {/* Acantilados pastel de paleta/atardecer.jpg (oliva dorado, terracota y lavanda) */}
      <mesh geometry={geometries.cliffGeo} position={[-1.4, 2.1, -0.5]}>
        <meshStandardMaterial
          color={
            island.landmark === 'skull'
              ? ATARDECER_PALETTE.rockBurgundy
              : ATARDECER_PALETTE.grassOlive
          }
          flatShading
          roughness={0.88}
        />
      </mesh>
      <mesh
        geometry={geometries.cliffGeo}
        position={[3.4, 1.2, -2.1]}
        scale={[0.62, 0.72, 0.62]}
        rotation={[0, 1.4, 0]}
      >
        <meshStandardMaterial
          color={
            island.landmark === 'skull'
              ? ATARDECER_PALETTE.rockPeriwinkle
              : ATARDECER_PALETTE.rockLavender
          }
          flatShading
          roughness={0.9}
        />
      </mesh>

      {/* Palmeras curvas arqueadas */}
      <CurvedPalm
        position={[-4.8, 1.2, 2.8]}
        rotationY={0.8}
        scale={1.05}
        phaseOffset={0.4}
        trunkGeo={geometries.trunkGeo}
        frondGeo={geometries.frondGeo}
      />
      <CurvedPalm
        position={[4.6, 1.2, 2.2]}
        rotationY={-1.2}
        scale={0.9}
        phaseOffset={1.9}
        trunkGeo={geometries.trunkGeo}
        frondGeo={geometries.frondGeo}
      />
      <CurvedPalm
        position={[-1.8, 1.3, -5.0]}
        rotationY={2.5}
        scale={1.12}
        phaseOffset={3.1}
        trunkGeo={geometries.trunkGeo}
        frondGeo={geometries.frondGeo}
      />

      {/* Letrero de madera con doble poste en la orilla (idéntico al concepto) */}
      <group position={[0, 1.4, 8.6]}>
        <mesh position={[-1.45, 1.35, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 2.9, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.woodPost} flatShading />
        </mesh>
        <mesh position={[1.45, 1.35, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 2.9, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.woodPost} flatShading />
        </mesh>
        <mesh position={[0, 2.25, 0]}>
          <boxGeometry args={[4.4, 1.35, 0.16]} />
          <meshStandardMaterial map={signTexture} flatShading />
        </mesh>
      </group>

      {/* Landmark específico */}
      {island.landmark === 'lighthouse' && (
        <group position={[2.2, 2.8, -1.2]}>
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[0.72, 1.22, 6.4, 8]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.cloudCream} flatShading />
          </mesh>
          <mesh position={[0, 6.6, 0]}>
            <cylinderGeometry args={[0.85, 0.85, 0.9, 8]} />
            <meshStandardMaterial
              color={ATARDECER_PALETTE.apricotAccent}
              emissive={ATARDECER_PALETTE.coralAccent}
              emissiveIntensity={2.2}
              flatShading
            />
          </mesh>
          <group ref={lighthouseLightRef} position={[0, 6.6, 0]}>
            <mesh position={[0, 0, 4.5]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[1.6, 8.5, 6]} />
              <meshBasicMaterial
                color={ATARDECER_PALETTE.cloudApricot}
                transparent
                opacity={0.2}
                depthWrite={false}
              />
            </mesh>
          </group>
          <mesh position={[0, 7.6, 0]}>
            <coneGeometry args={[1.1, 1.2, 8]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.rockBurgundy} flatShading />
          </mesh>
        </group>
      )}

      {island.landmark === 'treasure' && (
        <group position={[2.0, 1.65, 3.6]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[1.1, 1.2, 1.0, 6]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.woodHull} flatShading />
          </mesh>
          <mesh position={[0, 1.05, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.58, 0.58, 1.9, 6]} />
            <meshStandardMaterial
              color={ATARDECER_PALETTE.sandGold}
              emissive={ATARDECER_PALETTE.coralAccent}
              emissiveIntensity={1.1}
              flatShading
            />
          </mesh>
        </group>
      )}

      {island.landmark === 'observatory' && (
        <group position={[0, 5.4, 0]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[1.1, 1.65, 3.4, 7]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.rockPeriwinkle} flatShading />
          </mesh>
          <mesh position={[0, 3.9, 0]}>
            <octahedronGeometry args={[1.35, 0]} />
            <meshStandardMaterial
              color={ATARDECER_PALETTE.lavenderAccent}
              emissive={ATARDECER_PALETTE.rockLavender}
              emissiveIntensity={2}
              flatShading
            />
          </mesh>
        </group>
      )}

      {island.landmark === 'skull' && (
        <group position={[0, 5.6, 0]}>
          <mesh position={[0, 1.4, 0]} scale={[1, 1.15, 1]}>
            <dodecahedronGeometry args={[2.6, 0]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.cloudApricot} flatShading />
          </mesh>
          <mesh position={[-0.75, 1.6, 1.95]}>
            <octahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial
              color={ATARDECER_PALETTE.coralAccent}
              emissive={ATARDECER_PALETTE.rockBurgundy}
              emissiveIntensity={2.4}
              flatShading
            />
          </mesh>
          <mesh position={[0.75, 1.6, 1.95]}>
            <octahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial
              color={ATARDECER_PALETTE.coralAccent}
              emissive={ATARDECER_PALETTE.rockBurgundy}
              emissiveIntensity={2.4}
              flatShading
            />
          </mesh>
        </group>
      )}

      {/* Baliza superior */}
      <mesh ref={beaconRef} position={[0, 14.5, 0]}>
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
  liveWindRef,
  minigameActive,
  onHit,
}: {
  baseX: number;
  baseZ: number;
  liveWindRef: React.RefObject<DynamicWindState>;
  minigameActive: boolean;
  onHit: () => void;
}) {
  const barrelRef = useRef<THREE.Group>(null);
  const bodyRef = useRef({ y: 0.2, velY: 0 });

  useFrame((_, rawDelta) => {
    const grp = barrelRef.current;
    if (!grp) return;
    const dt = Math.min(rawDelta, 0.05);
    const wind = liveWindRef.current;
    const surface = sampleGerstnerSurface(baseX, baseZ, wind.waveTime, wind.liveOcean);

    const next = stepBuoyantBody(bodyRef.current.y, bodyRef.current.velY, surface.height, dt, 30, 5.4, -0.2);
    bodyRef.current.y = next.y;
    bodyRef.current.velY = next.velY;

    grp.position.set(baseX, next.y, baseZ);
    // Inclinamos el cuerpo rígido siguiendo la normal de la ola Gerstner
    grp.rotation.z = THREE.MathUtils.lerp(grp.rotation.z, -surface.normalX * 0.85, dt * 6);
    grp.rotation.x = THREE.MathUtils.lerp(grp.rotation.x, surface.normalZ * 0.85, dt * 6);
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
        <cylinderGeometry args={[0.92, 0.92, 1.55, 8]} />
        <meshStandardMaterial color={ATARDECER_PALETTE.woodHull} flatShading />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <octahedronGeometry args={[0.58, 0]} />
        <meshStandardMaterial
          color={ATARDECER_PALETTE.coralAccent}
          emissive={ATARDECER_PALETTE.rockBurgundy}
          emissiveIntensity={minigameActive ? 2.6 : 0.9}
          flatShading
        />
      </mesh>
    </group>
  );
}

const HARBOR_BUOYS: [number, number][] = [
  [8, -10],
  [-11, -18],
  [14, -24],
];

function BuoyantCrate({
  baseX,
  baseZ,
  liveWindRef,
}: {
  baseX: number;
  baseZ: number;
  liveWindRef: React.RefObject<DynamicWindState>;
}) {
  const crateRef = useRef<THREE.Group>(null);
  const bodyRef = useRef({ y: 0.1, velY: 0 });

  useFrame((_, rawDelta) => {
    const grp = crateRef.current;
    if (!grp) return;
    const dt = Math.min(rawDelta, 0.05);
    const wind = liveWindRef.current;
    const surface = sampleGerstnerSurface(baseX, baseZ, wind.waveTime, wind.liveOcean);

    const next = stepBuoyantBody(bodyRef.current.y, bodyRef.current.velY, surface.height, dt, 34, 5.6, -0.05);
    bodyRef.current.y = next.y;
    bodyRef.current.velY = next.velY;

    grp.position.set(baseX, next.y, baseZ);
    grp.rotation.z = THREE.MathUtils.lerp(grp.rotation.z, -surface.normalX * 0.95, dt * 7);
    grp.rotation.x = THREE.MathUtils.lerp(grp.rotation.x, surface.normalZ * 0.95, dt * 7);
    grp.rotation.y += dt * 0.25;
  });

  return (
    <group ref={crateRef} position={[baseX, 0.1, baseZ]}>
      <mesh>
        <boxGeometry args={[1.35, 1.0, 1.35]} />
        <meshStandardMaterial color={ATARDECER_PALETTE.woodTrim} flatShading />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.55, 6]} />
        <meshStandardMaterial color={ATARDECER_PALETTE.apricotAccent} flatShading />
      </mesh>
    </group>
  );
}

export function Islands({
  nearbyIsland,
  liveWindRef,
  sandStateRef,
  stampQueueRef,
  minigameActive,
  hitTargets,
  onHitTarget,
}: IslandsProps) {
  const geometries = useMemo(() => buildPalmGeometries(), []);
  const skullIsland = ISLANDS.find((i) => i.id === 'minigame');

  return (
    <group>
      {ISLANDS.map((island, idx) => (
        <IslandMesh
          key={island.id}
          island={island}
          tileIndex={idx + 1}
          isNearby={nearbyIsland === island.id}
          geometries={geometries}
          liveWindRef={liveWindRef}
          sandStateRef={sandStateRef}
          stampQueueRef={stampQueueRef}
        />
      ))}

      {/* Cajas/boyas rígidas flotantes frente al puerto para apreciar la flotabilidad */}
      {HARBOR_BUOYS.map(([bx, bz], idx) => (
        <BuoyantCrate
          key={`crate-${idx}`}
          baseX={bx}
          baseZ={bz}
          liveWindRef={liveWindRef}
        />
      ))}

      {skullIsland &&
        TARGET_OFFSETS.map(([ox, oz], idx) => {
          if (hitTargets.includes(idx)) return null;
          return (
            <FloatingBarrel
              key={idx}
              baseX={skullIsland.position[0] + ox}
              baseZ={skullIsland.position[1] + oz}
              liveWindRef={liveWindRef}
              minigameActive={minigameActive}
              onHit={() => onHitTarget(idx)}
            />
          );
        })}
    </group>
  );
}
