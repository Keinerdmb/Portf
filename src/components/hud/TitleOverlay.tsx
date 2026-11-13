interface TitleOverlayProps {
  onStart: () => void;
}

export function TitleOverlay({ onStart }: TitleOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-10">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tracking-widest text-[#FFF2C6]/90 drop-shadow">
          KEINER // PIRATE PORTFOLIO
        </span>
      </div>

      {/* Bloque central/izquierdo limpio estilo indie */}
      <div className="my-auto max-w-xl space-y-5">
        <p className="font-mono text-xs tracking-[0.28em] text-[#FFD699] uppercase drop-shadow">
          Travesía Interactiva 3D
        </p>

        <h1 className="font-display text-4xl font-extrabold tracking-wider text-[#FFFDF7] drop-shadow-[0_4px_20px_rgba(45,28,38,0.75)] sm:text-6xl">
          CAPITÁN KEINER
        </h1>

        <p className="max-w-md text-base text-[#FFF2C6]/95 drop-shadow-[0_2px_10px_rgba(45,28,38,0.65)] sm:text-lg">
          Full-Stack Developer. Toma el timón, siente el viento y navega hacia las
          islas en 1ra o 3ra persona.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={onStart}
            className="pointer-events-auto cursor-pointer rounded-md border-2 border-[#FFD699] bg-[#211926]/70 px-7 py-3.5 font-mono text-sm font-semibold tracking-widest text-[#FFF2C6] shadow-[0_0_25px_rgba(253,132,87,0.32)] transition hover:scale-105 hover:bg-[#FFD699] hover:text-[#211926]"
          >
            PRESS START → ZARPAR
          </button>
        </div>
      </div>

      <div className="font-mono text-xs text-[#FFF2C6]/90 drop-shadow">
        [WASD / FLECHAS] TIMÓN · [ARRASTRAR MOUSE] CÁMARA · [RUEDA] 1RA / 3RA PERSONA
      </div>
    </div>
  );
}
