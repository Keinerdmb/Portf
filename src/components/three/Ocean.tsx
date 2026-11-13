import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import { ATARDECER_PALETTE } from '../../data/palette';
import type { OceanParams } from '../../types/portfolio';
import { DEFAULT_OCEAN_PARAMS } from '../../utils/oceanMath';

interface OceanProps {
  shipPosRef: React.RefObject<{ x: number; z: number }>;
  oceanParamsRef: React.RefObject<OceanParams>;
}

const INNER_SIZE = 200;
const INNER_SEGMENTS = 72;

const OUTER_SIZE = 780;
const OUTER_SEGMENTS = 30;
const OUTER_HOLE_LIMIT = 52;

// Zonas de poca profundidad (x, z, radio de orilla) para gradiente cristalino -> abisal
const SHORE_ZONES: THREE.Vector3[] = [
  new THREE.Vector3(-7.5, 12.0, 10.5),
  ...ISLANDS.map(
    (island) => new THREE.Vector3(island.position[0], island.position[1], island.collisionRadius)
  ),
];

const GERSTNER_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uCurrentAngle;
  uniform float uMinHeight;
  uniform float uMaxHeight;
  uniform float uFrequency;
  uniform float uIsOuter;

  varying vec3 vWorldPos;
  varying vec3 vSmoothNormal;
  varying float vWaveHeight;
  varying float vSlope;

  void addGerstnerWave(
    vec2 xz,
    float angleOffset,
    float baseWavelength,
    float steepness,
    float weight,
    float totalHeight,
    float freq,
    float windFactor,
    inout vec3 offset,
    inout vec3 normal
  ) {
    float dirAngle = uCurrentAngle + angleOffset;
    vec2 dir = vec2(sin(dirAngle), -cos(dirAngle));

    float wavelength = baseWavelength / freq;
    float k = 6.2831853 / wavelength;
    float omega = sqrt(9.81 * k) * windFactor;
    float amp = totalHeight * 0.5 * weight;
    float q = min(steepness, 0.72 / (k * max(amp, 0.01) * 4.0));

    float phase = k * dot(dir, xz) - omega * uTime;
    float c = cos(phase);
    float s = sin(phase);

    offset.x += q * amp * dir.x * c;
    offset.z += q * amp * dir.y * c;
    offset.y += amp * s;

    float wa = k * amp;
    normal.x -= dir.x * wa * c;
    normal.z -= dir.y * wa * c;
    normal.y -= q * wa * s;
  }

  void main() {
    vec4 worldBase = modelMatrix * vec4(position, 1.0);

    if (uIsOuter > 0.5 && abs(position.x) < ${OUTER_HOLE_LIMIT.toFixed(1)} && abs(position.y) < ${OUTER_HOLE_LIMIT.toFixed(1)}) {
      worldBase.y = -4.5;
      vWorldPos = worldBase.xyz;
      vSmoothNormal = vec3(0.0, 1.0, 0.0);
      vWaveHeight = -4.5;
      vSlope = 0.0;
      gl_Position = projectionMatrix * viewMatrix * worldBase;
      return;
    }

    float freq = max(0.35, uFrequency);
    float windFactor = 0.65 + (uWindSpeed / 14.0) * 0.5;
    float minH = min(uMinHeight, uMaxHeight);
    float maxH = max(uMinHeight, uMaxHeight);
    float spatialMod = 0.5 + 0.5 * sin(worldBase.x * 0.028 + worldBase.z * 0.022 + uTime * 0.22);
    float totalHeight = mix(minH, maxH, spatialMod);

    vec3 disp = vec3(0.0);
    vec3 norm = vec3(0.0, 1.0, 0.0);

    addGerstnerWave(worldBase.xz,  0.0,  34.0, 0.28, 0.50, totalHeight, freq, windFactor, disp, norm);
    addGerstnerWave(worldBase.xz,  0.58, 21.5, 0.22, 0.26, totalHeight, freq, windFactor, disp, norm);
    addGerstnerWave(worldBase.xz, -0.72, 12.8, 0.18, 0.15, totalHeight, freq, windFactor, disp, norm);
    addGerstnerWave(worldBase.xz,  1.32,  7.4, 0.14, 0.09, totalHeight, freq, windFactor, disp, norm);

    if (uIsOuter > 0.5) {
      disp.y -= 0.06;
    }

    vec3 displacedWorld = worldBase.xyz + disp;
    vec3 finalNormal = normalize(norm);

    vWorldPos = displacedWorld;
    vSmoothNormal = finalNormal;
    vWaveHeight = disp.y;
    vSlope = max(0.0, 1.0 - finalNormal.y);

    gl_Position = projectionMatrix * viewMatrix * vec4(displacedWorld, 1.0);
  }
