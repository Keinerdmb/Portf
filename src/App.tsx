import { useCallback, useEffect, useRef, useState } from 'react';
import { CompassHud } from './components/hud/CompassHud';
import { IslandModal } from './components/hud/IslandModal';
import { TitleOverlay } from './components/hud/TitleOverlay';
import { WorldMapModal } from './components/hud/WorldMapModal';
import { WorldScene } from './components/three/WorldScene';
import type {
  GamePhase,
  IslandData,
  IslandId,
  QualityMode,
  ShipTelemetry,
} from './types/portfolio';
import { playCannonHit, playStartHorn, playTone } from './utils/sound';

const TOTAL_TARGETS = 4;

export function App() {
  const [phase, setPhase] = useState<GamePhase>('title');
  const [quality, setQuality] = useState<QualityMode>('canaima');
  const [sfxEnabled, setSfxEnabled] = useState(false);

  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const [cameraModeRequest, setCameraModeRequest] = useState<{
    zoom: number;
    nonce: number;
  } | null>(null);

  const [nearbyIsland, setNearbyIsland] = useState<IslandId | null>(null);
  const [activeModalIsland, setActiveModalIsland] = useState<IslandId | null>(null);
  const [mapShipPos, setMapShipPos] = useState<{ x: number; z: number } | null>(null);

  const [minigameActive, setMinigameActive] = useState(false);
  const [hitTargets, setHitTargets] = useState<number[]>([]);

  // Ref mutable para leer/escribir la posición del barco a 60 FPS sin re-renders
  const shipTelemetryRef = useRef<ShipTelemetry>({
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    steerAngle: 0,
  });

  const mobileInputRef = useRef({ forward: 0, turn: 0 });

  const handleStart = () => {
    playStartHorn(sfxEnabled);
    setPhase('boarding');
  };

  const handleBoarded = useCallback(() => {
    setPhase('sailing');
  }, []);

  const handleToggleCamera = () => {
    const nextFp = !isFirstPerson;
    playTone(sfxEnabled, nextFp ? 520 : 340, 0.07);
    setCameraModeRequest((prev) => ({
      zoom: nextFp ? 0 : 0.95,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  };

  const handleToggleQuality = () => {
    playTone(sfxEnabled, 440, 0.06);
    setQuality((prev) => (prev === 'canaima' ? 'high' : 'canaima'));
  };

  const handleToggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    if (next) playTone(true, 587, 0.08);
  };

  const handleFastTravel = (island: IslandData) => {
    playTone(sfxEnabled, 480, 0.1);
    // Colocamos el barco frente a la costa sur de la isla mirando hacia ella
    shipTelemetryRef.current.x = island.position[0];
    shipTelemetryRef.current.z = island.position[1] + (island.dockRadius - 3);
    shipTelemetryRef.current.heading = 0;
    shipTelemetryRef.current.speed = 0;
    shipTelemetryRef.current.steerAngle = 0;
    setMapShipPos(null);
    setNearbyIsland(island.id);
  };

  const handleStartMinigame = () => {
    playTone(sfxEnabled, 660, 0.12);
    setHitTargets([]);
    setMinigameActive(true);
    setActiveModalIsland(null);
  };

  const handleHitTarget = (idx: number) => {
    setHitTargets((prev) => {
      if (prev.includes(idx)) return prev;
      playCannonHit(sfxEnabled);
      const next = [...prev, idx];
      if (next.length === TOTAL_TARGETS) {
        setTimeout(() => {
          setMinigameActive(false);
          setActiveModalIsland('minigame');
        }, 450);
      }
      return next;
    });
  };

  // Atajos de teclado globales [E] para desembarcar y [ESC] para cerrar modales
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setActiveModalIsland(null);
        setMapShipPos(null);
        return;
      }

      if (
        e.code === 'KeyE' &&
        phase === 'sailing' &&
        nearbyIsland &&
        !activeModalIsland &&
        !mapShipPos
      ) {
        playTone(sfxEnabled, 520, 0.08);
        setActiveModalIsland(nearbyIsland);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, nearbyIsland, activeModalIsland, mapShipPos, sfxEnabled]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#120d1d]">
      <WorldScene
        phase={phase}
        quality={quality}
        isFirstPerson={isFirstPerson}
        cameraModeRequest={cameraModeRequest}
        onZoomModeChange={setIsFirstPerson}
        onBoarded={handleBoarded}
        shipTelemetryRef={shipTelemetryRef}
        nearbyIsland={nearbyIsland}
        activeModalIsland={activeModalIsland}
        onNearbyIslandChange={setNearbyIsland}
        mobileInputRef={mobileInputRef}
        minigameActive={minigameActive}
        hitTargets={hitTargets}
        onHitTarget={handleHitTarget}
      />

      {phase === 'title' && (
        <TitleOverlay
          quality={quality}
          onToggleQuality={handleToggleQuality}
          onStart={handleStart}
        />
      )}

      {phase === 'boarding' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 text-center">
          <span className="rounded-full border border-amber-300/30 bg-slate-950/75 px-5 py-2 font-mono text-xs tracking-widest text-amber-200">
            ABORDANDO EL NAVÍO...
          </span>
        </div>
      )}

      {phase === 'sailing' && (
        <CompassHud
          shipTelemetryRef={shipTelemetryRef}
          isFirstPerson={isFirstPerson}
          onToggleCamera={handleToggleCamera}
          quality={quality}
          onToggleQuality={handleToggleQuality}
          sfxEnabled={sfxEnabled}
          onToggleSfx={handleToggleSfx}
          onOpenMap={() => {
            playTone(sfxEnabled, 400, 0.06);
            setMapShipPos({
              x: shipTelemetryRef.current.x,
              z: shipTelemetryRef.current.z,
            });
          }}
          nearbyIsland={nearbyIsland}
          onOpenIsland={(id) => {
            playTone(sfxEnabled, 520, 0.08);
            setActiveModalIsland(id);
          }}
          minigameActive={minigameActive}
          minigameScore={hitTargets.length}
          minigameTotal={TOTAL_TARGETS}
          onStopMinigame={() => setMinigameActive(false)}
          mobileInputRef={mobileInputRef}
        />
      )}

      {activeModalIsland && (
        <IslandModal
          islandId={activeModalIsland}
          onClose={() => setActiveModalIsland(null)}
          onStartMinigame={handleStartMinigame}
          minigameScore={hitTargets.length}
          minigameTotal={TOTAL_TARGETS}
        />
      )}

      {mapShipPos && (
        <WorldMapModal
          shipPosition={mapShipPos}
          onClose={() => setMapShipPos(null)}
          onFastTravel={handleFastTravel}
        />
      )}
    </div>
  );
}

export default App;
