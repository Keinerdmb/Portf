import { useEffect, useRef } from 'react';
import { ISLANDS } from '../../data/islands';
import type { IslandId, OceanParams, ShipTelemetry } from '../../types/portfolio';

interface CompassHudProps {
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  oceanParamsRef: React.RefObject<OceanParams>;
  isFirstPerson: boolean;
  onToggleCamera: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  onOpenMap: () => void;
  oceanPanelOpen: boolean;
  onToggleOceanPanel: () => void;
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
  oceanParamsRef,
  isFirstPerson,
  onToggleCamera,
  sfxEnabled,
  onToggleSfx,
  onOpenMap,
  oceanPanelOpen,
  onToggleOceanPanel,
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

  // Actualizamos brújula y viento directo en DOM vía rAF para cero re-renders
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const ship = shipTelemetryRef.current;
      const params = oceanParamsRef.current;

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
        const relWindDeg = ((ship.heading + params.currentAngle) * 180) / Math.PI;
        windArrowRef.current.style.transform = `rotate(${relWindDeg}deg)`;
      }

      if (windKnotsRef.current) {
        const boost = ship.windAlignment > 0.35 ? ' · VIENTO A FAVOR' : '';
        windKnotsRef.current.textContent = `${Math.round(params.windSpeed)} KT${boost}`;
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
  }, [shipTelemetryRef, oceanParamsRef]);

  const activeNearby = ISLANDS.find((i) => i.id === nearbyIsland);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* Barra superior: Viento + Brújula estilo cinta náutica + Acciones */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Indicador de Viento */}
        <div className="hidden items-center gap-2 rounded-full border border-[#FFD699]/30 bg-[#211926]/65 px-3 py-1.5 backdrop-blur-[2px] sm:flex">
          <span
            ref={windArrowRef}
            className="inline-block font-mono text-sm leading-none text-[#FFD699]"
          >
            ↑
          </span>
          <span
            ref={windKnotsRef}
            className="font-mono text-[11px] tracking-wider text-[#FFF2C6]"
          >
            11 KT
          </span>
        </div>

        {/* Brújula central estilo cinta náutica */}
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-1">
          <div className="relative flex w-full items-center justify-center">
            {/* Extremo izquierdo de cinta */}
            <svg
              viewBox="0 0 24 28"
              className="h-7 w-5 shrink-0 text-[#FFD699]/45"
              fill="none"
            >
              <path
                d="M24 2H4L11 14L4 26H24"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="rgba(33, 25, 38, 0.58)"
              />
            </svg>

            <div className="relative h-7 flex-1 overflow-hidden border-y border-[#FFD699]/45 bg-[#211926]/58 px-3 backdrop-blur-[1px]">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-[#FD8457]" />

              {ISLANDS.map((island, idx) => (
                <div
                  key={island.id}
                  ref={(el) => {
                    markerRefs.current[idx] = el;
                  }}
                  className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
                >
                  <span
                    className="h-2.5 w-2.5 rotate-45 border border-[#FFFDF7]/85"
                    style={{ backgroundColor: island.accentColor }}
                  />
                </div>
              ))}
            </div>

            {/* Extremo derecho de cinta */}
            <svg
              viewBox="0 0 24 28"
              className="h-7 w-5 shrink-0 text-[#FFD699]/45"
              fill="none"
            >
              <path
                d="M0 2H20L13 14L20 26H0"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="rgba(33, 25, 38, 0.58)"
              />
            </svg>
          </div>
          <span
            ref={headingTextRef}
            className="font-mono text-[11px] tracking-widest text-[#FFF2C6] drop-shadow"
          >
            N 0°
          </span>
        </div>

        {/* Acciones rápidas */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenMap}
            className="cursor-pointer rounded border border-[#FFD699]/50 bg-[#211926]/70 px-3 py-1.5 font-mono text-xs text-[#FFD699] transition hover:bg-[#FFD699] hover:text-[#211926]"
          >
            MAPA
          </button>
          <button
            type="button"
            onClick={onToggleOceanPanel}
            className={`cursor-pointer rounded border px-3 py-1.5 font-mono text-xs transition ${
              oceanPanelOpen
                ? 'border-[#FD8457] bg-[#FD8457] text-[#211926]'
                : 'border-[#FD8457]/55 bg-[#211926]/70 text-[#FFD699] hover:border-[#FD8457]'
            }`}
          >
            OLAS / VIENTO
          </button>
          <button
            type="button"
            onClick={onToggleCamera}
            className="cursor-pointer rounded border border-[#F1C2B2]/35 bg-[#211926]/70 px-3 py-1.5 font-mono text-xs text-[#FFF2C6] transition hover:border-[#FFD699] hover:text-[#FFD699]"
          >
            {isFirstPerson ? '1RA PERSONA' : '3RA PERSONA'}
          </button>
          <button
            type="button"
            onClick={onToggleSfx}
            className="cursor-pointer rounded border border-[#F1C2B2]/35 bg-[#211926]/70 px-2.5 py-1.5 font-mono text-xs text-[#FFF2C6] transition hover:border-[#F1C2B2]/75"
          >
            SFX: {sfxEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Centro inferior: aviso de isla / mini-juego */}
      <div className="flex flex-col items-center gap-3">
        {minigameActive && (
          <div className="pointer-events-auto flex items-center gap-4 rounded-lg border border-[#FD8457]/55 bg-[#211926]/88 px-5 py-2.5">
            <div className="font-mono text-xs text-[#FFD699]">
              MINI-JUEGO: HAZ CLIC EN LOS BARRILES CORAL ({minigameScore}/{minigameTotal})
            </div>
            <button
              type="button"
              onClick={onStopMinigame}
              className="cursor-pointer rounded border border-[#F1C2B2]/30 px-2.5 py-1 font-mono text-[11px] text-[#FFF2C6] hover:bg-[#FFF2C6]/10"
            >
              SALIR
            </button>
          </div>
        )}

        {activeNearby && !minigameActive && (
          <button
            type="button"
            onClick={() => onOpenIsland(activeNearby.id)}
            className="pointer-events-auto cursor-pointer rounded-lg border-2 border-[#FFD699] bg-[#211926]/85 px-6 py-3 font-mono text-xs font-semibold tracking-wider text-[#FFF2C6] shadow-[0_0_25px_rgba(253,132,87,0.35)] transition hover:scale-105 hover:bg-[#FFD699] hover:text-[#211926] sm:text-sm"
          >
            [E] DESEMBARCAR EN {activeNearby.name}
          </button>
        )}

        {/* Pie: controles discretos */}
        <div className="flex w-full items-end justify-between gap-4">
          <div className="hidden font-mono text-[11px] text-[#FFF2C6]/90 drop-shadow sm:block">
            [WASD / FLECHAS] TIMÓN · [ARRASTRAR] CÁMARA · [C] CENTRAR · [E] ENTRAR
          </div>

          <div className="hidden font-display text-xs tracking-wider text-[#FFF2C6]/90 drop-shadow sm:block">
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
              className="rounded border border-[#F1C2B2]/30 bg-[#211926]/85 px-3 py-2 font-mono text-xs text-[#FFF2C6]"
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
              className="rounded border border-[#FFD699]/55 bg-[#211926]/85 px-4 py-2 font-mono text-xs text-[#FFD699]"
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
              className="rounded border border-[#F1C2B2]/30 bg-[#211926]/85 px-3 py-2 font-mono text-xs text-[#FFF2C6]"
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
