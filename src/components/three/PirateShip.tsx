import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import type { GamePhase, IslandId, ShipTelemetry } from '../../types/portfolio';
import { getWaveHeight, getWindState, WORLD_COLLIDERS } from '../../utils/oceanMath';
import { PirateCharacter } from './PirateCharacter';

interface PirateShipProps {
  phase: GamePhase;
  isFirstPerson: boolean;
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  shipPosRef: React.RefObject<{ x: number; z: number }>;
  activeModalIsland: IslandId | null;
  onNearbyIslandChange: (islandId: IslandId | null) => void;
  onHullCollision: () => void;
  mobileInputRef: React.RefObject<{ forward: number; turn: number }>;
}

const SHIP_RADIUS = 2.75;

interface HullStation {
  z: number;
  halfW: number;
  keelY: number;
  sheerY: number;
}

/**
 * Construye el casco lofted con bordas inclinadas (flare) y línea de arrufo curva
 * (sube en proa y popa, y hace un escalón suave junto al timón igual que la referencia).
 */
function buildSculptedBoatGeometries() {
  const stations: HullStation[] = [
    { z: -4.95, halfW: 0.04, keelY: 0.45, sheerY: 1.56 },
    { z: -4.15, halfW: 0.68, keelY: -0.1, sheerY: 1.42 },
    { z: -3.0, halfW: 1.18, keelY: -0.22, sheerY: 1.3 },
    { z: -1.6, halfW: 1.44, keelY: -0.25, sheerY: 1.24 },
    { z: -0.2, halfW: 1.48, keelY: -0.25, sheerY: 1.24 },
    { z: 0.9, halfW: 1.42, keelY: -0.22, sheerY: 1.28 },
    { z: 1.5, halfW: 1.35, keelY: -0.18, sheerY: 1.46 }, // Escalón junto al timón
    { z: 2.5, halfW: 1.22, keelY: -0.1, sheerY: 1.52 },
    { z: 3.15, halfW: 1.05, keelY: 0.05, sheerY: 1.58 },
  ];

  // Generamos la malla exterior del casco + interior de las bordas
  const hullVerts: number[] = [];
  const deckVerts: number[] = [];

  const pushTri = (arr: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  const pushQuad = (
    arr: number[],
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3
  ) => {
    pushTri(arr, a, b, c);
    pushTri(arr, a, c, d);
  };

  for (let i = 0; i < stations.length - 1; i += 1) {
    const s0 = stations[i];
    const s1 = stations[i + 1];

    const deckY0 = 0.78;
    const deckY1 = 0.78;
    const thickness = 0.11;

    // Puntos estación i (exterior)
    const k0 = new THREE.Vector3(0, s0.keelY, s0.z);
    const lb0 = new THREE.Vector3(-s0.halfW * 0.72, 0.25, s0.z);
    const rb0 = new THREE.Vector3(s0.halfW * 0.72, 0.25, s0.z);
    const lt0 = new THREE.Vector3(-s0.halfW, s0.sheerY, s0.z);
    const rt0 = new THREE.Vector3(s0.halfW, s0.sheerY, s0.z);

    // Puntos estación i+1 (exterior)
    const k1 = new THREE.Vector3(0, s1.keelY, s1.z);
    const lb1 = new THREE.Vector3(-s1.halfW * 0.72, 0.25, s1.z);
    const rb1 = new THREE.Vector3(s1.halfW * 0.72, 0.25, s1.z);
    const lt1 = new THREE.Vector3(-s1.halfW, s1.sheerY, s1.z);
    const rt1 = new THREE.Vector3(s1.halfW, s1.sheerY, s1.z);

    // Casco exterior (babor y estribor)
    pushQuad(hullVerts, k0, k1, lb1, lb0);
    pushQuad(hullVerts, lb0, lb1, lt1, lt0);
    pushQuad(hullVerts, k0, rb0, rb1, k1);
    pushQuad(hullVerts, rb0, rt0, rt1, rb1);

    // Bordas interiores y regala superior (rim)
    const lti0 = new THREE.Vector3(-Math.max(0, s0.halfW - thickness), s0.sheerY, s0.z);
    const lti1 = new THREE.Vector3(-Math.max(0, s1.halfW - thickness), s1.sheerY, s1.z);
    const rti0 = new THREE.Vector3(Math.max(0, s0.halfW - thickness), s0.sheerY, s0.z);
    const rti1 = new THREE.Vector3(Math.max(0, s1.halfW - thickness), s1.sheerY, s1.z);

    const ld0 = new THREE.Vector3(-Math.max(0, s0.halfW * 0.85 - thickness), deckY0, s0.z);
    const ld1 = new THREE.Vector3(-Math.max(0, s1.halfW * 0.85 - thickness), deckY1, s1.z);
    const rd0 = new THREE.Vector3(Math.max(0, s0.halfW * 0.85 - thickness), deckY0, s0.z);
    const rd1 = new THREE.Vector3(Math.max(0, s1.halfW * 0.85 - thickness), deckY1, s1.z);

    // Regala superior (babor y estribor)
    pushQuad(hullVerts, lt0, lt1, lti1, lti0);
    pushQuad(hullVerts, rti0, rti1, rt1, rt0);

    // Cara interior de las bordas
    pushQuad(hullVerts, lti0, lti1, ld1, ld0);
    pushQuad(hullVerts, rd0, rd1, rti1, rti0);

    // Piso de cubierta
    pushQuad(deckVerts, ld0, ld1, rd1, rd0);
  }

  // Espejo de popa (cierre trasero)
  const last = stations[stations.length - 1];
  const lk = new THREE.Vector3(0, last.keelY, last.z);
  const llb = new THREE.Vector3(-last.halfW * 0.72, 0.25, last.z);
  const lrb = new THREE.Vector3(last.halfW * 0.72, 0.25, last.z);
  const llt = new THREE.Vector3(-last.halfW, last.sheerY, last.z);
  const lrt = new THREE.Vector3(last.halfW, last.sheerY, last.z);
  pushTri(hullVerts, lk, lrb, llb);
  pushQuad(hullVerts, llb, lrb, lrt, llt);

  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(hullVerts, 3));
  hullGeo.computeVertexNormals();

  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckVerts, 3));
  deckGeo.computeVertexNormals();

  // Vela cangreja/latina subdividida con curvatura orgánica del viento
  const sailGeo = new THREE.PlaneGeometry(4.2, 4.4, 7, 7);
  const posAttr = sailGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i += 1) {
    const px = posAttr.getX(i) + 2.1; // 0..4.2 desde el mástil hacia afuera
    const py = posAttr.getY(i) + 2.2; // 0..4.4 altura
    const u = px / 4.2;
    const v = py / 4.4;

    // Forma triangular/cangreja: se estrecha arriba en v -> 1
    const maxWidthAtV = THREE.MathUtils.lerp(4.2, 0.55, v * 0.92);
    const nx = u * maxWidthAtV;
    const ny = py + u * 0.45 * (1 - v);
    // Panza suave de viento
    const belly = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.65;
    posAttr.setXYZ(i, nx, ny, belly);
  }
  sailGeo.computeVertexNormals();

  return { hullGeo, deckGeo, sailGeo };
}

