import { ISLANDS } from '../data/islands';

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
  label: string;
}

/**
 * Fórmula compartida de oleaje: combina marejada amplia con crestas cortas picadas
 * para que las facetas triangulares tengan relieve definido como en la referencia.
 */
export function getWaveHeight(x: number, z: number, time: number): number {
  const swell =
    Math.sin(x * 0.08 + time * 1.25) * 0.3 +
    Math.cos(z * 0.09 + time * 1.05) * 0.25;
  const chop =
    Math.sin(x * 0.42 + z * 0.34 + time * 2.15) * 0.22 +
    Math.cos(x * 0.36 - z * 0.46 - time * 1.85) * 0.18;
  return swell + chop;
}

/**
 * Dirección dinámica del viento que rota suavemente con el tiempo.
 */
export function getWindState(time: number): { angle: number; knots: number } {
  // Brisa predominante hacia el Noreste / Noroeste que varía con calma
  const angle = -0.35 + Math.sin(time * 0.06) * 0.45;
  const knots = 11 + Math.sin(time * 0.25) * 3;
  return { angle, knots };
}

/**
 * Colisionadores circulares de las islas + la costa/muelle inicial.
 */
export const WORLD_COLLIDERS: CircleCollider[] = [
  // Costa e isla inicial detrás del muelle
  { x: -7.5, z: 12, radius: 10.5, label: 'coast' },
  // Muelle de madera
  { x: -3.1, z: 4.2, radius: 2.3, label: 'dock' },
  // Todas las islas del archipiélago
  ...ISLANDS.map((island) => ({
    x: island.position[0],
    z: island.position[1],
    radius: island.collisionRadius,
    label: island.id,
  })),
];
