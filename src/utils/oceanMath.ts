import { ISLANDS } from '../data/islands';
import type { OceanParams } from '../types/portfolio';

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
  label: string;
}

export interface GerstnerSample {
  height: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  slope: number;
}

export const DEFAULT_OCEAN_PARAMS: OceanParams = {
  windSpeed: 12,
  currentAngle: 0.45,
  minWaveHeight: 0.35,
  maxWaveHeight: 1.05,
  waveFrequency: 0.85, // Oleaje suave por defecto
};

// Configuración idéntica a la del shader GLSL en Ocean.tsx (4 octavas de Gerstner)
const WAVE_OCTAVES = [
  { angleOffset: 0.0, wavelength: 34.0, steepness: 0.28, weight: 0.5 },
  { angleOffset: 0.58, wavelength: 21.5, steepness: 0.22, weight: 0.26 },
  { angleOffset: -0.72, wavelength: 12.8, steepness: 0.18, weight: 0.15 },
  { angleOffset: 1.32, wavelength: 7.4, steepness: 0.14, weight: 0.09 },
];

/**
 * Evaluador determinista de olas de Gerstner en CPU sincronizado con el Vertex Shader GLSL.
 * Devuelve la altura vertical (Y), normal de superficie y pendiente en (x, z, time).
 */
export function sampleGerstnerSurface(
  x: number,
  z: number,
  time: number,
  params: OceanParams
): GerstnerSample {
  const freq = Math.max(0.35, params.waveFrequency);
  const minH = Math.min(params.minWaveHeight, params.maxWaveHeight);
  const maxH = Math.max(params.minWaveHeight, params.maxWaveHeight);

  // Modulación espacial suave para que la altura varíe naturalmente entre [minH, maxH]
  const spatialMod = 0.5 + 0.5 * Math.sin(x * 0.028 + z * 0.022 + time * 0.22);
  const totalHeight = minH + (maxH - minH) * spatialMod;

  let y = 0;
  let nx = 0;
  let ny = 1;
  let nz = 0;

  for (let i = 0; i < WAVE_OCTAVES.length; i += 1) {
    const w = WAVE_OCTAVES[i];
    const dirAngle = params.currentAngle + w.angleOffset;
    const dx = Math.sin(dirAngle);
    const dz = -Math.cos(dirAngle);

    const wavelength = w.wavelength / freq;
    const k = (Math.PI * 2) / wavelength;
    const omega = Math.sqrt(9.81 * k);
    const amp = totalHeight * 0.5 * w.weight;
    const q = Math.min(w.steepness, 0.72 / (k * Math.max(amp, 0.01) * 4.0));

    const phase = k * (dx * x + dz * z) - omega * time;
    const c = Math.cos(phase);
    const s = Math.sin(phase);

    y += amp * s;
    const wa = k * amp;
    nx -= dx * wa * c;
    nz -= dz * wa * c;
    ny -= q * wa * s;
  }

  const len = Math.hypot(nx, ny, nz) || 1;
  const normY = ny / len;

  return {
    height: y,
    normalX: nx / len,
    normalY: normY,
    normalZ: nz / len,
    slope: Math.max(0, 1 - normY),
  };
}

/**
 * Integrador simple de flotabilidad de Arquímedes con amortiguamiento para cuerpos rígidos.
 */
export function stepBuoyantBody(
  currentY: number,
  currentVelY: number,
  waterY: number,
  dt: number,
  buoyancyStiffness = 26,
  damping = 4.8,
  draftOffset = 0.12
): { y: number; velY: number } {
  const targetY = waterY - draftOffset;
  const displacement = targetY - currentY;
  // Fuerza restauradora proporcional al volumen sumergido menos fricción del agua
  const accelY = displacement * buoyancyStiffness - currentVelY * damping;
  const nextVelY = currentVelY + accelY * dt;
  const nextY = currentY + nextVelY * dt;
  return { y: nextY, velY: nextVelY };
}

/**
 * Colisionadores circulares de las islas + la costa/muelle inicial.
 */
export const WORLD_COLLIDERS: CircleCollider[] = [
  { x: -7.5, z: 12, radius: 10.5, label: 'coast' },
  { x: -3.1, z: 4.2, radius: 2.3, label: 'dock' },
  ...ISLANDS.map((island) => ({
    x: island.position[0],
    z: island.position[1],
    radius: island.collisionRadius,
    label: island.id,
  })),
];
