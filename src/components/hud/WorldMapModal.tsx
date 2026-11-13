import { ISLANDS } from '../../data/islands';
import type { IslandData } from '../../types/portfolio';

interface WorldMapModalProps {
  shipPosition: { x: number; z: number };
  onClose: () => void;
  onFastTravel: (island: IslandData) => void;
}

export function WorldMapModal({
  shipPosition,
  onClose,
  onFastTravel,
}: WorldMapModalProps) {
  // Mapeamos coordenadas del mundo [-140, 140] a porcentaje del mapa [0%, 100%]
  const toMapPct = (val: number, min: number, max: number) =>
    Math.max(8, Math.min(92, ((val - min) / (max - min)) * 100));

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-xl rounded-xl border border-amber-300/35 bg-[#121625]/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <p className="font-mono text-[11px] tracking-widest text-amber-300 uppercase">
              Carta Náutica
            </p>
            <h2 className="font-display text-xl font-bold text-amber-50">
              MAPA DEL ARCHIPIÉLAGO
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded border border-white/20 px-3 py-1 font-mono text-xs text-slate-300 hover:border-amber-400"
          >
            CERRAR
          </button>
        </div>

        {/* Radar visual + botones de Fast Travel */}
        <div className="relative mt-5 h-64 w-full overflow-hidden rounded-lg border border-sky-400/20 bg-[#0b172a]">
          {/* Cuadrícula náutica sutil */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Posición actual del barco */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${toMapPct(shipPosition.x, -110, 110)}%`,
              top: `${toMapPct(shipPosition.z, -140, 50)}%`,
            }}
            title="Tu barco"
          >
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-400 shadow-[0_0_10px_#fbbf24]" />
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
                className="mx-auto block h-4 w-4 rotate-45 border border-white/80 transition group-hover:scale-125"
                style={{ backgroundColor: island.accentColor }}
              />
              <span className="mt-1 block rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-200 group-hover:text-amber-300">
                {island.name}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-center font-mono text-xs text-slate-400">
          Haz clic en cualquier isla para viajar rápido frente a su costa.
        </p>
      </div>
    </div>
  );
}