`;

const GERSTNER_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uCurrentAngle;
  uniform float uMaxHeight;
  uniform vec3 uSunDir;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uShores[5];

  varying vec3 vWorldPos;
  varying vec3 vSmoothNormal;
  varying float vWaveHeight;
  varying float vSlope;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Cáusticas procedurales en zonas poco profundas y orillas
  float causticsPattern(vec2 uv, float t) {
    float c1 = sin(uv.x * 2.1 + t * 1.4 + sin(uv.y * 1.7 - t));
    float c2 = cos(uv.y * 2.4 - t * 1.2 + cos(uv.x * 1.9 + t * 1.1));
    float net = abs(c1 + c2) * 0.5;
    return pow(1.0 - clamp(net, 0.0, 1.0), 3.2);
  }

  void main() {
    // Combinamos normal facetada por triángulo (dFdx/dFdy) + normal suave Gerstner para reflejos nítidos
    vec3 dpdx = dFdx(vWorldPos);
    vec3 dpdy = dFdy(vWorldPos);
    vec3 flatNormal = normalize(cross(dpdx, dpdy) + vec3(0.0, 0.0001, 0.0));
    if (flatNormal.y < 0.0) flatNormal = -flatNormal;
    vec3 N = normalize(mix(flatNormal, normalize(vSmoothNormal), 0.32));

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 sunDir = normalize(uSunDir);

    // 1. Gradiente de profundidad: cristalina cerca de islas/costas -> azul abisal profundo en mar abierto
    float minShoreDist = 999.0;
    for (int i = 0; i < 5; i++) {
      float d = length(vWorldPos.xz - uShores[i].xy) - uShores[i].z;
      minShoreDist = min(minShoreDist, d);
    }
    float depthFactor = clamp(minShoreDist / 26.0, 0.0, 1.0);

    float hSpan = max(0.25, uMaxHeight);
    float hNorm = clamp((vWaveHeight + hSpan * 0.5) / hSpan, 0.0, 1.0);

    vec3 shallowCrystal = vec3(0.557, 0.537, 0.659);
    vec3 midOceanDusk   = vec3(0.580, 0.392, 0.349);
    vec3 abyssalDeep    = vec3(0.322, 0.231, 0.278);

    vec3 deepWater = mix(midOceanDusk, abyssalDeep, smoothstep(0.2, 1.0, depthFactor) * (1.0 - hNorm * 0.55));
    vec3 waterCol  = mix(shallowCrystal, deepWater, smoothstep(0.0, 0.78, depthFactor));

    // Cáusticas doradas visibles en aguas poco profundas
    float shallowMask = 1.0 - smoothstep(0.0, 0.55, depthFactor);
    float shoreCaustic = causticsPattern(vWorldPos.xz * 0.38, uTime);
    waterCol += vec3(1.00, 0.84, 0.60) * shoreCaustic * shallowMask * 0.34;

    // 2. Subsurface Scattering (SSS): crestas brillan en coral y albaricoque al recibir el sol de atardecer por detrás
    vec3 backLightDir = normalize(-sunDir + N * 0.48);
    float backScatter = pow(max(dot(viewDir, backLightDir), 0.0), 3.0);
    float crestThickness = smoothstep(0.32, 0.98, hNorm) * (0.45 + 0.55 * smoothstep(0.02, 0.22, vSlope));
    vec3 sssColor = mix(vec3(0.992, 0.518, 0.341), vec3(1.00, 0.839, 0.60), shallowMask * 0.45 + 0.32);
    waterCol += sssColor * (backScatter * 0.78 + 0.16) * crestThickness;

    // Iluminación difusa por faceta
    float diff = max(dot(flatNormal, sunDir), 0.0);
    waterCol *= 0.68 + diff * 0.52;

    // 3. Reflejos especulares nítidos basados en ángulo de Fresnel (Schlick)
    float NdotV = max(dot(N, viewDir), 0.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);

    vec3 reflDir = reflect(-viewDir, N);
    float skyT = clamp(reflDir.y, 0.0, 1.0);
    vec3 skyReflect = mix(vec3(0.945, 0.761, 0.698), vec3(0.84, 0.72, 0.76), smoothstep(0.0, 0.65, skyT));
    waterCol = mix(waterCol, skyReflect, fresnel * 0.66);

    // Destello solar blanco crema + camino coral-albaricoque modulados por Fresnel
    vec3 halfVec = normalize(sunDir + viewDir);
    float NdotH = max(dot(N, halfVec), 0.0);
    float sharpSpec = pow(NdotH, 220.0);
    float softSpec  = pow(NdotH, 34.0);
    vec3 sunSpecCol = vec3(1.0, 0.99, 0.96) * sharpSpec * (1.15 + fresnel * 1.45)
                    + vec3(0.992, 0.60, 0.39) * softSpec * (0.28 + fresnel * 0.52);
    waterCol += sunSpecCol;

    // 4. Espuma procedural (crestas por pendiente + espuma de orilla) + Oclusión ambiental bajo la espuma
    vec2 currentVec = vec2(sin(uCurrentAngle), -cos(uCurrentAngle));
    vec2 foamUV = vWorldPos.xz * 0.58 - currentVec * uTime * 0.85;
    float foamPattern = valueNoise(foamUV) * 0.65 + valueNoise(foamUV * 2.4 + 4.1) * 0.35;

    float windFoamBoost = clamp(uWindSpeed / 15.0, 0.6, 1.45);
    float slopeFoam = smoothstep(0.055, 0.24, vSlope * windFoamBoost);
    float crestFoam = smoothstep(0.45, 0.92, hNorm);
    float shoreRing = smoothstep(3.2, -0.4, minShoreDist);
    float foamIntensity = clamp(slopeFoam * 0.85 + crestFoam * 0.45 + shoreRing * 0.9, 0.0, 1.0);

    float foamMask = smoothstep(0.40, 0.68, foamPattern + foamIntensity * 0.48) * foamIntensity;
    float foamShadowAO = smoothstep(0.15, 0.65, foamIntensity) * (1.0 - foamMask * 0.5);

    // Oclusión ambiental sutil debajo y en los bordes de la espuma densa antes de pintar la espuma iluminada
    waterCol *= 1.0 - foamShadowAO * 0.28;
    vec3 foamColor = mix(vec3(0.76, 0.60, 0.57), vec3(1.00, 0.992, 0.969), clamp(diff * 0.5 + 0.5, 0.0, 1.0));
    waterCol = mix(waterCol, foamColor, clamp(foamMask * 0.94, 0.0, 1.0));

    // Niebla atmosférica hacia el horizonte
    float dist = length(cameraPosition - vWorldPos);
    float fogFactor = smoothstep(uFogNear, uFogFar, dist);
    vec3 finalColor = mix(waterCol, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function applyTriangularJitter(mesh: THREE.Mesh, size: number, jitterAmount: number) {
  const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
  const edgeLimit = size * 0.47;

  for (let i = 0; i < posAttr.count; i += 1) {
    const bx = posAttr.getX(i);
    const by = posAttr.getY(i);
    const isEdge = Math.abs(bx) > edgeLimit || Math.abs(by) > edgeLimit;
    const jx = isEdge ? 0 : Math.sin(bx * 12.9898 + by * 78.233) * jitterAmount;
    const jy = isEdge ? 0 : Math.cos(bx * 39.346 + by * 11.135) * jitterAmount;
    posAttr.setXY(i, bx + jx, by + jy);
  }
  posAttr.needsUpdate = true;
}

export function Ocean({ shipPosRef, oceanParamsRef }: OceanProps) {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const innerMatRef = useRef<THREE.ShaderMaterial>(null);
  const outerMatRef = useRef<THREE.ShaderMaterial>(null);

  const createUniforms = (isOuter: number) => ({
    uTime: { value: 0 },
    uWindSpeed: { value: DEFAULT_OCEAN_PARAMS.windSpeed },
    uCurrentAngle: { value: DEFAULT_OCEAN_PARAMS.currentAngle },
    uMinHeight: { value: DEFAULT_OCEAN_PARAMS.minWaveHeight },
    uMaxHeight: { value: DEFAULT_OCEAN_PARAMS.maxWaveHeight },
    uFrequency: { value: DEFAULT_OCEAN_PARAMS.waveFrequency },
    uIsOuter: { value: isOuter },
    uSunDir: { value: new THREE.Vector3(-0.18, 0.14, -1).normalize() },
    uFogColor: { value: new THREE.Color(ATARDECER_PALETTE.horizonRose) },
    uFogNear: { value: 110.0 },
    uFogFar: { value: 310.0 },
    uShores: { value: SHORE_ZONES },
  });

  const innerUniforms = useMemo(() => createUniforms(0.0), []);
  const outerUniforms = useMemo(() => createUniforms(1.0), []);

  useEffect(() => {
    if (innerRef.current) {
      applyTriangularJitter(innerRef.current, INNER_SIZE, 0.72);
    }
    if (outerRef.current) {
      applyTriangularJitter(outerRef.current, OUTER_SIZE, 4.0);
    }
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const sx = shipPosRef.current.x;
    const sz = shipPosRef.current.z;
    const params = oceanParamsRef.current;

    if (innerRef.current) {
      const snap = INNER_SIZE / INNER_SEGMENTS;
      innerRef.current.position.x = Math.round(sx / snap) * snap;
      innerRef.current.position.z = Math.round(sz / snap) * snap;
    }

    if (outerRef.current) {
      const snapOuter = OUTER_SIZE / OUTER_SEGMENTS;
      outerRef.current.position.x = Math.round(sx / snapOuter) * snapOuter;
      outerRef.current.position.z = Math.round(sz / snapOuter) * snapOuter;
    }

    const syncUniforms = (mat: THREE.ShaderMaterial | null) => {
      if (!mat) return;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uWindSpeed.value = params.windSpeed;
      mat.uniforms.uCurrentAngle.value = params.currentAngle;
      mat.uniforms.uMinHeight.value = params.minWaveHeight;
      mat.uniforms.uMaxHeight.value = params.maxWaveHeight;
      mat.uniforms.uFrequency.value = params.waveFrequency;
    };

    syncUniforms(innerMatRef.current);
    syncUniforms(outerMatRef.current);
  });

  return (
    <group>
      <mesh ref={innerRef} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <planeGeometry args={[INNER_SIZE, INNER_SIZE, INNER_SEGMENTS, INNER_SEGMENTS]} />
        <shaderMaterial
          ref={innerMatRef}
          vertexShader={GERSTNER_VERTEX_SHADER}
          fragmentShader={GERSTNER_FRAGMENT_SHADER}
          uniforms={innerUniforms}
        />
      </mesh>

      <mesh ref={outerRef} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <planeGeometry args={[OUTER_SIZE, OUTER_SIZE, OUTER_SEGMENTS, OUTER_SEGMENTS]} />
        <shaderMaterial
          ref={outerMatRef}
          vertexShader={GERSTNER_VERTEX_SHADER}
          fragmentShader={GERSTNER_FRAGMENT_SHADER}
          uniforms={outerUniforms}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
    </group>
  );
}
