import { useEffect, useRef } from 'react';
import { ISLANDS } from '../../data/islands';
import type { IslandId, ShipTelemetry } from '../../types/portfolio';
import { getWindState } from '../../utils/oceanMath';

interface CompassHudProps {
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  isFirstPerson: boolean;
  onToggleCamera: () => void;
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
  const windArrowRef = useRef<HTMLSpanElement>(null);
  const windKnotsRef = useRef<HTMLSpanElement>(null);
  const markerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const startTimeRef = useRef<number | null>(null);

  // Actualizamos brújula y viento directo en DOM vía rAF para cero re-renders
  useEffect(() => {
    let rafId = 0;

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsedSec = (now - startTimeRef.current) / 1000;
      const ship = shipTelemetryRef.current;
      const wind = getWindState(elapsedSec);

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

      if (windArrowRef.current) {
        // Ángulo relativo del viento respecto a la proa del barco
        const relWindDeg = ((ship.heading - wind.angle) * 180) / Math.PI;
        windArrowRef.current.style.transform = `rotate(${relWindDeg}deg)`;
      }

      if (windKnotsRef.current) {
        const boost = ship.windAlignment > 0.35 ? ' · VIENTO A FAVOR' : '';
        windKnotsRef.current.textContent = `${Math.round(wind.knots)} KT${boost}`;
      }

      ISLANDS.forEach((island, idx) => {
        const el = markerRefs.current[idx];
        if (!el) return;
        const dx = island.position[0] - ship.x;
        const dz = island.position[1] - ship.z;
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
      {/* Barra superior: Viento + Brújula estilo cinta náutica + Acciones */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Indicador de Viento */}
        <div className="hidden items-center gap-2 rounded-full border border-amber-100/25 bg-slate-950/55 px-3 py-1.5 backdrop-blur-[2px] sm:flex">
          <span
            ref={windArrowRef}
            className="inline-block font-mono text-sm leading-none text-amber-300"
          >
            ↑
          </span>
          <span
            ref={windKnotsRef}
            className="font-mono text-[11px] tracking-wider text-amber-100/90"
          >
            11 KT
          </span>
        </div>

        {/* Brújula central limpia estilo cinta de la referencia */}
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-1">
          <div className="relative h-7 w-full overflow-hidden rounded-full border border-amber-100/35 bg-slate-950/55 px-3">
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-amber-300/90" />

            {ISLANDS.map((island, idx) => (
              <div
                key={island.id}
                ref={(el) => {
                  markerRefs.current[idx] = el;
                }}
                className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
              >
                <span
                  className="h-2.5 w-2.5 rotate-45 border border-white/80"
                  style={{ backgroundColor: island.accentColor }}
                />
              </div>
            ))}
          </div>
          <span
            ref={headingTextRef}
            className="font-mono text-[11px] tracking-widest text-amber-100 drop-shadow"
          >
            N 0°
          </span>
        </div>

        {/* Acciones rápidas */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenMap}
            className="cursor-pointer rounded border border-amber-300/50 bg-slate-950/65 px-3 py-1.5 font-mono text-xs text-amber-200 transition hover:bg-amber-300 hover:text-slate-950"
          >
            MAPA
          </button>
          <button
            type="button"
            onClick={onToggleCamera}
            className="cursor-pointer rounded border border-white/25 bg-slate-950/65 px-3 py-1.5 font-mono text-xs text-slate-100 transition hover:border-amber-300 hover:text-amber-200"
          >
            {isFirstPerson ? '1RA PERSONA' : '3RA PERSONA'}
          </button>
          <button
            type="button"
            onClick={onToggleSfx}
            className="cursor-pointer rounded border border-white/25 bg-slate-950/65 px-2.5 py-1.5 font-mono text-xs text-slate-200 transition hover:border-white/60"
          >
            SFX: {sfxEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Centro inferior: aviso de isla / mini-juego */}
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
            className="pointer-events-auto cursor-pointer rounded-lg border-2 border-amber-300 bg-slate-950/80 px-6 py-3 font-mono text-xs font-semibold tracking-wider text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.3)] transition hover:scale-105 hover:bg-amber-300 hover:text-slate-950 sm:text-sm"
          >
            [E] DESEMBARCAR EN {activeNearby.name}
          </button>
        )}

        {/* Pie: controles discretos en la esquina derecha como la imagen de referencia */}
        <div className="flex w-full items-end justify-between gap-4">
          <div className="hidden font-mono text-[11px] text-amber-50/85 drop-shadow sm:block">
            [WASD / FLECHAS] TIMÓN · [E] DESEMBARCAR
          </div>

          <div className="hidden font-display text-xs tracking-wider text-amber-50/90 drop-shadow sm:block">
            [SCROLL: 1ST / 3RD PERSON]
          </div>

          {/* Controles táctiles en móvil */}
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
