import * as THREE from 'three';

export interface SailShaderUniforms {
  uTime: { value: number };
  uWindLocal: { value: THREE.Vector3 };
  uWindSpeed: { value: number };
  uGust: { value: number };
  uSailDeploy: { value: number };
  uHeadwindLuff: { value: number };
  uSailDims: { value: THREE.Vector2 };
  uSunDir: { value: THREE.Vector3 };
}

export interface RopeShaderUniforms {
  uTime: { value: number };
  uWindSpeed: { value: number };
  uGust: { value: number };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Construye una vela trapezoidal pirata subdividida con mapa Vertex Color (`color`):
 * - R (`pinFree`): 0 en bordes superior/inferior, collar de mástil y nudos de cuerdas; 1 en el paño libre.
 * - G (`edgeFlutter`): máximo en los bordes laterales libres para ondas de ondeo rápidas (flutter).
 * - B (`wearThinness`): desgaste/adelgazamiento de la lona para Subsurface Scattering solar (menor en costuras/relingas).
 */
export function buildPirateSailGeometry(
  widthBottom: number,
  widthTop: number,
  height: number,
  cols = 34,
  rows = 24
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, height, cols, rows);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i += 1) {
    const u = THREE.MathUtils.clamp(uv.getX(i), 0, 1);
    const v = THREE.MathUtils.clamp(uv.getY(i), 0, 1);

    // Forma trapezoidal suave con ligera curvatura de relinga lateral (leech roach)
    const spanW = THREE.MathUtils.lerp(widthBottom, widthTop, v);
    const xCentered = (u - 0.5) * spanW;
    const roachPinch = 1.0 - Math.sin(v * Math.PI) * 0.045;
    const x = xCentered * roachPinch;
    const y = v * height;

    // Suave flecha hacia abajo en el borde inferior por gravedad de la lona
    const bottomCurve = -Math.sin(u * Math.PI) * (1.0 - v) * 0.08;
    pos.setXYZ(i, x, y + bottomCurve, 0);

    // --- Vertex Color Map ---
    // 1) Canal R: Anclaje estricto en borde superior (v=1), inferior (v=0), mástil central y cabos de puños
    const topAnchor = smoothstep(0.0, 0.14, 1.0 - v);
    const botAnchor = smoothstep(0.0, 0.14, v);
    const mastLashing = 0.52 + 0.48 * (1.0 - Math.exp(-Math.pow((u - 0.5) / 0.085, 2)));

    // Cuatro esquinas / nudos de escotas y amuras completamente fijados (0.0)
    const d00 = Math.hypot(u, v);
    const d10 = Math.hypot(1 - u, v);
    const d01 = Math.hypot(u, 1 - v);
    const d11 = Math.hypot(1 - u, 1 - v);
    const nearestCorner = Math.min(d00, d10, d01, d11);
    const ropeCornerAnchor = smoothstep(0.03, 0.2, nearestCorner);

    // Pequeños puntos de briol / aferrado intermedios a lo largo de bordes sup/inf
    const grommetPattern = 1.0 - 0.25 * (1.0 - Math.cos(u * Math.PI * 6.0)) * 0.5 * (1.0 - Math.min(topAnchor, botAnchor));

    const pinFree = THREE.MathUtils.clamp(
      topAnchor * botAnchor * mastLashing * ropeCornerAnchor * grommetPattern,
      0,
      1
    );

    // 2) Canal G: Máscara de ondeo de alta frecuencia concentrada en bordes verticales libres (u -> 0 y u -> 1)
    const sideEdgeBias = Math.pow(Math.abs(u * 2.0 - 1.0), 1.65);
    const midSpanBias = Math.sin(v * Math.PI);
    const leechLoose = sideEdgeBias * midSpanBias + (1.0 - midSpanBias) * 0.12 * pinFree;
    const edgeFlutter = THREE.MathUtils.clamp(
      leechLoose * topAnchor * botAnchor * THREE.MathUtils.lerp(0.35, 1.0, ropeCornerAnchor),
      0,
      1
    );

    // 3) Canal B: Lona desgastada/delgada en paños centrales; más gruesa y opaca en costuras horizontales y relingas
    const horzSeamWave = Math.abs(Math.sin(v * Math.PI * 4.0));
    const seamDensity = smoothstep(0.06, 0.26, horzSeamWave);
    const perimeterReinforce =
      smoothstep(0.0, 0.12, u) *
      smoothstep(0.0, 0.12, 1.0 - u) *
      smoothstep(0.0, 0.1, v) *
      smoothstep(0.0, 0.1, 1.0 - v);
    const patchWear =
      0.82 +
      0.16 * Math.sin(u * 9.3 + v * 5.7) -
      0.18 * (1.0 - mastLashing);
    const wearThinness = THREE.MathUtils.clamp(
      seamDensity * (0.28 + 0.72 * perimeterReinforce) * patchWear,
      0.12,
      1.0
    );

    colors[i * 3] = pinFree;
    colors[i * 3 + 1] = edgeFlutter;
    colors[i * 3 + 2] = wearThinness;
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Construye una cuerda de jarcia entre puntos 3D usando Vertex Color para fijar los extremos
 * anclados al mástil/vergas/cubierta (R=0) y permitir mínima vibración controlada en el tramo central.
 */
export function buildRiggingRopeGeometry(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius = 0.019,
  sag = 0.06,
  segments = 10
): THREE.BufferGeometry {
  const mid = start.clone().lerp(end, 0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(start.clone(), mid, end.clone());
  const geo = new THREE.TubeGeometry(curve, segments, radius, 5, false);

  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const colors = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i += 1) {
    const along = THREE.MathUtils.clamp(uv.getX(i), 0, 1);
    const anchorMask = Math.sin(along * Math.PI);
    colors[i * 3] = anchorMask * 0.09; // Extremos estrictamente 0.0 en mástil/vergas
    colors[i * 3 + 1] = anchorMask * 0.15;
    colors[i * 3 + 2] = 0.0;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

const SAIL_DISPLACEMENT_GLSL = `
  vec3 evalSailDisplaced(
    vec3 basePos,
    vec2 uvCoord,
    vec3 maskRGB,
    float uTime,
    vec3 uWindLocal,
    float uWindSpeed,
    float uGust,
    float uSailDeploy,
    float uHeadwindLuff,
    float sailHeight
  ) {
    float pinFree = maskRGB.r;
    float edgeMask = maskRGB.g;

    float windMag = length(uWindLocal);
    vec3 windDir = windMag > 0.001 ? (uWindLocal / windMag) : vec3(0.0, 0.0, -1.0);
    float windNorm = clamp(uWindSpeed / 20.0, 0.15, 1.65);

    // Alineación entre la normal de la vela (+Z / -Z) y el vector de viento local
    float sailAlignZ = windDir.z;
    float headOnLuff = clamp(uHeadwindLuff, 0.0, 1.0);

    // Bolsa curva aerodinámica cuando la vela está izada y capta el viento
    float pocketCurve = sin(uvCoord.x * 3.14159265) * sin(uvCoord.y * 3.14159265);
    float sideSpread = smoothstep(0.0, 0.3, uvCoord.y) * smoothstep(1.0, 0.7, uvCoord.y);
    float gustMul = 1.0 + uGust * 0.58;
    float effectiveAlign = mix(sailAlignZ, sailAlignZ * 0.18, headOnLuff * 0.85);
    float billowAmp = effectiveAlign * windNorm * gustMul * uSailDeploy * (0.95 + 0.35 * pocketCurve);

    // Recogido real manteniendo borde superior anclado en sailHeight y borde inferior en la verga móvil
    float furledFactor = 1.0 - uSailDeploy;
    float gatheredY = sailHeight - (sailHeight - basePos.y) * uSailDeploy;
    float reefPleats = sin(uvCoord.x * 24.0 + uvCoord.y * 6.0) * 0.18 * furledFactor;

    // Ondas de ondeo (flutter) de alta frecuencia en los bordes cuando está recogida o contra el viento
    float flutterStrength = clamp(
      max(furledFactor * 1.25, headOnLuff * 1.15) * (0.38 + 0.72 * windNorm + uGust * 0.45),
      0.08,
      1.6
    );
    float speedPhase = 15.0 + uWindSpeed * 0.85;
    float fWaveA = sin(uvCoord.y * 23.0 + uvCoord.x * 8.5 - uTime * speedPhase);
    float fWaveB = cos(uvCoord.y * 36.0 - uvCoord.x * 13.0 - uTime * (speedPhase * 1.38));
    float leechFlutter = (fWaveA * 0.62 + fWaveB * 0.38) * (0.03 + 0.24 * flutterStrength) * edgeMask;

    // Suave respiración del paño incluso navegando con viento favorable
    float gentleRipple = sin(uvCoord.y * 7.5 - uTime * 4.2 + uvCoord.x * 5.0) * 0.045 * windNorm;

    vec3 outPos = vec3(basePos.x, gatheredY, basePos.z);
    float zDisp = (billowAmp + gentleRipple + reefPleats) * pinFree + leechFlutter;
    outPos.z += zDisp;

    // Conservación de tensión horizontal al inflarse o recogerse
    outPos.x += windDir.x * windNorm * 0.24 * pinFree * uSailDeploy;
    outPos.x *= 1.0 - clamp(abs(billowAmp) * 0.055 * sideSpread * pinFree, 0.0, 0.14);
    return outPos;
  }
`;

export function setupPirateSailMaterial(mat: THREE.MeshStandardMaterial | null) {
  if (!mat || mat.userData.sailUniforms) return;

  const uniforms: SailShaderUniforms = {
    uTime: { value: 0 },
    uWindLocal: { value: new THREE.Vector3(0, 0, -12) },
    uWindSpeed: { value: 12 },
    uGust: { value: 0 },
    uSailDeploy: { value: 1.0 },
    uHeadwindLuff: { value: 0 },
    uSailDims: { value: new THREE.Vector2(4.3, 2.95) },
    uSunDir: { value: new THREE.Vector3(-36, 28, -200).normalize() },
  };

  mat.userData.sailUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindLocal = uniforms.uWindLocal;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uGust = uniforms.uGust;
    shader.uniforms.uSailDeploy = uniforms.uSailDeploy;
    shader.uniforms.uHeadwindLuff = uniforms.uHeadwindLuff;
    shader.uniforms.uSailDims = uniforms.uSailDims;
    shader.uniforms.uSunDir = uniforms.uSunDir;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 color;
uniform float uTime;
uniform vec3 uWindLocal;
uniform float uWindSpeed;
uniform float uGust;
uniform float uSailDeploy;
uniform float uHeadwindLuff;
uniform vec2 uSailDims;
varying vec2 vSailUv;
varying vec3 vSailMask;
varying vec3 vSailWorldPos;
varying vec3 vSailWorldNormal;
${SAIL_DISPLACEMENT_GLSL}`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
float eps = 0.02;
vec2 uvU = clamp(uv + vec2(eps, 0.0), 0.0, 1.0);
vec2 uvV = clamp(uv + vec2(0.0, eps), 0.0, 1.0);
float edgePinSlope = sin(uv.x * 3.14159265) * 3.2;
vec3 maskU = color;
vec3 maskV = vec3(
  clamp(color.r + (uvV.y - uv.y) * mix(edgePinSlope, -edgePinSlope, step(0.5, uv.y)), 0.0, 1.0),
  color.g,
  color.b
);
vec3 pCenter = evalSailDisplaced(position, uv, color, uTime, uWindLocal, uWindSpeed, uGust, uSailDeploy, uHeadwindLuff, uSailDims.y);
vec3 pStepU = evalSailDisplaced(position + vec3(uSailDims.x * eps, 0.0, 0.0), uvU, maskU, uTime, uWindLocal, uWindSpeed, uGust, uSailDeploy, uHeadwindLuff, uSailDims.y);
vec3 pStepV = evalSailDisplaced(position + vec3(0.0, uSailDims.y * eps, 0.0), uvV, maskV, uTime, uWindLocal, uWindSpeed, uGust, uSailDeploy, uHeadwindLuff, uSailDims.y);
objectNormal = normalize(cross(pStepU - pCenter, pStepV - pCenter));
vSailWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
transformed = pCenter;
vSailUv = uv;
vSailMask = color;
vSailWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uSunDir;
uniform float uGust;
varying vec2 vSailUv;
varying vec3 vSailMask;
varying vec3 vSailWorldPos;
varying vec3 vSailWorldNormal;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Tejido de lona desgastada con paños cosidos horizontales, manchas de salitre y relingas reforzadas
float canvasWeave = sin(vSailUv.x * 160.0) * sin(vSailUv.y * 125.0) * 0.032;
float horzSeam = 1.0 - smoothstep(0.0, 0.075, abs(sin(vSailUv.y * 3.14159265 * 4.0)));
float vertCenterSeam = exp(-pow((vSailUv.x - 0.5) / 0.025, 2.0));
float sunBleach = 0.88 + 0.14 * vSailMask.b + canvasWeave;
vec3 weatheredTint = mix(vec3(0.76, 0.61, 0.49), vec3(1.03, 0.98, 0.90), vSailMask.b);
diffuseColor.rgb *= weatheredTint * sunBleach;
// Costuras y bordes con relinga más oscuros
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.72, max(horzSeam * 0.55, vertCenterSeam * 0.45));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.78, (1.0 - vSailMask.r) * 0.35);`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
// Subsurface Scattering (SSS): la luz cálida del atardecer atraviesa las fibras desgastadas de la lona
vec3 sailViewDir = normalize(cameraPosition - vSailWorldPos);
vec3 sailWorldN = normalize(vSailWorldNormal);
if (!gl_FrontFacing) sailWorldN = -sailWorldN;
vec3 backScatterVec = normalize(uSunDir + sailWorldN * 0.36);
float viewBackDot = pow(clamp(dot(sailViewDir, -backScatterVec), 0.0, 1.0), 2.4);
float wrapTranslucency = clamp(dot(-sailWorldN, uSunDir) * 0.45 + 0.55, 0.0, 1.0);
// Lona más desgastada (vSailMask.b alto) deja pasar más luz dorada; costuras/cuerdas permanecen densas
float fabricTransmit = mix(0.18, 1.0, vSailMask.b);
vec3 sssTint = mix(vec3(0.98, 0.55, 0.34), vec3(1.0, 0.86, 0.58), wrapTranslucency * 0.65 + uGust * 0.15);
reflectedLight.directDiffuse += sssTint * fabricTransmit * (viewBackDot * 0.92 + wrapTranslucency * 0.38);`
      );
  };

  mat.customProgramCacheKey = () => 'pirate-sail-sss-v1';
  mat.needsUpdate = true;
}

export function syncPirateSailMaterial(
  mat: THREE.MeshStandardMaterial | null,
  time: number,
  windLocal: THREE.Vector3,
  windSpeed: number,
  gust: number,
  sailDeploy: number,
  headwindLuff: number,
  dims: [number, number]
) {
  const uniforms = mat?.userData.sailUniforms as SailShaderUniforms | undefined;
  if (!uniforms) return;
  uniforms.uTime.value = time;
  uniforms.uWindLocal.value.copy(windLocal);
  uniforms.uWindSpeed.value = windSpeed;
  uniforms.uGust.value = gust;
  uniforms.uSailDeploy.value = sailDeploy;
  uniforms.uHeadwindLuff.value = headwindLuff;
  uniforms.uSailDims.value.set(dims[0], dims[1]);
}

/**
 * Shader de jarcia para cuerdas que lee la pintura de vértices (R) y restringe a 0.0 los extremos en mástiles.
 */
export function setupRiggingRopeMaterial(mat: THREE.MeshStandardMaterial | null) {
  if (!mat || mat.userData.ropeUniforms) return;

  const uniforms: RopeShaderUniforms = {
    uTime: { value: 0 },
    uWindSpeed: { value: 12 },
    uGust: { value: 0 },
  };
  mat.userData.ropeUniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uGust = uniforms.uGust;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 color;
uniform float uTime;
uniform float uWindSpeed;
uniform float uGust;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float ropePin = color.r;
float ropeFreq = 9.0 + uWindSpeed * 0.55;
float ropeVib = sin(uTime * ropeFreq + position.y * 4.5 + position.z * 3.0) * (0.15 + uGust * 0.45);
transformed.x += ropeVib * ropePin;
transformed.z += cos(uTime * ropeFreq * 1.1 + position.x * 5.0) * 0.08 * ropePin;`
      );
  };
  mat.customProgramCacheKey = () => 'rigging-rope-vcolor-v1';
  mat.needsUpdate = true;
}

export function syncRiggingRopeMaterial(
  mat: THREE.MeshStandardMaterial | null,
  time: number,
  windSpeed: number,
  gust: number
) {
  const uniforms = mat?.userData.ropeUniforms as RopeShaderUniforms | undefined;
  if (!uniforms) return;
  uniforms.uTime.value = time;
  uniforms.uWindSpeed.value = windSpeed;
  uniforms.uGust.value = gust;
}
