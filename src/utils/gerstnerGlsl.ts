/**
 * Función GLSL compartida para muestrear altura de olas Gerstner (sincronizada con oceanMath.ts).
 */
export const GERSTNER_WAVE_SAMPLE_GLSL = `
  vec2 evalGerstnerWaveOctave(
    vec2 xz,
    float angleOffset,
    float baseWavelength,
    float steepness,
    float weight,
    float totalHeight,
    float freq,
    float windFactor,
    float time,
    float currentAngle
  ) {
    float dirAngle = currentAngle + angleOffset;
    vec2 dir = vec2(sin(dirAngle), -cos(dirAngle));
    float wavelength = baseWavelength / freq;
    float k = 6.2831853 / wavelength;
    float omega = sqrt(9.81 * k) * windFactor;
    float amp = totalHeight * 0.5 * weight;
    float phase = k * dot(dir, xz) - omega * time;
    float s = sin(phase);
    float slopeTerm = k * amp * cos(phase);
    return vec2(amp * s, abs(slopeTerm));
  }

  vec2 sampleGerstnerHeightSlope(
    vec2 xz,
    float time,
    float windSpeed,
    float currentAngle,
    float minHeight,
    float maxHeight,
    float frequency
  ) {
    float freq = max(0.35, frequency);
    float windFactor = 0.65 + (windSpeed / 14.0) * 0.5;
    float minH = min(minHeight, maxHeight);
    float maxH = max(minHeight, maxHeight);
    float spatialMod = 0.5 + 0.5 * sin(xz.x * 0.028 + xz.y * 0.022 + time * 0.22);
    float totalHeight = mix(minH, maxH, spatialMod);

    vec2 acc = vec2(0.0);
    acc += evalGerstnerWaveOctave(xz,  0.0,  34.0, 0.28, 0.50, totalHeight, freq, windFactor, time, currentAngle);
    acc += evalGerstnerWaveOctave(xz,  0.58, 21.5, 0.22, 0.26, totalHeight, freq, windFactor, time, currentAngle);
    acc += evalGerstnerWaveOctave(xz, -0.72, 12.8, 0.18, 0.15, totalHeight, freq, windFactor, time, currentAngle);
    acc += evalGerstnerWaveOctave(xz,  1.32,  7.4, 0.14, 0.09, totalHeight, freq, windFactor, time, currentAngle);
    return acc;
  }
`;
