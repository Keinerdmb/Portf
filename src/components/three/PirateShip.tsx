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

/**
 * Crea una silueta curva de casco pirata estilizado (proa en -Z, popa en +Z).
 */
function createBoatShapes() {
  // Silueta de cubierta
  const deckShape = new THREE.Shape();
  deckShape.moveTo(0, -4.6); // Proa afilada
  deckShape.quadraticCurveTo(1.55, -2.2, 1.5, 0.8);
  deckShape.quadraticCurveTo(1.42, 2.5, 1.12, 3.0);
  deckShape.lineTo(-1.12, 3.0);
  deckShape.quadraticCurveTo(-1.42, 2.5, -1.5, 0.8);
  deckShape.quadraticCurveTo(-1.55, -2.2, 0, -4.6);

  // Silueta exterior de bordas (borda gruesa hueca)
  const gunwaleOuter = new THREE.Shape();
  gunwaleOuter.moveTo(0, -4.85);
  gunwaleOuter.quadraticCurveTo(1.75, -2.2, 1.68, 0.85);
  gunwaleOuter.quadraticCurveTo(1.58, 2.65, 1.24, 3.18);
  gunwaleOuter.lineTo(-1.24, 3.18);
  gunwaleOuter.quadraticCurveTo(-1.58, 2.65, -1.68, 0.85);
  gunwaleOuter.quadraticCurveTo(-1.75, -2.2, 0, -4.85);

  const innerHole = new THREE.Path();
  innerHole.moveTo(0, -4.35);
  innerHole.quadraticCurveTo(1.42, -2.1, 1.38, 0.8);
  innerHole.quadraticCurveTo(1.3, 2.42, 1.0, 2.86);
  innerHole.lineTo(-1.0, 2.86);
  innerHole.quadraticCurveTo(-1.3, 2.42, -1.38, 0.8);
  innerHole.quadraticCurveTo(-1.42, -2.1, 0, -4.35);
  gunwaleOuter.holes.push(innerHole);

  return { deckShape, gunwaleOuter };
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

  const { deckGeo, hullGeo, gunwaleGeo, sailGeo } = useMemo(() => {
    const { deckShape, gunwaleOuter } = createBoatShapes();

    // Casco inferior
    const hull = new THREE.ExtrudeGeometry(gunwaleOuter, {
      depth: 0.72,
      bevelEnabled: false,
      curveSegments: 8,
    });
    hull.rotateX(Math.PI / 2);

    // Piso de cubierta
    const deck = new THREE.ExtrudeGeometry(deckShape, {
      depth: 0.14,
      bevelEnabled: false,
      curveSegments: 8,
    });
    deck.rotateX(Math.PI / 2);

    // Borda superior más alta (enmarca la vista 1ra persona como en la referencia)
    const gunwale = new THREE.ExtrudeGeometry(gunwaleOuter, {
      depth: 0.42,
      bevelEnabled: false,
      curveSegments: 8,
    });
    gunwale.rotateX(Math.PI / 2);

    // Vela triangular estilizada (vela cangreja/latina que barre hacia un lado)
    const sShape = new THREE.Shape();
    sShape.moveTo(0, 0);
    sShape.lineTo(3.8, 0.35);
    sShape.quadraticCurveTo(2.4, 2.4, 0.1, 4.3);
    sShape.closePath();
    const sail = new THREE.ExtrudeGeometry(sShape, {
      depth: 0.06,
      bevelEnabled: false,
      curveSegments: 6,
    });

    return { deckGeo: deck, hullGeo: hull, gunwaleGeo: gunwale, sailGeo: sail };
  }, []);

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

    // 1. Entrada de usuario
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

    // 2. Física del viento: a favor empuja más, de frente frena un poco
    const windAlign = Math.cos(state.heading - wind.angle);
    state.windAlignment = windAlign;
    const windBonus = 1 + windAlign * 0.24; // Entre 0.76x y 1.24x
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

    // 3. Colisiones reales con islas, muelle y costa
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

          // Empujamos fuera del colisionador suavemente
          state.x = col.x + nx * minDist;
          state.z = col.z + nz * minDist;

          // Amortiguamos velocidad si chocamos de frente
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

    // 4. Flotación real sincronizada con el oleaje en 4 puntos del casco
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
      const targetPitch = wavePitch * 0.55 + (state.speed / 20) * 0.04;
      const targetRoll = waveRoll * 0.5 - state.steerAngle * 0.08 + impactRollRef.current;

      shipGroupRef.current.position.set(state.x, avgWaveY - 0.15, state.z);
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

    // 5. Animación del timón, botavara/vela con el viento y banderín
    if (wheelRef.current) {
      wheelRef.current.rotation.z = state.steerAngle * 1.4;
    }

    if (boomGroupRef.current) {
      // La botavara se orienta ligeramente hacia la derecha/sotavento según el viento
      const relWind = wind.angle - state.heading;
      const sailSweep = Math.sin(relWind) * 0.35 + 0.52;
      boomGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        boomGroupRef.current.rotation.y,
        THREE.MathUtils.clamp(sailSweep, 0.2, 1.1),
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

    // 6. Proximidad a islas
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
      {/* Casco curvo inferior */}
      <mesh geometry={hullGeo} position={[0, 0.72, 0]}>
        <meshStandardMaterial color="#4e301d" flatShading roughness={0.82} />
      </mesh>

      {/* Piso curvo de cubierta */}
      <mesh geometry={deckGeo} position={[0, 0.74, 0]}>
        <meshStandardMaterial color="#8d5b3a" flatShading roughness={0.85} />
      </mesh>

      {/* Bordas curvas más altas (se ven geniales en 1ra persona) */}
      <mesh geometry={gunwaleGeo} position={[0, 1.14, 0]}>
        <meshStandardMaterial color="#6e4226" flatShading roughness={0.8} />
      </mesh>

      {/* Bancos / refuerzos transversales de cubierta */}
      {[-2.2, -0.7, 0.75].map((bz) => (
        <mesh key={bz} position={[0, 0.85, bz]}>
          <boxGeometry args={[2.55, 0.1, 0.32]} />
          <meshStandardMaterial color="#a46c45" flatShading />
        </mesh>
      ))}

      {/* Popa elevada para el timón */}
      <mesh position={[0, 0.96, 2.05]}>
        <boxGeometry args={[2.25, 0.36, 1.75]} />
        <meshStandardMaterial color="#623a21" flatShading />
      </mesh>

      {/* Bauprés delantero */}
      <mesh position={[0, 1.32, -5.25]} rotation={[Math.PI / 2.25, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.1, 2.2, 6]} />
        <meshStandardMaterial color="#5c361e" flatShading />
      </mesh>

      {/* Farol cálido en la proa izquierda (fiel a la imagen de 1ra persona) */}
      <group position={[-0.35, 1.2, -3.55]}>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.09, 0.12, 0.25, 6]} />
          <meshStandardMaterial color="#27272a" flatShading />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <octahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#f59e0b"
            emissiveIntensity={2.8}
            flatShading
          />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <coneGeometry args={[0.15, 0.14, 6]} />
          <meshStandardMaterial color="#18181b" flatShading />
        </mesh>
        <pointLight position={[0, 0.55, 0]} color="#ffab40" intensity={4.5} distance={10} />
      </group>

      {/* Mástil principal, jarcia (cuerdas diagonales) y vela cangreja */}
      <group position={[0, 0.8, -0.95]}>
        <mesh position={[0, 3.0, 0]}>
          <cylinderGeometry args={[0.09, 0.14, 6.0, 6]} />
          <meshStandardMaterial color="#4a2b18" flatShading />
        </mesh>

        {/* Cuerdas diagonales (obenques) visibles en 1ra persona a izquierda y derecha */}
        <mesh position={[-0.78, 2.55, 0.15]} rotation={[0, 0, -0.25]}>
          <cylinderGeometry args={[0.02, 0.02, 4.9, 4]} />
          <meshStandardMaterial color="#2f2219" flatShading />
        </mesh>
        <mesh position={[-0.74, 2.55, -0.15]} rotation={[0, 0, -0.24]}>
          <cylinderGeometry args={[0.018, 0.018, 4.9, 4]} />
          <meshStandardMaterial color="#2f2219" flatShading />
        </mesh>
        <mesh position={[0.78, 2.55, 0.15]} rotation={[0, 0, 0.25]}>
          <cylinderGeometry args={[0.02, 0.02, 4.9, 4]} />
          <meshStandardMaterial color="#2f2219" flatShading />
        </mesh>
        <mesh position={[0.74, 2.55, -0.15]} rotation={[0, 0, 0.24]}>
          <cylinderGeometry args={[0.018, 0.018, 4.9, 4]} />
          <meshStandardMaterial color="#2f2219" flatShading />
        </mesh>

        {/* Botavara y vela que barren hacia el lado atrapando el viento */}
        <group ref={boomGroupRef} position={[0, 1.35, 0]} rotation={[0, 0.55, 0]}>
          {/* Botavara de madera */}
          <mesh position={[1.9, 0.15, 0]} rotation={[0, 0, Math.PI / 2 - 0.08]}>
            <cylinderGeometry args={[0.055, 0.075, 4.0, 6]} />
            <meshStandardMaterial color="#6e4226" flatShading />
          </mesh>
          {/* Vela cálida iluminada por el atardecer */}
          <mesh ref={sailMeshRef} geometry={sailGeo} position={[0.05, 0.18, -0.03]}>
            <meshStandardMaterial
              color="#f7e7ce"
              roughness={0.85}
              flatShading
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        {/* Banderín en la cima del mástil que apunta hacia donde sopla el viento */}
        <group position={[0, 5.9, 0]}>
          <mesh ref={flagRef} position={[0, 0, -0.42]}>
            <boxGeometry args={[0.05, 0.32, 0.85]} />
            <meshStandardMaterial color="#dc2626" flatShading />
          </mesh>
        </group>
      </group>

      {/* Pedestal y Timón grande esculpido (protagonista del POV 1ra persona) */}
      <group position={[0, 1.15, 1.25]}>
        <mesh position={[0, 0.34, 0]}>
          <boxGeometry args={[0.26, 0.68, 0.28]} />
          <meshStandardMaterial color="#3d2415" flatShading />
        </mesh>
        <group ref={wheelRef} position={[0, 0.72, 0.18]}>
          {/* Aro principal */}
          <mesh>
            <torusGeometry args={[0.46, 0.055, 6, 12]} />
            <meshStandardMaterial color="#8d5b3a" flatShading />
          </mesh>
          {/* Centro */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.1, 8]} />
            <meshStandardMaterial color="#d97706" flatShading />
          </mesh>
          {/* 8 radios con empuñaduras que sobresalen */}
          {[0, 1, 2, 3].map((idx) => (
            <mesh key={idx} rotation={[0, 0, (idx * Math.PI) / 4]}>
              <cylinderGeometry args={[0.03, 0.03, 1.18, 5]} />
              <meshStandardMaterial color="#b47b4e" flatShading />
            </mesh>
          ))}
        </group>
      </group>

      {/* Capitán al timón cuando está navegando (se oculta en 1ra persona) */}
      {phase === 'sailing' && (
        <group position={[0, 1.15, 1.95]}>
          <PirateCharacter isWalking={false} hiddenInFirstPerson={isFirstPerson} />
        </group>
      )}
    </group>
  );
}
