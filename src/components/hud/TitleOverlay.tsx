import type { QualityMode } from '../../types/portfolio';

interface TitleOverlayProps {
  quality: QualityMode;
  onToggleQuality: () => void;
  onStart: () => void;
}

export function TitleOverlay({
  quality,
  onToggleQuality,
  onStart,
}: TitleOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-10">
      {/* Esquina superior: selector de rendimiento para PCs modestas */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-widest text-amber-200/80">
          PORTFOLIO // 3D PROTOTYPE
        </span>

        <button
          type="button"
          onClick={onToggleQuality}
          className="pointer-events-auto cursor-pointer rounded-md border border-white/15 bg-slate-950/60 px-3 py-1.5 font-mono text-xs text-slate-200 transition hover:border-amber-400/60 hover:text-amber-300"
        >
          GRÁFICOS: {quality === 'canaima' ? 'CANAIMA (ULTRA FLUIDO)' : 'ALTO'}
        </button>
      </div>

      {/* Bloque central/izquierdo limpio estilo indie */}
      <div className="my-auto max-w-xl space-y-5">
        <p className="font-mono text-xs tracking-[0.28em] text-sky-300 uppercase">
          Travesía Interactiva
        </p>

        <h1 className="font-display text-4xl font-extrabold tracking-wider text-amber-50 drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)] sm:text-6xl">
          CAPITÁN KEINER
        </h1>

        <p className="max-w-md text-base text-slate-200/90 sm:text-lg">
          Full-Stack Developer. Toma el timón, explora las islas en 1ra o 3ra persona y
          descubre mis proyectos en mar abierto.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={onStart}
            className="pointer-events-auto cursor-pointer rounded-md border-2 border-amber-400 bg-amber-400/15 px-7 py-3.5 font-mono text-sm font-semibold tracking-widest text-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.25)] transition hover:scale-105 hover:bg-amber-400 hover:text-slate-950"
          >
            PRESS START → ZARPAR
          </button>
        </div>
      </div>

      <div className="font-mono text-xs text-slate-300/75">
        CONTROLES: [WASD / FLECHAS] NAVEGAR · [RUEDA MOUSE] 1RA / 3RA PERSONA
      </div>
    </div>
  );
}
