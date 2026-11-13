import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
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

const GERSTNER_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uCurrentAngle;
  uniform float uMinHeight;
  uniform float uMaxHeight;
  uniform float uFrequency;
  uniform float uIsOuter;

  varying vec3 vWorldPos;
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

    // En la malla exterior mantenemos hundido el centro debajo de la malla detallada
    if (uIsOuter > 0.5 && abs(position.x) < ${OUTER_HOLE_LIMIT.toFixed(1)} && abs(position.y) < ${OUTER_HOLE_LIMIT.toFixed(1)}) {
      worldBase.y = -4.5;
      vWorldPos = worldBase.xyz;
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

  varying vec3 vWorldPos;
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

  void main() {
    // Normal facetada por triángulo en GPU (dFdx/dFdy) con guarda anti-NaN
    vec3 dpdx = dFdx(vWorldPos);
    vec3 dpdy = dFdy(vWorldPos);
    vec3 flatNormal = normalize(cross(dpdx, dpdy) + vec3(0.0, 0.0001, 0.0));
    if (flatNormal.y < 0.0) flatNormal = -flatNormal;

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 sunDir = normalize(uSunDir);

    // Paleta Steven Universe: valles turquesa profundos -> aqua -> crestas menta
    float hSpan = max(0.25, uMaxHeight);
    float hNorm = clamp((vWaveHeight + hSpan * 0.5) / hSpan, 0.0, 1.0);
    vec3 deepColor = vec3(0.06, 0.44, 0.54);
    vec3 midColor  = vec3(0.14, 0.69, 0.73);
    vec3 crestColor = vec3(0.38, 0.88, 0.85);

    vec3 waterCol = mix(deepColor, midColor, smoothstep(0.12, 0.58, hNorm));
    waterCol = mix(waterCol, crestColor, smoothstep(0.58, 1.0, hNorm));

    // Iluminación difusa por faceta + reflejo especular dorado del sol
    float diff = max(dot(flatNormal, sunDir), 0.0);
    waterCol *= 0.72 + diff * 0.48;

    vec3 halfVec = normalize(sunDir + viewDir);
    float spec = pow(max(dot(flatNormal, halfVec), 0.0), 64.0);
    waterCol += vec3(1.0, 0.89, 0.66) * spec * 0.75;

    // Espuma procedural (foam) en crestas calculada por pendiente real de la ola (vSlope)
    vec2 currentVec = vec2(sin(uCurrentAngle), -cos(uCurrentAngle));
    vec2 foamUV = vWorldPos.xz * 0.55 - currentVec * uTime * 0.85;
    float n1 = valueNoise(foamUV);
    float n2 = valueNoise(foamUV * 2.3 + 4.1);
    float foamPattern = n1 * 0.65 + n2 * 0.35;

    float windFoamBoost = clamp(uWindSpeed / 15.0, 0.6, 1.45);
    float slopeFoam = smoothstep(0.055, 0.24, vSlope * windFoamBoost);
    float crestFoam = smoothstep(0.45, 0.92, hNorm);
    float foamIntensity = clamp((slopeFoam * 0.85 + crestFoam * 0.45), 0.0, 1.0);
    float foamMask = smoothstep(0.42, 0.68, foamPattern + foamIntensity * 0.48) * foamIntensity;

    vec3 foamColor = vec3(0.95, 0.99, 0.98);
    waterCol = mix(waterCol, foamColor, clamp(foamMask * 0.92, 0.0, 1.0));

    // Niebla atmosférica hacia el color del horizonte
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

  const innerUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWindSpeed: { value: DEFAULT_OCEAN_PARAMS.windSpeed },
      uCurrentAngle: { value: DEFAULT_OCEAN_PARAMS.currentAngle },
      uMinHeight: { value: DEFAULT_OCEAN_PARAMS.minWaveHeight },
      uMaxHeight: { value: DEFAULT_OCEAN_PARAMS.maxWaveHeight },
      uFrequency: { value: DEFAULT_OCEAN_PARAMS.waveFrequency },
      uIsOuter: { value: 0.0 },
      uSunDir: { value: new THREE.Vector3(-0.18, 0.14, -1).normalize() },
      uFogColor: { value: new THREE.Color('#f3b59e') },
      uFogNear: { value: 110.0 },
      uFogFar: { value: 310.0 },
    }),
    []
  );

  const outerUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWindSpeed: { value: DEFAULT_OCEAN_PARAMS.windSpeed },
      uCurrentAngle: { value: DEFAULT_OCEAN_PARAMS.currentAngle },
      uMinHeight: { value: DEFAULT_OCEAN_PARAMS.minWaveHeight },
      uMaxHeight: { value: DEFAULT_OCEAN_PARAMS.maxWaveHeight },
      uFrequency: { value: DEFAULT_OCEAN_PARAMS.waveFrequency },
      uIsOuter: { value: 1.0 },
      uSunDir: { value: new THREE.Vector3(-0.18, 0.14, -1).normalize() },
      uFogColor: { value: new THREE.Color('#f3b59e') },
      uFogNear: { value: 110.0 },
      uFogFar: { value: 310.0 },
    }),
    []
  );

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
