import type { IslandData, ProjectItem } from '../types/portfolio';
import { ATARDECER_PALETTE } from './palette';

/**
 * Coordenadas bien separadas para que navegar el océano se sienta como una travesía real.
 * El muelle inicial está en [0, 0] mirando hacia el Norte (-Z).
 */
export const ISLANDS: IslandData[] = [
  {
    id: 'about',
    name: 'ISLA DEL FARO',
    signLabel: 'ABOUT ME',
    subtitle: 'Sobre Mí & Contacto',
    code: 'N-W',
    position: [-56, -64],
    collisionRadius: 12.8,
    dockRadius: 21,
    accentColor: ATARDECER_PALETTE.apricotAccent,
    landmark: 'lighthouse',
  },
  {
    id: 'projects',
    name: 'ASTILLERO REAL',
    signLabel: 'PROJECTS',
    subtitle: 'Proyectos Destacados',
    code: 'N',
    position: [12, -110],
    collisionRadius: 13.5,
    dockRadius: 22,
    accentColor: ATARDECER_PALETTE.sandGold,
    landmark: 'treasure',
  },
  {
    id: 'skills',
    name: 'TORRE ASTRAL',
    signLabel: 'SKILLS',
    subtitle: 'Stack & Habilidades',
    code: 'N-E',
    position: [80, -68],
    collisionRadius: 12.8,
    dockRadius: 21,
    accentColor: ATARDECER_PALETTE.lavenderAccent,
    landmark: 'observatory',
  },
  {
    id: 'minigame',
    name: 'ARRECIFE CALAVERA',
    signLabel: 'MINI-GAME',
    subtitle: 'Mini-Juego de Cañones',
    code: 'E',
    position: [68, 22],
    collisionRadius: 12.8,
    dockRadius: 24,
    accentColor: ATARDECER_PALETTE.coralAccent,
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
