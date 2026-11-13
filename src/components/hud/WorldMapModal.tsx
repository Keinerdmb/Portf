import { useEffect, useRef } from 'react';
import { ISLANDS } from '../../data/islands';
import type { IslandData, ShipTelemetry } from '../../types/portfolio';

interface WorldMapModalProps {
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  onClose: () => void;
  onFastTravel: (island: IslandData) => void;
}

const toMapPct = (val: number, min: number, max: number) =>
  Math.max(6, Math.min(94, ((val - min) / (max - min)) * 100));

export function WorldMapModal({
  shipTelemetryRef,
  onClose,
  onFastTravel,
}: WorldMapModalProps) {
  const shipMarkerRef = useRef<HTMLDivElement>(null);
  const coordsLabelRef = useRef<HTMLSpanElement>(null);

  // Actualizamos en tiempo real la ubicación y orientación del barco sobre el mapa sin re-renders
  useEffect(() => {
    let rafId = 0;

    const updateMarker = () => {
      const ship = shipTelemetryRef.current;
      if (shipMarkerRef.current) {
        const left = toMapPct(ship.x, -110, 110);
        const top = toMapPct(ship.z, -140, 50);
        const deg = (-ship.heading * 180) / Math.PI;
        shipMarkerRef.current.style.left = `${left}%`;
        shipMarkerRef.current.style.top = `${top}%`;
        shipMarkerRef.current.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
      }

      if (coordsLabelRef.current) {
        coordsLabelRef.current.textContent = `POS (${Math.round(ship.x)}, ${Math.round(ship.z)}) · ${Math.abs(Math.round(ship.speed))} KT`;
      }

      rafId = requestAnimationFrame(updateMarker);
    };

    rafId = requestAnimationFrame(updateMarker);
    return () => cancelAnimationFrame(rafId);
  }, [shipTelemetryRef]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#211926]/65 p-4">
      <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-[#FFD699]/35 bg-[#211926]/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F1C2B2]/15 pb-3">
          <div>
            <p className="font-mono text-[11px] tracking-widest text-[#FFD699] uppercase">
              Carta Náutica en Vivo
            </p>
            <h2 className="font-display text-xl font-bold text-[#FFF2C6]">
              MAPA DEL ARCHIPIÉLAGO
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded border border-[#F1C2B2]/25 px-3 py-1 font-mono text-xs text-[#F7D0B3] hover:border-[#FFD699] hover:text-[#FFD699]"
          >
            CERRAR [ESC]
          </button>
        </div>

        {/* Radar visual + ubicación en vivo del barco */}
        <div className="relative mt-5 h-64 w-full overflow-hidden rounded-lg border border-[#F1C2B2]/25 bg-[#2E2332]">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, #FFD699 1px, transparent 1px), linear-gradient(to bottom, #FFD699 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Marcador del puerto de salida */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
            style={{
              left: `${toMapPct(0, -110, 110)}%`,
              top: `${toMapPct(0, -140, 50)}%`,
            }}
          >
            <span className="mx-auto block h-2.5 w-2.5 rounded-full border border-[#FFD699]/75 bg-[#8C5D53]" />
            <span className="mt-0.5 block font-mono text-[9px] text-[#F1C2B2]">
              MUELLE
            </span>
          </div>

          {/* Ubicación en tiempo real del barco (flecha direccional) */}
          <div
            ref={shipMarkerRef}
            className="absolute z-10"
            style={{ left: '50%', top: '75%' }}
            title="Tu barco en vivo"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-[#FD8457] drop-shadow-[0_0_8px_rgba(255,214,153,0.9)]"
              fill="currentColor"
            >
              <path d="M12 2L19 20L12 16L5 20L12 2Z" />
            </svg>
          </div>

          {/* Islas clicables */}
          {ISLANDS.map((island) => (
            <button
              key={island.id}
              type="button"
              onClick={() => onFastTravel(island)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer text-center"
              style={{
                left: `${toMapPct(island.position[0], -110, 110)}%`,
                top: `${toMapPct(island.position[1], -140, 50)}%`,
              }}
            >
              <span
                className="mx-auto block h-4 w-4 rotate-45 border border-[#FFFDF7]/85 transition group-hover:scale-125"
                style={{ backgroundColor: island.accentColor }}
              />
              <span className="mt-1 block rounded bg-[#211926]/85 px-1.5 py-0.5 font-mono text-[10px] text-[#FFF2C6] group-hover:text-[#FFD699]">
                {island.name}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-[#F1C2B2]/80">
          <span ref={coordsLabelRef} className="text-[#FFD699]">
            POS (0, 0) · 0 KT
          </span>
          <span>Puedes seguir navegando o hacer clic en una isla</span>
        </div>
      </div>
    </div>
  );
}
