import { useEffect, useRef } from 'react';
import { ISLANDS } from '../../data/islands';
import type { IslandId, QualityMode, ShipTelemetry } from '../../types/portfolio';

interface CompassHudProps {
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  isFirstPerson: boolean;
  onToggleCamera: () => void;
  quality: QualityMode;
  onToggleQuality: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  onOpenMap: () => void;
  nearbyIsland: IslandId | null;
  onOpenIsland: (id: IslandId) => void;
  minigameActive: boolean;
  minigameScore: number;
  minigameTotal: number;
  onStopMinigame: () => void;
  mobileInputRef: React.RefObject<{ forward: number; turn: number }>;
}

export function CompassHud({
  shipTelemetryRef,
  isFirstPerson,
  onToggleCamera,
  quality,
  onToggleQuality,
  sfxEnabled,
  onToggleSfx,
  onOpenMap,
  nearbyIsland,
  onOpenIsland,
  minigameActive,
  minigameScore,
  minigameTotal,
  onStopMinigame,
  mobileInputRef,
}: CompassHudProps) {
  const headingTextRef = useRef<HTMLSpanElement>(null);
  const markerRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Actualizamos la brújula directo en el DOM vía rAF para no re-renderizar React 60 veces/seg
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const ship = shipTelemetryRef.current;
      // Convertimos heading (0 = Norte) a grados [0, 360)
      const deg = ((-ship.heading * 180) / Math.PI) % 360;
      const normalizedDeg = (deg + 360) % 360;

      if (headingTextRef.current) {
        const cardinal =
          normalizedDeg < 22.5 || normalizedDeg >= 337.5
            ? 'N'
            : normalizedDeg < 67.5
              ? 'NE'
              : normalizedDeg < 112.5
                ? 'E'
                : normalizedDeg < 157.5
                  ? 'SE'
                  : normalizedDeg < 202.5
                    ? 'S'
                    : normalizedDeg < 247.5
                      ? 'SO'
                      : normalizedDeg < 292.5
                        ? 'O'
                        : 'NO';
        headingTextRef.current.textContent = `${cardinal} ${Math.round(normalizedDeg)}°`;
      }

      // Posicionamos el marcador de cada isla en la barra horizontal [-90°, +90°] respecto a donde miras
      ISLANDS.forEach((island, idx) => {
        const el = markerRefs.current[idx];
        if (!el) return;
        const dx = island.position[0] - ship.x;
        const dz = island.position[1] - ship.z;
        // Ángulo hacia la isla (0 = -Z Norte, +PI/2 = +X Este)
        const angleToIsland = Math.atan2(dx, -dz);
        const shipAngle = -ship.heading;
        let diff = angleToIsland - shipAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const maxFov = Math.PI * 0.55;
        const clamped = Math.max(-1, Math.min(1, diff / maxFov));
        const pct = 50 + clamped * 46;
        el.style.left = `${pct}%`;
        el.style.opacity = Math.abs(diff) > maxFov ? '0.35' : '1';
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [shipTelemetryRef]);

  const activeNearby = ISLANDS.find((i) => i.id === nearbyIsland);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* Barra superior: Brújula + Botones rápidos */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="hidden font-mono text-xs text-amber-200/80 sm:block">
          CAPITÁN KEINER
        </div>

        {/* Brújula minimalista central */}
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-1">
          <div className="relative h-7 w-full overflow-hidden rounded-full border border-white/15 bg-slate-950/65 px-3">
            {/* Línea central de mira */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-amber-300/80" />

            {ISLANDS.map((island, idx) => (
              <div
                key={island.id}
                ref={(el) => {
                  markerRefs.current[idx] = el;
                }}
                className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
              >
                <span
                  className="h-2.5 w-2.5 rotate-45 border border-white/60"
                  style={{ backgroundColor: island.accentColor }}
                />
              </div>
            ))}
          </div>
          <span
            ref={headingTextRef}
            className="font-mono text-[11px] tracking-wider text-amber-200/90"
          >
            N 0°
          </span>
        </div>

        {/* Acciones rápidas */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenMap}
            className="cursor-pointer rounded border border-amber-400/50 bg-slate-950/75 px-3 py-1.5 font-mono text-xs text-amber-300 transition hover:bg-amber-400 hover:text-slate-950"
          >
            MAPA
          </button>
          <button
            type="button"
            onClick={onToggleCamera}
            className="cursor-pointer rounded border border-white/20 bg-slate-950/75 px-3 py-1.5 font-mono text-xs text-slate-200 transition hover:border-sky-400 hover:text-sky-300"
          >
            {isFirstPerson ? '1RA PERSONA' : '3RA PERSONA'}
          </button>
          <button
            type="button"
            onClick={onToggleQuality}
            className="cursor-pointer rounded border border-white/20 bg-slate-950/75 px-2.5 py-1.5 font-mono text-xs text-slate-300 transition hover:border-emerald-400 hover:text-emerald-300"
            title="Cambiar modo de rendimiento gráfico"
          >
            {quality === 'canaima' ? 'CANAIMA' : 'ALTO'}
          </button>
          <button
            type="button"
            onClick={onToggleSfx}
            className="cursor-pointer rounded border border-white/20 bg-slate-950/75 px-2.5 py-1.5 font-mono text-xs text-slate-300 transition hover:border-white/50"
          >
            SFX: {sfxEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Prompt central cuando el mini-juego está activo o cuando estás cerca de una isla */}
      <div className="flex flex-col items-center gap-3">
        {minigameActive && (
          <div className="pointer-events-auto flex items-center gap-4 rounded-lg border border-rose-400/50 bg-slate-950/85 px-5 py-2.5">
            <div className="font-mono text-xs text-rose-200">
              MINI-JUEGO: HAZ CLIC EN LOS BARRILES ROJOS ({minigameScore}/{minigameTotal})
            </div>
            <button
              type="button"
              onClick={onStopMinigame}
              className="cursor-pointer rounded border border-white/20 px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:bg-white/10"
            >
              SALIR
            </button>
          </div>
        )}

        {activeNearby && !minigameActive && (
          <button
            type="button"
            onClick={() => onOpenIsland(activeNearby.id)}
            className="pointer-events-auto cursor-pointer rounded-lg border-2 border-amber-300 bg-slate-950/85 px-6 py-3 font-mono text-xs font-semibold tracking-wider text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.3)] transition hover:scale-105 hover:bg-amber-400 hover:text-slate-950 sm:text-sm"
          >
            [E] DESEMBARCAR EN {activeNearby.name}
          </button>
        )}

        {/* Pie: controles en desktop + pad táctil compacto en móvil */}
        <div className="flex w-full items-end justify-between gap-4">
          <div className="hidden rounded border border-white/10 bg-slate-950/55 px-3 py-2 font-mono text-[11px] text-slate-300 sm:block">
            [WASD / FLECHAS] TIMÓN · [RUEDA] ZOOM 1RA ↔ 3RA · [E] ENTRAR A ISLA
          </div>

          {/* Controles táctiles para móvil / mouse */}
          <div className="pointer-events-auto ml-auto flex items-center gap-1.5 sm:hidden">
            <button
              type="button"
              onPointerDown={() => {
                mobileInputRef.current.turn = 1;
              }}
              onPointerUp={() => {
                mobileInputRef.current.turn = 0;
              }}
              onPointerLeave={() => {
                mobileInputRef.current.turn = 0;
              }}
              className="rounded border border-white/20 bg-slate-950/80 px-3 py-2 font-mono text-xs"
            >
              ◀
            </button>
            <button
              type="button"
              onPointerDown={() => {
                mobileInputRef.current.forward = 1;
              }}
              onPointerUp={() => {
                mobileInputRef.current.forward = 0;
              }}
              onPointerLeave={() => {
                mobileInputRef.current.forward = 0;
              }}
              className="rounded border border-amber-400/50 bg-slate-950/80 px-4 py-2 font-mono text-xs text-amber-300"
            >
              AVANZAR
            </button>
            <button
              type="button"
              onPointerDown={() => {
                mobileInputRef.current.turn = -1;
              }}
              onPointerUp={() => {
                mobileInputRef.current.turn = 0;
              }}
              onPointerLeave={() => {
                mobileInputRef.current.turn = 0;
              }}
              className="rounded border border-white/20 bg-slate-950/80 px-3 py-2 font-mono text-xs"
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
