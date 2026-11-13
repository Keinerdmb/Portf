import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { GamePhase, IslandId, ShipTelemetry } from '../../types/portfolio';
import { CameraRig } from './CameraRig';
import { HomeDock } from './HomeDock';
import { Islands } from './Islands';
import { Ocean } from './Ocean';
import { PirateCharacter } from './PirateCharacter';
import { PirateShip } from './PirateShip';
import { SkyDome } from './SkyDome';
import { WakeTrail } from './WakeTrail';
import { WindAndSkyLife } from './WindAndSkyLife';

interface WorldSceneProps {
  phase: GamePhase;
  isFirstPerson: boolean;
  cameraModeRequest: { zoom: number; nonce: number } | null;
  onZoomModeChange: (isFirstPerson: boolean) => void;
  onBoarded: () => void;
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  nearbyIsland: IslandId | null;
  activeModalIsland: IslandId | null;
  onNearbyIslandChange: (islandId: IslandId | null) => void;
  onHullCollision: () => void;
  mobileInputRef: React.RefObject<{ forward: number; turn: number }>;
  minigameActive: boolean;
  hitTargets: number[];
  onHitTarget: (idx: number) => void;
}

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

      if (p < 0.55) {
        const t1 = p / 0.55;
        actor.position.x = THREE.MathUtils.lerp(-3.1, -2.5, t1);
        actor.position.y = 1.08;
        actor.position.z = THREE.MathUtils.lerp(7.0, 1.95, t1);
        actor.rotation.y = Math.PI;
      } else {
        const t2 = (p - 0.55) / 0.45;
        actor.position.x = THREE.MathUtils.lerp(-2.5, 0, t2);
        actor.position.y = THREE.MathUtils.lerp(1.08, 1.15, t2);
        actor.position.z = 1.95;
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
  isFirstPerson,
  cameraModeRequest,
  onZoomModeChange,
  onBoarded,
  shipTelemetryRef,
  nearbyIsland,
  activeModalIsland,
  onNearbyIslandChange,
  onHullCollision,
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
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      camera={{ fov: 60, near: 0.2, far: 900, position: [-9.0, 4.1, 10.2] }}
    >
      {/* Fondo pastel cálido y neblina atmosférica suave estilo Steven Universe */}
      <color attach="background" args={['#f6bfa0']} />
      <fog attach="fog" args={['#f3b59e', 110, 310]} />

      {/* Iluminación pastel luminosa */}
      <hemisphereLight args={['#ffd9e2', '#2ec4b6', 1.35]} />
      <directionalLight position={[-45, 34, -140]} intensity={2.1} color="#ffe4b5" />
      <directionalLight position={[50, 24, 60]} intensity={0.65} color="#a5f3fc" />

      <SkyDome />
      <Ocean shipPosRef={shipPosRef} />
      <HomeDock />
      <WindAndSkyLife shipPosRef={shipPosRef} />
      <WakeTrail shipTelemetryRef={shipTelemetryRef} />

      <BoardingActor
        phase={phase}
        onBoarded={onBoarded}
        boardingProgressRef={boardingProgressRef}
        boardingCharPosRef={boardingCharPosRef}
      />

      <PirateShip
        phase={phase}
        isFirstPerson={isFirstPerson}
        shipTelemetryRef={shipTelemetryRef}
        shipPosRef={shipPosRef}
        activeModalIsland={activeModalIsland}
        onNearbyIslandChange={onNearbyIslandChange}
        onHullCollision={onHullCollision}
        mobileInputRef={mobileInputRef}
      />

      <Islands
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
