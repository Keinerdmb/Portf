import type { DynamicWindState, OceanParams } from '../types/portfolio';

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function lerpAngle(current: number, target: number, t: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * clamp(t, 0, 1);
}

export function createInitialWindState(base: OceanParams): DynamicWindState {
  return {
    speed: base.windSpeed,
    direction: base.currentAngle,
    dirX: Math.sin(base.currentAngle),
    dirZ: -Math.cos(base.currentAngle),
    gustIntensity: 0,
    waveTime: 0,
    sailDeploy: 0.32,
    liveOcean: { ...base },
  };
}

/**
 * Avanza la simulación global de viento variable con ráfagas periódicas y acopla
 * la energía del viento al oleaje efectivo para volver el mar más picado en rachas fuertes.
 */
export function stepDynamicWind(
  state: DynamicWindState,
  base: OceanParams,
  elapsedTime: number,
  dt: number
): void {
  // Variación orgánica de dirección alrededor del rumbo configurado por el usuario
  const angleMeander =
    Math.sin(elapsedTime * 0.145) * 0.22 +
    Math.cos(elapsedTime * 0.068 + 1.15) * 0.13 +
    Math.sin(elapsedTime * 0.37) * 0.05;
  const targetDir = base.currentAngle + angleMeander;
  state.direction = lerpAngle(state.direction, targetDir, dt * 2.2);
  state.dirX = Math.sin(state.direction);
  state.dirZ = -Math.cos(state.direction);

  // Ráfagas periódicas (ataque rápido, decaimiento natural)
  const primaryGust = Math.pow(0.5 + 0.5 * Math.sin(elapsedTime * 0.45 - 0.55), 4.0);
  const secondaryGust = Math.pow(0.5 + 0.5 * Math.sin(elapsedTime * 0.21 + 2.05), 5.0);
  const targetGust = clamp(primaryGust * 0.88 + secondaryGust * 0.46, 0, 1);
  const gustRate = targetGust > state.gustIntensity ? dt * 2.5 : dt * 0.9;
  state.gustIntensity = lerp(state.gustIntensity, targetGust, gustRate);

  // Intensidad variable en el tiempo + empuje extra en ráfagas
  const ambientWave =
    Math.sin(elapsedTime * 0.31) * 0.11 + Math.cos(elapsedTime * 0.71) * 0.06;
  const gustExtraKt = state.gustIntensity * (3.6 + base.windSpeed * 0.36);
  const targetSpeed = clamp(
    base.windSpeed * (1 + ambientWave) + gustExtraKt,
    1.5,
    34.0
  );
  state.speed = lerp(state.speed, targetSpeed, dt * 3.0);

  // Sincronización con el oleaje: vientos fuertes y ráfagas vuelven el mar más alto y picado
  const strongWind = clamp((state.speed - 9.0) / 16.0, 0, 1.45);
  const gustSeaKick = state.gustIntensity * 0.18;

  state.liveOcean.windSpeed = state.speed;
  state.liveOcean.minWaveHeight =
    base.minWaveHeight * (1 + strongWind * 0.28 + gustSeaKick * 0.65);
  state.liveOcean.maxWaveHeight =
    base.maxWaveHeight * (1 + strongWind * 0.54 + gustSeaKick * 1.15);
  state.liveOcean.waveFrequency = Math.min(
    2.1,
    base.waveFrequency * (1 + strongWind * 0.36 + gustSeaKick * 0.85)
  );
  state.liveOcean.currentAngle = lerpAngle(
    state.liveOcean.currentAngle,
    base.currentAngle + angleMeander * 0.35,
    dt * 0.75
  );

  // Tiempo de fase continuo integrado: acelera las crestas durante rachas sin retroceder al calmar
  const phaseRate = 0.65 + (state.speed / 14.0) * 0.5;
  state.waveTime += dt * phaseRate;
}
