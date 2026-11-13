import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type {
  GamePhase,
  IslandId,
  QualityMode,
  ShipTelemetry,
} from '../../types/portfolio';
import { CameraRig } from './CameraRig';
import { HomeDock } from './HomeDock';
import { Islands } from './Islands';
import { Ocean } from './Ocean';
import { PirateCharacter } from './PirateCharacter';
import { PirateShip } from './PirateShip';

interface WorldSceneProps {
  phase: GamePhase;
  quality: QualityMode;
  isFirstPerson: boolean;
  cameraModeRequest: { zoom: number; nonce: number } | null;
  onZoomModeChange: (isFirstPerson: boolean) => void;
  onBoarded: () => void;
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  nearbyIsland: IslandId | null;
  activeModalIsland: IslandId | null;
  onNearbyIslandChange: (islandId: IslandId | null) => void;
  mobileInputRef: React.RefObject<{ forward: number; turn: number }>;
  minigameActive: boolean;
  hitTargets: number[];
  onHitTarget: (idx: number) => void;
}

/**
 * Controla la caminata del capitán por el muelle hasta subir al timón
 */
function BoardingActor({
  phase,
  onBoarded,
  boardingProgressRef,
  boardingCharPosRef,
}: {
  phase: GamePhase;
  onBoarded: () => void;
  boardingProgressRef: React.MutableRefObject<number>;
  boardingCharPosRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const actorRef = useRef<THREE.Group>(null);
  const completedRef = useRef(false);

  useFrame((_, rawDelta) => {
    const actor = actorRef.current;
    if (!actor) return;

    if (phase === 'title') {
      completedRef.current = false;
      boardingProgressRef.current = 0;
      actor.position.set(-3.1, 1.08, 7.0);
      actor.rotation.y = Math.PI * 0.78;
      boardingCharPosRef.current.copy(actor.position);
      return;
    }

    if (phase === 'boarding') {
      const dt = Math.min(rawDelta, 0.05);
      boardingProgressRef.current = Math.min(boardingProgressRef.current + dt / 2.5, 1);
      const p = boardingProgressRef.current;

      // Tramo 1 (0 -> 0.55): camina por el muelle hacia la pasarela
      // Tramo 2 (0.55 -> 1.0): cruza la pasarela y se acomoda detrás del timón
      if (p < 0.55) {
        const t1 = p / 0.55;
        actor.position.x = THREE.MathUtils.lerp(-3.1, -2.5, t1);
        actor.position.y = 1.08;
        actor.position.z = THREE.MathUtils.lerp(7.0, 1.85, t1);
        actor.rotation.y = Math.PI;
      } else {
        const t2 = (p - 0.55) / 0.45;
        actor.position.x = THREE.MathUtils.lerp(-2.5, 0, t2);
        actor.position.y = THREE.MathUtils.lerp(1.08, 1.24, t2);
        actor.position.z = 1.85;
        actor.rotation.y = THREE.MathUtils.lerp(Math.PI * 0.5, 0, t2);
      }

      boardingCharPosRef.current.copy(actor.position);

      if (p >= 1 && !completedRef.current) {
        completedRef.current = true;
        onBoarded();
      }
    }
  });

  if (phase === 'sailing') return null;

  return (
    <group ref={actorRef} position={[-3.1, 1.08, 7.0]}>
      <PirateCharacter isWalking={phase === 'boarding'} />
    </group>
  );
}

export function WorldScene({
  phase,
  quality,
  isFirstPerson,
  cameraModeRequest,
  onZoomModeChange,
  onBoarded,
  shipTelemetryRef,
  nearbyIsland,
  activeModalIsland,
  onNearbyIslandChange,
  mobileInputRef,
  minigameActive,
  hitTargets,
  onHitTarget,
}: WorldSceneProps) {
  const shipPosRef = useRef({ x: 0, z: 0 });
  const boardingProgressRef = useRef(0);
  const boardingCharPosRef = useRef(new THREE.Vector3(-3.1, 1.08, 7.0));

  return (
    <Canvas
      className="h-full w-full"
      // En modo Canaima fijamos DPR=1 para máximo rendimiento en GPUs integradas
      dpr={quality === 'canaima' ? 1 : [1, 1.5]}
      gl={{
        antialias: quality === 'high',
        powerPreference: 'high-performance',
      }}
      camera={{ fov: 58, near: 0.2, far: 320, position: [-8.5, 4, 9.8] }}
    >
      {/* Atardecer cálido estilizado */}
      <color attach="background" args={['#2b1e3e']} />
      <fog attach="fog" args={['#3b284e', 75, 225]} />

      {/* Iluminación limpia sin ShadowMaps costosos */}
      <hemisphereLight args={['#ffb07c', '#134e5e', 1.15]} />
      <directionalLight position={[45, 32, -85]} intensity={2.1} color="#ffd199" />
      <directionalLight position={[-30, 15, 40]} intensity={0.45} color="#7dd3fc" />

      {/* Sol estilizado en el horizonte */}
      <mesh position={[0, 28, -210]}>
        <circleGeometry args={[24, 20]} />
        <meshBasicMaterial color="#ffb703" fog={false} />
      </mesh>

      <Ocean quality={quality} shipPosRef={shipPosRef} />
      <HomeDock quality={quality} />

      <BoardingActor
        phase={phase}
        onBoarded={onBoarded}
        boardingProgressRef={boardingProgressRef}
        boardingCharPosRef={boardingCharPosRef}
      />

      <PirateShip
        phase={phase}
        quality={quality}
        isFirstPerson={isFirstPerson}
        shipTelemetryRef={shipTelemetryRef}
        shipPosRef={shipPosRef}
        activeModalIsland={activeModalIsland}
        onNearbyIslandChange={onNearbyIslandChange}
        mobileInputRef={mobileInputRef}
      />

      <Islands
        quality={quality}
        nearbyIsland={nearbyIsland}
        minigameActive={minigameActive}
        hitTargets={hitTargets}
        onHitTarget={onHitTarget}
      />

      <CameraRig
        phase={phase}
        cameraModeRequest={cameraModeRequest}
        onZoomModeChange={onZoomModeChange}
        shipTelemetryRef={shipTelemetryRef}
        boardingProgressRef={boardingProgressRef}
        boardingCharPosRef={boardingCharPosRef}
      />
    </Canvas>
  );
}
