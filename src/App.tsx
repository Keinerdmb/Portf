import { useState } from 'react';
import { Starfield } from './components/effects/Starfield';
import type { Screen } from './types/portfolio';

export function App() {
  // Estados principales de nuestro "Monitor CRT"
  const [activeScreen, setActiveScreen] = useState<Screen>('start');
  const [crtEffects, setCrtEffects] = useState(true);
  const [powerOn, setPowerOn] = useState(true);

  const navItems: { id: Screen; label: string }[] = [
    { id: 'start', label: 'START' },
    { id: 'missions', label: 'MISSIONS' },
    { id: 'stats', label: 'STATS' },
    { id: 'comms', label: 'COMMS' },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07070e] p-2 sm:p-6">
      {/* Carcasa física del Monitor CRT */}
      <div className="relative flex w-full max-w-5xl flex-col rounded-2xl border-4 border-[#23263a] bg-[#151724] p-3 shadow-[0_0_50px_rgba(0,240,255,0.12)] sm:p-5">
        {/* Pantalla de cristal del monitor */}
        <div className="relative min-h-[540px] overflow-hidden rounded-xl border-4 border-[#0a0b12] bg-[#050510]">
          {powerOn ? (
            <>
              {/* Fondo espacial animado en Canvas */}
              <Starfield paused={!crtEffects} />

              {/* Contenido real del portafolio */}
              <div className="relative z-10 flex min-h-[540px] flex-col justify-between p-4 sm:p-6">
                {/* HUD Superior */}
                <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#00f0ff]/30 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-pixel text-[10px] text-[#39ff14] sm:text-xs">
                      LVL 99
                    </span>
                    <div className="h-3 w-20 border border-[#39ff14]/70 bg-[#050510] p-0.5 sm:w-28">
                      <div className="h-full w-4/5 bg-[#39ff14]" />
                    </div>
                  </div>

                  <nav className="flex flex-wrap items-center gap-2 sm:gap-4">
                    {navItems.map((item) => {
                      const isActive = activeScreen === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveScreen(item.id)}
                          className={`cursor-pointer px-2 py-1 font-pixel text-[10px] transition-colors sm:text-xs ${
                            isActive
                              ? 'bg-[#00f0ff] text-[#050510]'
                              : 'text-slate-300 hover:text-[#00f0ff]'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </nav>
                </header>

                {/* Pantalla activa */}
                <main className="my-auto py-8 text-center">
                  {activeScreen === 'start' && (
                    <div className="mx-auto max-w-2xl space-y-6">
                      <p className="font-pixel text-[10px] tracking-widest text-[#ff0055] sm:text-xs">
                        SYSTEM READY // INSERT COIN
                      </p>

                      <h1 className="font-pixel text-2xl leading-relaxed text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.6)] sm:text-4xl">
                        PILOT: KEINER
                      </h1>

                      <p className="font-terminal text-2xl text-slate-200 sm:text-3xl">
                        FULL-STACK SPACE ENGINEER &amp; RETRO UI BUILDER
                      </p>

                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => setActiveScreen('missions')}
                          className="animate-arcade-blink cursor-pointer border-2 border-[#ffd700] bg-[#ffd700]/10 px-6 py-3 font-pixel text-xs text-[#ffd700] transition-transform hover:scale-105 hover:bg-[#ffd700] hover:text-[#050510] sm:text-sm"
                        >
                          &gt; PRESS START &lt;
                        </button>
                      </div>
                    </div>
                  )}

                  {activeScreen !== 'start' && (
                    <div className="mx-auto max-w-xl border-2 border-[#00f0ff]/40 bg-[#050510]/80 p-6">
                      <h2 className="font-pixel text-sm text-[#ffd700] sm:text-base">
                        SECTOR: {activeScreen.toUpperCase()}
                      </h2>
                      <p className="mt-4 font-terminal text-2xl text-slate-300">
                        Aquí construiremos la sección de{' '}
                        <span className="text-[#00f0ff]">{activeScreen}</span> en el
                        siguiente paso.
                      </p>
                    </div>
                  )}
                </main>

                {/* Pie de pantalla dentro del CRT */}
                <footer className="flex items-center justify-between border-t border-slate-800 pt-3 font-terminal text-lg text-slate-400">
                  <span>SECTOR 01 // EARTH ORBIT</span>
                  <span>60 FPS // CRT MODE</span>
                </footer>
              </div>

              {/* Capas de efecto CRT (encima del contenido, pero pointer-events-none para no bloquear clics) */}
              {crtEffects && (
                <>
                  <div
                    aria-hidden="true"
                    className="crt-scanlines pointer-events-none absolute inset-0 z-20"
                  />
                  <div
                    aria-hidden="true"
                    className="crt-vignette pointer-events-none absolute inset-0 z-20"
                  />
                </>
              )}
            </>
          ) : (
            /* Pantalla apagada */
            <div className="flex min-h-[540px] flex-col items-center justify-center gap-4 bg-[#030308]">
              <div className="h-0.5 w-32 bg-slate-700/60" />
              <p className="font-pixel text-xs text-slate-600">MONITOR OFF</p>
            </div>
          )}
        </div>

        {/* Panel inferior físico del Monitor CRT (botones de hardware) */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2">
          <span className="font-pixel text-[10px] tracking-widest text-slate-500">
            KEINER-TRON 9000 CRT
          </span>

          <div className="flex items-center gap-3">
            {/* Botón para activar/desactivar efectos CRT */}
            <button
              type="button"
              onClick={() => setCrtEffects((prev) => !prev)}
              className="cursor-pointer rounded border border-slate-600 bg-[#0d0f18] px-3 py-1.5 font-pixel text-[9px] text-slate-300 transition-colors hover:border-[#00f0ff] hover:text-[#00f0ff]"
            >
              CRT FX: {crtEffects ? 'ON' : 'OFF'}
            </button>

            {/* Botón físico de encendido */}
            <button
              type="button"
              onClick={() => setPowerOn((prev) => !prev)}
              className="flex cursor-pointer items-center gap-2 rounded border border-slate-600 bg-[#0d0f18] px-3 py-1.5 font-pixel text-[9px] text-slate-300 transition-colors hover:border-[#39ff14]"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  powerOn ? 'bg-[#39ff14] shadow-[0_0_6px_#39ff14]' : 'bg-red-500'
                }`}
              />
              POWER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
