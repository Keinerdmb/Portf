import type { IslandData, ProjectItem } from '../types/portfolio';

/**
 * Coordenadas bien separadas para que navegar el océano se sienta como una travesía real.
 * El muelle inicial está en [0, 0] mirando hacia el Norte (-Z).
 */
export const ISLANDS: IslandData[] = [
  {
    id: 'about',
    name: 'ISLA DEL FARO',
    subtitle: 'Sobre Mí & Contacto',
    code: 'N-W',
    position: [-55, -62],
    dockRadius: 18,
    accentColor: '#38bdf8',
    landmark: 'lighthouse',
  },
  {
    id: 'projects',
    name: 'ASTILLERO REAL',
    subtitle: 'Proyectos Destacados',
    code: 'N',
    position: [12, -108],
    dockRadius: 20,
    accentColor: '#fbbf24',
    landmark: 'treasure',
  },
  {
    id: 'skills',
    name: 'TORRE ASTRAL',
    subtitle: 'Stack & Habilidades',
    code: 'N-E',
    position: [78, -66],
    dockRadius: 18,
    accentColor: '#34d399',
    landmark: 'observatory',
  },
  {
    id: 'minigame',
    name: 'ARRECIFE CALAVERA',
    subtitle: 'Mini-Juego de Cañones',
    code: 'E',
    position: [68, 22],
    dockRadius: 22,
    accentColor: '#fb7185',
    landmark: 'skull',
  },
];

export const FEATURED_PROJECTS: ProjectItem[] = [
  {
    title: 'Atlas Commerce API',
    role: 'Full-Stack Architecture',
    description:
      'Plataforma e-commerce modular con autenticación JWT, panel en tiempo real y pasarela de pagos optimizada.',
    tech: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    repoUrl: 'https://github.com/Keinerdmb',
  },
  {
    title: 'Pulse Telemetry Dashboard',
    role: 'Frontend & Data Viz',
    description:
      'Dashboard de monitoreo en tiempo real capaz de procesar miles de eventos con 60 FPS constantes.',
    tech: ['Vite', 'React', 'Tailwind CSS', 'WebSockets'],
    repoUrl: 'https://github.com/Keinerdmb',
  },
  {
    title: 'Pirate 3D Portfolio',
    role: '3D Web Engineering',
    description:
      'Experiencia interactiva en Three.js / React Three Fiber diseñada con enfoque low-poly para correr fluido en cualquier hardware.',
    tech: ['Three.js', 'R3F', 'TypeScript', 'Tailwind'],
    repoUrl: 'https://github.com/Keinerdmb/Portf',
  },
];

export const PILOT_SKILLS = [
  { group: 'Frontend', items: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Three.js'] },
  { group: 'Backend', items: ['Node.js', 'Express', 'PostgreSQL', 'REST APIs', 'Auth & JWT'] },
  { group: 'DevOps & Git', items: ['Git Flow', 'GitHub Actions CI', 'Docker', 'Vercel'] },
];
