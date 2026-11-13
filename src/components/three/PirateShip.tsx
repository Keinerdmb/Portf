import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import type { GamePhase, IslandId, QualityMode, ShipTelemetry } from '../../types/portfolio';
import { PirateCharacter } from './PirateCharacter';

interface PirateShipProps {
  phase: GamePhase;
  quality: QualityMode;
  isFirstPerson: boolean;
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  shipPosRef: React.RefObject<{ x: number; z: number }>;
  activeModalIsland: IslandId | null;
  onNearbyIslandChange: (islandId: IslandId | null) => void;
  mobileInputRef: React.RefObject<{ forward: number; turn: number }>;
}

export function PirateShip({
  phase,
  quality,
  isFirstPerson,
  shipTelemetryRef,
  shipPosRef,
  activeModalIsland,
  onNearbyIslandChange,
  mobileInputRef,
}: PirateShipProps) {
  const shipGroupRef = useRef<THREE.Group>(null);
  const wheelRef = useRef<THREE.Group>(null);
  const flagRef = useRef<THREE.Mesh>(null);
  const sailRef = useRef<THREE.Mesh>(null);

  const keysRef = useRef<Set<string>>(new Set());
  const lastNearbyRef = useRef<IslandId | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    const onBlur = () => {
      keysRef.current.clear();
    };

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

    // Si estamos navegando y no hay un modal abierto, procesamos controles del barco
    let targetTurn = 0;
    let thrust = 0;

    if (phase === 'sailing' && !activeModalIsland) {
      const keys = keysRef.current;
      if (keys.has('KeyW') || keys.has('ArrowUp')) thrust += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) thrust -= 0.6;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) targetTurn += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) targetTurn -= 1;

      thrust += mobileInputRef.current.forward;
      targetTurn += mobileInputRef.current.turn;
    }

    // Aceleración y fricción del agua (se siente pesado y fluido como un barco real)
    const maxSpeed = 20;
    if (thrust !== 0) {
      state.speed = THREE.MathUtils.lerp(state.speed, thrust * maxSpeed, dt * 2.2);
    } else {
      state.speed = THREE.MathUtils.lerp(state.speed, 0, dt * 1.4);
    }

    // Giro suave del timón y del rumbo
    state.steerAngle = THREE.MathUtils.lerp(state.steerAngle, targetTurn, dt * 5);
    const turnEfficiency = 0.45 + Math.min(Math.abs(state.speed) / maxSpeed, 1) * 0.75;
    state.heading += state.steerAngle * turnEfficiency * dt * 1.35;

    // Avanzamos hacia donde apunta la proa (-Z local rotado por heading)
    state.x -= Math.sin(state.heading) * state.speed * dt;
    state.z -= Math.cos(state.heading) * state.speed * dt;

    // Límite suave de océano para no perderse eternamente
    state.x = THREE.MathUtils.clamp(state.x, -165, 165);
    state.z = THREE.MathUtils.clamp(state.z, -175, 110);

    shipPosRef.current.x = state.x;
    shipPosRef.current.z = state.z;

    // Aplicamos posición y balanceo de olas al grupo 3D del barco
    if (shipGroupRef.current) {
      const waveY = Math.sin(t * 1.6 + state.x * 0.05) * 0.14;
      const pitch = Math.sin(t * 1.3) * 0.025 + (state.speed / maxSpeed) * 0.04;
      const roll = Math.cos(t * 1.1) * 0.03 - state.steerAngle * 0.08;

      shipGroupRef.current.position.set(state.x, waveY, state.z);
      shipGroupRef.current.rotation.set(pitch, state.heading, roll);
    }

    // Rotamos la rueda del timón visualmente
    if (wheelRef.current) {
      wheelRef.current.rotation.z = state.steerAngle * 1.3;
    }

    // Ondeo ligero de la bandera y vela
    if (flagRef.current) {
      flagRef.current.rotation.y = Math.sin(t * 6) * 0.22;
    }
    if (sailRef.current) {
      const windPush = 1 + (Math.max(state.speed, 0) / maxSpeed) * 0.25;
      sailRef.current.scale.z = THREE.MathUtils.lerp(sailRef.current.scale.z, windPush, dt * 4);
    }

    // Detectamos si el barco entró al radio de alguna isla (solo notificamos si cambia)
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
      {/* Casco principal */}
      <mesh position={[0, 0.35, -0.3]}>
        <boxGeometry args={[2.5, 0.9, 6.2]} />
        <meshStandardMaterial color="#4a2e1b" flatShading roughness={0.8} />
      </mesh>

      {/* Proa afilada apuntando hacia -Z */}
      <mesh position={[0, 0.42, -4.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[1.25, 2.0, 4]} />
        <meshStandardMaterial color="#3d2415" flatShading roughness={0.8} />
      </mesh>

      {/* Bauprés (palo delantero) */}
      <mesh position={[0, 1.05, -5.4]} rotation={[Math.PI / 2.25, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.11, 2.5, 5]} />
        <meshStandardMaterial color="#6b442a" flatShading />
      </mesh>

      {/* Cubierta principal (tablones cálidos) */}
      <mesh position={[0, 0.82, -0.4]}>
        <boxGeometry args={[2.25, 0.08, 5.8]} />
        <meshStandardMaterial color="#845435" flatShading roughness={0.85} />
      </mesh>

      {/* Alcázar / Popa elevada donde va el timón */}
      <mesh position={[0, 1.02, 1.8]}>
        <boxGeometry args={[2.3, 0.42, 2.0]} />
        <meshStandardMaterial color="#6b442a" flatShading roughness={0.85} />
      </mesh>

      {/* Barandales laterales (Babor y Estribor) */}
      <mesh position={[-1.18, 1.05, -0.3]}>
        <boxGeometry args={[0.14, 0.42, 6.1]} />
        <meshStandardMaterial color="#2f1c10" flatShading />
      </mesh>
      <mesh position={[1.18, 1.05, -0.3]}>
        <boxGeometry args={[0.14, 0.42, 6.1]} />
        <meshStandardMaterial color="#2f1c10" flatShading />
      </mesh>
      {/* Popa trasera */}
      <mesh position={[0, 1.35, 2.75]}>
        <boxGeometry args={[2.45, 0.45, 0.16]} />
        <meshStandardMaterial color="#2f1c10" flatShading />
      </mesh>

      {/* Detalle dorado en los bordes */}
      <mesh position={[-1.26, 0.8, -0.3]}>
        <boxGeometry args={[0.05, 0.1, 6.15]} />
        <meshStandardMaterial color="#d97706" flatShading />
      </mesh>
      <mesh position={[1.26, 0.8, -0.3]}>
        <boxGeometry args={[0.05, 0.1, 6.15]} />
        <meshStandardMaterial color="#d97706" flatShading />
      </mesh>

      {/* Farol cálido en la borda delantera derecha (clave en 1ra persona POV) */}
      <group position={[1.1, 1.25, -0.15]}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.45, 5]} />
          <meshStandardMaterial color="#1f2937" flatShading />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <octahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial
            color="#fde68a"
            emissive="#f59e0b"
            emissiveIntensity={2.4}
            flatShading
          />
        </mesh>
        {quality === 'high' && (
          <pointLight position={[0, 0.5, 0]} color="#ffaa33" intensity={4} distance={9} />
        )}
      </group>

      {/* Pedestal y Timón giratorio */}
      <group position={[0, 1.24, 1.25]}>
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.24, 0.65, 0.24]} />
          <meshStandardMaterial color="#3d2415" flatShading />
        </mesh>
        <group ref={wheelRef} position={[0, 0.62, 0.16]}>
          {/* Aro del timón */}
          <mesh>
            <torusGeometry args={[0.36, 0.045, 6, 12]} />
            <meshStandardMaterial color="#9a6239" flatShading />
          </mesh>
          {/* Centro dorado */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.08, 6]} />
            <meshStandardMaterial color="#fbbf24" flatShading />
          </mesh>
          {/* Radios / Mangos del timón */}
          {[0, 1, 2, 3].map((idx) => (
            <mesh key={idx} rotation={[0, 0, (idx * Math.PI) / 4]}>
              <cylinderGeometry args={[0.025, 0.025, 0.92, 5]} />
              <meshStandardMaterial color="#b47b4e" flatShading />
            </mesh>
          ))}
        </group>
      </group>

      {/* Mástil principal y vela estilizada */}
      <group position={[0, 0.85, -1.1]}>
        <mesh position={[0, 2.7, 0]}>
          <cylinderGeometry args={[0.1, 0.15, 5.5, 6]} />
          <meshStandardMaterial color="#5c3a21" flatShading />
        </mesh>

        {/* Verga horizontal superior */}
        <mesh position={[0, 4.4, -0.08]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 3.6, 5]} />
          <meshStandardMaterial color="#4a2e1b" flatShading />
        </mesh>

        {/* Vela principal elevada (permite ver bien por debajo en 1ra persona) */}
        <mesh ref={sailRef} position={[0, 3.35, -0.25]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[3.2, 2.0, 0.14]} />
          <meshStandardMaterial color="#f5ebe0" flatShading roughness={0.9} />
        </mesh>

        {/* Emblema / franja pirata en la vela */}
        <mesh position={[0, 3.35, -0.33]} rotation={[0.08, 0, 0]}>
          <octahedronGeometry args={[0.38, 0]} />
          <meshStandardMaterial color="#1f2937" flatShading />
        </mesh>

        {/* Bandera superior */}
        <mesh ref={flagRef} position={[0.45, 5.25, 0]}>
          <boxGeometry args={[0.9, 0.42, 0.04]} />
          <meshStandardMaterial color="#b91c1c" flatShading />
        </mesh>
      </group>

      {/* Capitán en el timón cuando ya zarpó */}
      {phase === 'sailing' && (
        <group position={[0, 1.24, 1.85]}>
          <PirateCharacter isWalking={false} hiddenInFirstPerson={isFirstPerson} />
        </group>
      )}
    </group>
  );
}
