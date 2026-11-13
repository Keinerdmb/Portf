import { useCallback, useEffect, useRef, useState } from 'react';
import { CompassHud } from './components/hud/CompassHud';
import { IslandModal } from './components/hud/IslandModal';
import { OceanControlsPanel } from './components/hud/OceanControlsPanel';
import { TitleOverlay } from './components/hud/TitleOverlay';
import { WorldMapModal } from './components/hud/WorldMapModal';
import { WorldScene } from './components/three/WorldScene';
import type {
  GamePhase,
  IslandData,
  IslandId,
  OceanParams,
  ShipTelemetry,
} from './types/portfolio';
import { DEFAULT_OCEAN_PARAMS } from './utils/oceanMath';
import {
  playCannonHit,
  playHullBump,
  playStartHorn,
  playTone,
} from './utils/sound';

const TOTAL_TARGETS = 4;

export function App() {
  const [phase, setPhase] = useState<GamePhase>('title');
  const [sfxEnabled, setSfxEnabled] = useState(false);

  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const [cameraModeRequest, setCameraModeRequest] = useState<{
    zoom: number;
    nonce: number;
  } | null>(null);

  const [nearbyIsland, setNearbyIsland] = useState<IslandId | null>(null);
  const [activeModalIsland, setActiveModalIsland] = useState<IslandId | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const [oceanPanelOpen, setOceanPanelOpen] = useState(false);
  const [oceanParams, setOceanParams] = useState<OceanParams>(DEFAULT_OCEAN_PARAMS);
  const oceanParamsRef = useRef<OceanParams>(DEFAULT_OCEAN_PARAMS);

  const [minigameActive, setMinigameActive] = useState(false);
  const [hitTargets, setHitTargets] = useState<number[]>([]);

  const shipTelemetryRef = useRef<ShipTelemetry>({
    x: 0,
    y: 0,
    velY: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    pitchVel: 0,
    roll: 0,
    rollVel: 0,
    speed: 0,
    steerAngle: 0,
    windAlignment: 0,
  });

  const mobileInputRef = useRef({ forward: 0, turn: 0 });

  const handleOceanParamsChange = (next: OceanParams) => {
    oceanParamsRef.current = next;
    setOceanParams(next);
  };

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

  const handleToggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    if (next) playTone(true, 587, 0.08);
  };

  const handleHullCollision = useCallback(() => {
    playHullBump(sfxEnabled);
  }, [sfxEnabled]);

  const handleFastTravel = (island: IslandData) => {
    playTone(sfxEnabled, 480, 0.1);
    shipTelemetryRef.current.x = island.position[0];
    shipTelemetryRef.current.z = island.position[1] + (island.dockRadius - 3);
    shipTelemetryRef.current.heading = 0;
    shipTelemetryRef.current.speed = 0;
    shipTelemetryRef.current.steerAngle = 0;
    setMapOpen(false);
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setActiveModalIsland(null);
        setMapOpen(false);
        setOceanPanelOpen(false);
        return;
      }

      if (
        e.code === 'KeyE' &&
        phase === 'sailing' &&
        nearbyIsland &&
        !activeModalIsland &&
        !mapOpen
      ) {
        playTone(sfxEnabled, 520, 0.08);
        setActiveModalIsland(nearbyIsland);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, nearbyIsland, activeModalIsland, mapOpen, sfxEnabled]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#f6bfa0]">
      <WorldScene
        phase={phase}
        isFirstPerson={isFirstPerson}
        cameraModeRequest={cameraModeRequest}
        onZoomModeChange={setIsFirstPerson}
        onBoarded={handleBoarded}
        shipTelemetryRef={shipTelemetryRef}
        oceanParamsRef={oceanParamsRef}
        nearbyIsland={nearbyIsland}
        activeModalIsland={activeModalIsland}
        onNearbyIslandChange={setNearbyIsland}
        onHullCollision={handleHullCollision}
        mobileInputRef={mobileInputRef}
        minigameActive={minigameActive}
        hitTargets={hitTargets}
        onHitTarget={handleHitTarget}
      />

      {phase === 'title' && <TitleOverlay onStart={handleStart} />}

      {phase === 'boarding' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 text-center">
          <span className="rounded-full border border-amber-300/35 bg-slate-950/75 px-5 py-2 font-mono text-xs tracking-widest text-amber-200">
            ABORDANDO EL NAVÍO...
          </span>
        </div>
      )}

      {phase === 'sailing' && (
        <CompassHud
          shipTelemetryRef={shipTelemetryRef}
          oceanParamsRef={oceanParamsRef}
          isFirstPerson={isFirstPerson}
          onToggleCamera={handleToggleCamera}
          sfxEnabled={sfxEnabled}
          onToggleSfx={handleToggleSfx}
          onOpenMap={() => {
            playTone(sfxEnabled, 400, 0.06);
            setMapOpen((prev) => !prev);
          }}
          oceanPanelOpen={oceanPanelOpen}
          onToggleOceanPanel={() => {
            playTone(sfxEnabled, 450, 0.06);
            setOceanPanelOpen((prev) => !prev);
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

      {oceanPanelOpen && phase === 'sailing' && (
        <OceanControlsPanel
          params={oceanParams}
          onChange={handleOceanParamsChange}
          onClose={() => setOceanPanelOpen(false)}
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

      {mapOpen && (
        <WorldMapModal
          shipTelemetryRef={shipTelemetryRef}
          onClose={() => setMapOpen(false)}
          onFastTravel={handleFastTravel}
        />
      )}
    </div>
  );
}

export default App;
