import { FEATURED_PROJECTS, ISLANDS, PILOT_SKILLS } from '../../data/islands';
import type { IslandId } from '../../types/portfolio';

interface IslandModalProps {
  islandId: IslandId;
  onClose: () => void;
  onStartMinigame: () => void;
  minigameScore: number;
  minigameTotal: number;
}

export function IslandModal({
  islandId,
  onClose,
  onStartMinigame,
  minigameScore,
  minigameTotal,
}: IslandModalProps) {
  const island = ISLANDS.find((i) => i.id === islandId);
  if (!island) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-amber-300/35 bg-[#111524]/95 p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p
              className="font-mono text-xs tracking-widest uppercase"
              style={{ color: island.accentColor }}
            >
              {island.subtitle}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-amber-50 sm:text-3xl">
              {island.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded border border-white/20 px-3 py-1.5 font-mono text-xs text-slate-300 transition hover:border-amber-400 hover:text-amber-300"
          >
            VOLVER AL BARCO [ESC]
          </button>
        </div>

        <div className="mt-6 space-y-5 text-slate-200">
          {islandId === 'about' && (
            <>
              <p className="leading-relaxed text-slate-300">
                ¡Bienvenido a bordo! Soy <strong className="text-amber-300">Keiner</strong>,
                desarrollador Full-Stack enfocado en construir productos web rápidos,
                escalables y memorables. Me apasiona unir buena arquitectura de software con
                experiencias interactivas fluidas.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
                  <p className="font-mono text-xs text-sky-300">GITHUB</p>
                  <a
                    href="https://github.com/Keinerdmb"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm text-white underline decoration-sky-400/50 hover:text-sky-300"
                  >
                    github.com/Keinerdmb
                  </a>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
                  <p className="font-mono text-xs text-sky-300">CONTACTO DIRECTO</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Disponible para proyectos y colaboraciones Full-Stack.
                  </p>
                </div>
              </div>
            </>
          )}

          {islandId === 'projects' && (
            <div className="space-y-4">
              {FEATURED_PROJECTS.map((proj) => (
                <article
                  key={proj.title}
                  className="rounded-lg border border-white/10 bg-slate-900/75 p-4 transition hover:border-amber-400/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-amber-200">{proj.title}</h3>
                    <span className="font-mono text-[11px] text-slate-400">{proj.role}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{proj.description}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {proj.tech.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-white/5 px-2 py-0.5 font-mono text-[11px] text-amber-300/90"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    {proj.repoUrl && (
                      <a
                        href={proj.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-sky-300 hover:underline"
                      >
                        VER REPO →
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {islandId === 'skills' && (
            <div className="grid gap-4 sm:grid-cols-3">
              {PILOT_SKILLS.map((group) => (
                <div
                  key={group.group}
                  className="rounded-lg border border-white/10 bg-slate-900/70 p-4"
                >
                  <h3 className="font-mono text-xs font-semibold tracking-wider text-emerald-300 uppercase">
                    {group.group}
                  </h3>
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-200">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {islandId === 'minigame' && (
            <div className="space-y-4">
              <p className="text-slate-300">
                ¡Has llegado al <strong className="text-rose-300">Arrecife Calavera</strong>!
                Alrededor de la isla flotan <strong>{minigameTotal} barriles explosivos</strong>.
                Activa el desafío, navega alrededor del arrecife y haz clic sobre cada barril para
                hundirlos con tu cañón.
              </p>

              {minigameScore === minigameTotal && (
                <div className="rounded-lg border border-emerald-400/50 bg-emerald-950/40 p-4 font-mono text-sm text-emerald-300">
                  ¡VICTORIA NAVAL! Hundiste todos los objetivos del Arrecife Calavera.
                </div>
              )}

              <button
                type="button"
                onClick={onStartMinigame}
                className="cursor-pointer rounded-md border-2 border-rose-400 bg-rose-500/20 px-5 py-2.5 font-mono text-xs font-semibold text-rose-200 transition hover:bg-rose-500 hover:text-white"
              >
                {minigameScore === minigameTotal
                  ? 'REINICIAR DESAFÍO'
                  : 'ACTIVAR MINI-JUEGO DE CAÑÓN'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
