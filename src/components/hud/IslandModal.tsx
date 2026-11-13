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
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#211926]/72 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#FFD699]/35 bg-[#211926]/95 p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-[#F1C2B2]/15 pb-4">
          <div>
            <p
              className="font-mono text-xs tracking-widest uppercase"
              style={{ color: island.accentColor }}
            >
              {island.subtitle}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#FFF2C6] sm:text-3xl">
              {island.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded border border-[#F1C2B2]/25 px-3 py-1.5 font-mono text-xs text-[#F7D0B3] transition hover:border-[#FFD699] hover:text-[#FFD699]"
          >
            VOLVER AL BARCO [ESC]
          </button>
        </div>

        <div className="mt-6 space-y-5 text-[#F7D0B3]">
          {islandId === 'about' && (
            <>
              <p className="leading-relaxed text-[#F1C2B2]">
                ¡Bienvenido a bordo! Soy <strong className="text-[#FFD699]">Keiner</strong>,
                desarrollador Full-Stack enfocado en construir productos web rápidos,
                escalables y memorables. Me apasiona unir buena arquitectura de software con
                experiencias interactivas fluidas.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#F1C2B2]/15 bg-[#2D2231]/80 p-4">
                  <p className="font-mono text-xs text-[#FFD699]">GITHUB</p>
                  <a
                    href="https://github.com/Keinerdmb"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm text-[#FFF2C6] underline decoration-[#FD8457]/60 hover:text-[#FFD699]"
                  >
                    github.com/Keinerdmb
                  </a>
                </div>
                <div className="rounded-lg border border-[#F1C2B2]/15 bg-[#2D2231]/80 p-4">
                  <p className="font-mono text-xs text-[#FFD699]">CONTACTO DIRECTO</p>
                  <p className="mt-1 text-sm text-[#F1C2B2]">
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
                  className="rounded-lg border border-[#F1C2B2]/15 bg-[#2D2231]/80 p-4 transition hover:border-[#FFD699]/45"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-[#FFD699]">{proj.title}</h3>
                    <span className="font-mono text-[11px] text-[#B5A8C9]">{proj.role}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#F1C2B2]">{proj.description}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {proj.tech.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-[#FFF2C6]/8 px-2 py-0.5 font-mono text-[11px] text-[#FFD699]"
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
                        className="font-mono text-xs text-[#FD8457] hover:underline"
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
                  className="rounded-lg border border-[#F1C2B2]/15 bg-[#2D2231]/80 p-4"
                >
                  <h3 className="font-mono text-xs font-semibold tracking-wider text-[#B5A8C9] uppercase">
                    {group.group}
                  </h3>
                  <ul className="mt-3 space-y-1.5 text-sm text-[#FFF2C6]">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#A3A86C]" />
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
              <p className="text-[#F1C2B2]">
                ¡Has llegado al <strong className="text-[#FD8457]">Arrecife Calavera</strong>!
                Alrededor de la isla flotan <strong>{minigameTotal} barriles explosivos</strong>.
                Activa el desafío, navega alrededor del arrecife y haz clic sobre cada barril para
                hundirlos con tu cañón.
              </p>

              {minigameScore === minigameTotal && (
                <div className="rounded-lg border border-[#A3A86C]/55 bg-[#2D2E22]/60 p-4 font-mono text-sm text-[#FFF2C6]">
                  ¡VICTORIA NAVAL! Hundiste todos los objetivos del Arrecife Calavera.
                </div>
              )}

              <button
                type="button"
                onClick={onStartMinigame}
                className="cursor-pointer rounded-md border-2 border-[#FD8457] bg-[#FD8457]/20 px-5 py-2.5 font-mono text-xs font-semibold text-[#FFF2C6] transition hover:bg-[#FD8457] hover:text-[#211926]"
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