export function PirateShip({
  phase,
  isFirstPerson,
  shipTelemetryRef,
  shipPosRef,
  activeModalIsland,
  onNearbyIslandChange,
  onHullCollision,
  mobileInputRef,
}: PirateShipProps) {
  const shipGroupRef = useRef<THREE.Group>(null);
  const wheelRef = useRef<THREE.Group>(null);
  const boomGroupRef = useRef<THREE.Group>(null);
  const sailMeshRef = useRef<THREE.Mesh>(null);
  const flagRef = useRef<THREE.Mesh>(null);

  const keysRef = useRef<Set<string>>(new Set());
  const lastNearbyRef = useRef<IslandId | null>(null);
  const lastCollisionTimeRef = useRef(0);
  const impactRollRef = useRef(0);

  const { hullGeo, deckGeo, sailGeo } = useMemo(() => buildSculptedBoatGeometries(), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    const onBlur = () => keysRef.current.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.getElapsedTime();
    const state = shipTelemetryRef.current;
    const wind = getWindState(t);

    let targetTurn = 0;
    let thrust = 0;

    if (phase === 'sailing' && !activeModalIsland) {
      const keys = keysRef.current;
      if (keys.has('KeyW') || keys.has('ArrowUp')) thrust += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) thrust -= 0.55;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) targetTurn += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) targetTurn -= 1;

      thrust += mobileInputRef.current.forward;
      targetTurn += mobileInputRef.current.turn;
    }

    const windAlign = Math.cos(state.heading - wind.angle);
    state.windAlignment = windAlign;
    const windBonus = 1 + windAlign * 0.24;
    const maxSpeed = 19 * windBonus;

    if (thrust !== 0) {
      const targetSpd = thrust > 0 ? thrust * maxSpeed : thrust * 10;
      state.speed = THREE.MathUtils.lerp(state.speed, targetSpd, dt * 2.1);
    } else {
      state.speed = THREE.MathUtils.lerp(state.speed, 0, dt * 1.25);
    }

    state.steerAngle = THREE.MathUtils.lerp(state.steerAngle, targetTurn, dt * 5.2);
    const turnAuthority = 0.45 + Math.min(Math.abs(state.speed) / 18, 1) * 0.75;
    state.heading += state.steerAngle * turnAuthority * dt * 1.4;

    state.x -= Math.sin(state.heading) * state.speed * dt;
    state.z -= Math.cos(state.heading) * state.speed * dt;

    // Colisiones reales con islas, muelle y costa
    if (phase === 'sailing') {
      for (const col of WORLD_COLLIDERS) {
        const dx = state.x - col.x;
        const dz = state.z - col.z;
        const minDist = col.radius + SHIP_RADIUS;
        const distSq = dx * dx + dz * dz;

        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const nz = dz / dist;

          state.x = col.x + nx * minDist;
          state.z = col.z + nz * minDist;

          const dirX = -Math.sin(state.heading);
          const dirZ = -Math.cos(state.heading);
          const impactDot = dirX * nx + dirZ * nz;
          if (impactDot < -0.15) {
            state.speed *= 0.35;
            impactRollRef.current = (Math.random() > 0.5 ? 1 : -1) * 0.14;
            if (t - lastCollisionTimeRef.current > 0.45) {
              lastCollisionTimeRef.current = t;
              onHullCollision();
            }
          }
        }
      }
    }

    state.x = THREE.MathUtils.clamp(state.x, -165, 165);
    state.z = THREE.MathUtils.clamp(state.z, -175, 110);
    shipPosRef.current.x = state.x;
    shipPosRef.current.z = state.z;

    // Flotación sincronizada con el oleaje en 4 puntos
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);

    const bowH = getWaveHeight(state.x - sinH * 3.5, state.z - cosH * 3.5, t);
    const sternH = getWaveHeight(state.x + sinH * 2.5, state.z + cosH * 2.5, t);
    const portH = getWaveHeight(state.x - cosH * 1.2, state.z + sinH * 1.2, t);
    const starH = getWaveHeight(state.x + cosH * 1.2, state.z - sinH * 1.2, t);

    const avgWaveY = (bowH + sternH + portH + starH) * 0.25;
    const wavePitch = Math.atan2(bowH - sternH, 6.0);
    const waveRoll = Math.atan2(portH - starH, 2.4);

    impactRollRef.current = THREE.MathUtils.lerp(impactRollRef.current, 0, dt * 4);

    if (shipGroupRef.current) {
      const targetPitch = wavePitch * 0.52 + (state.speed / 20) * 0.035;
      const targetRoll = waveRoll * 0.48 - state.steerAngle * 0.08 + impactRollRef.current;

      shipGroupRef.current.position.set(state.x, avgWaveY - 0.12, state.z);
      shipGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        shipGroupRef.current.rotation.x,
        targetPitch,
        dt * 6
      );
      shipGroupRef.current.rotation.y = state.heading;
      shipGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        shipGroupRef.current.rotation.z,
        targetRoll,
        dt * 6
      );
    }

    if (wheelRef.current) {
      wheelRef.current.rotation.z = state.steerAngle * 1.45;
    }

    if (boomGroupRef.current) {
      const relWind = wind.angle - state.heading;
      const sailSweep = Math.sin(relWind) * 0.3 + 0.56;
      boomGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        boomGroupRef.current.rotation.y,
        THREE.MathUtils.clamp(sailSweep, 0.25, 1.05),
        dt * 2.5
      );
    }

    if (sailMeshRef.current) {
      const billow = 1 + (Math.max(state.speed, 0) / 22) * 0.35 + Math.sin(t * 3.5) * 0.05;
      sailMeshRef.current.scale.z = THREE.MathUtils.lerp(sailMeshRef.current.scale.z, billow, dt * 4);
    }

    if (flagRef.current) {
      const relWind = wind.angle - state.heading;
      flagRef.current.rotation.y = relWind + Math.sin(t * 7) * 0.18;
    }

    if (phase === 'sailing') {
      let found: IslandId | null = null;
      for (const island of ISLANDS) {
        const dx = state.x - island.position[0];
        const dz = state.z - island.position[1];
        if (dx * dx + dz * dz <= island.dockRadius * island.dockRadius) {
          found = island.id;
          break;
        }
      }
      if (found !== lastNearbyRef.current) {
        lastNearbyRef.current = found;
        onNearbyIslandChange(found);
      }
    }
  });

  return (
    <group ref={shipGroupRef} position={[0, 0, 0]}>
      {/* Casco esculpido con bordas inclinadas y arrufo */}
      <mesh geometry={hullGeo}>
        <meshStandardMaterial
          color="#6b4024"
          flatShading
          roughness={0.82}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cubierta interior */}
      <mesh geometry={deckGeo}>
        <meshStandardMaterial
          color="#8f5b38"
          flatShading
          roughness={0.86}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Listones de refuerzo / Bancos transversales */}
      {[
        { z: -2.7, w: 1.45, y: 0.92 },
        { z: -1.45, w: 2.35, y: 0.92 },
        { z: -0.15, w: 2.45, y: 0.92 },
        { z: 0.85, w: 2.3, y: 0.96 },
      ].map((b) => (
        <mesh key={b.z} position={[0, b.y, b.z]}>
          <boxGeometry args={[b.w, 0.08, 0.34]} />
          <meshStandardMaterial color="#a66f46" flatShading />
        </mesh>
      ))}

      {/* Plataforma elevada de popa para el timonel */}
      <mesh position={[0, 0.9, 2.15]}>
        <cylinderGeometry args={[1.05, 1.2, 0.24, 6]} />
        <meshStandardMaterial color="#6e4326" flatShading />
      </mesh>

      {/* Bauprés delantero */}
      <mesh position={[0, 1.48, -5.5]} rotation={[Math.PI / 2.2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.09, 2.0, 6]} />
        <meshStandardMaterial color="#5c361e" flatShading />
      </mesh>

      {/* Farol de proa centrado-izquierda (exactamente como en la imagen POV) */}
      <group position={[-0.24, 1.25, -3.5]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.1, 0.13, 0.22, 6]} />
          <meshStandardMaterial color="#27272a" flatShading />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.11, 0.09, 0.28, 6]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#ff9f1c"
            emissiveIntensity={3.0}
            flatShading
          />
        </mesh>
        <mesh position={[0, 0.56, 0]}>
          <coneGeometry args={[0.15, 0.16, 6]} />
          <meshStandardMaterial color="#18181b" flatShading />
        </mesh>
        <pointLight position={[0, 0.45, 0]} color="#ffab40" intensity={5.5} distance={11} />
      </group>

      {/* Mástil, obenques dobles (izquierda y derecha) y vela curva con botavara */}
      <group position={[0, 0.78, -0.95]}>
        <mesh position={[0, 3.25, 0]}>
          <cylinderGeometry args={[0.09, 0.15, 6.5, 8]} />
          <meshStandardMaterial color="#3d2415" flatShading />
        </mesh>

        {/* Mesas de guarnición (bloques donde anclan los obenques) */}
        <mesh position={[-1.4, 0.46, 0.45]}>
          <boxGeometry args={[0.14, 0.16, 0.45]} />
          <meshStandardMaterial color="#4a2b18" flatShading />
        </mesh>
        <mesh position={[1.4, 0.46, 0.45]}>
          <boxGeometry args={[0.14, 0.16, 0.45]} />
          <meshStandardMaterial color="#4a2b18" flatShading />
        </mesh>

        {/* Obenques dobles (enmarcan ambos lados en 1ra persona como la imagen) */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.74, 2.95, 0.18]} rotation={[0.04, 0, side * 0.25]}>
              <cylinderGeometry args={[0.02, 0.022, 5.2, 5]} />
              <meshStandardMaterial color="#2a1d15" flatShading />
            </mesh>
            <mesh position={[side * 0.72, 2.95, 0.48]} rotation={[0.08, 0, side * 0.24]}>
              <cylinderGeometry args={[0.018, 0.02, 5.2, 5]} />
              <meshStandardMaterial color="#2a1d15" flatShading />
            </mesh>
          </group>
        ))}

        {/* Botavara + Vela curva */}
        <group ref={boomGroupRef} position={[0, 1.55, 0]} rotation={[0, 0.56, 0]}>
          <mesh position={[2.0, 0.22, 0]} rotation={[0, 0, Math.PI / 2 - 0.1]}>
            <cylinderGeometry args={[0.055, 0.085, 4.2, 7]} />
            <meshStandardMaterial color="#6e4226" flatShading />
          </mesh>
          <mesh ref={sailMeshRef} geometry={sailGeo} position={[0.05, 0.05, 0]}>
            <meshStandardMaterial
              color="#f6e3c5"
              roughness={0.82}
              flatShading
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        {/* Banderín de viento en lo alto */}
        <group position={[0, 6.45, 0]}>
          <mesh ref={flagRef} position={[0, 0, -0.45]}>
            <coneGeometry args={[0.16, 0.9, 4]} />
            <meshStandardMaterial color="#dc2626" flatShading />
          </mesh>
        </group>
      </group>

      {/* Pedestal y Timón tallado protagonista del POV 1ra persona */}
      <group position={[0, 1.0, 1.38]}>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.14, 0.22, 0.72, 6]} />
          <meshStandardMaterial color="#3d2415" flatShading />
        </mesh>
        <group ref={wheelRef} position={[0, 0.75, 0.16]}>
          {/* Aro principal */}
          <mesh>
            <torusGeometry args={[0.46, 0.058, 7, 14]} />
            <meshStandardMaterial color="#8d5b3a" flatShading />
          </mesh>
          {/* Aro interno */}
          <mesh>
            <torusGeometry args={[0.24, 0.03, 6, 12]} />
            <meshStandardMaterial color="#6e4226" flatShading />
          </mesh>
          {/* Maza central */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.13, 8]} />
            <meshStandardMaterial color="#d97706" flatShading />
          </mesh>
          {/* 8 rayos y empuñaduras torneadas */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
            const ang = (idx * Math.PI) / 4;
            return (
              <group key={idx} rotation={[0, 0, ang]}>
                <mesh position={[0, 0.25, 0]}>
                  <cylinderGeometry args={[0.025, 0.035, 0.44, 6]} />
                  <meshStandardMaterial color="#a66f46" flatShading />
                </mesh>
                <mesh position={[0, 0.56, 0]}>
                  <cylinderGeometry args={[0.022, 0.042, 0.19, 6]} />
                  <meshStandardMaterial color="#c48a5a" flatShading />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>

      {/* Capitán al timón (oculto en 1ra persona) */}
      {phase === 'sailing' && (
        <group position={[0, 1.02, 2.1]}>
          <PirateCharacter isWalking={false} hiddenInFirstPerson={isFirstPerson} />
        </group>
      )}
    </group>
  );
}
