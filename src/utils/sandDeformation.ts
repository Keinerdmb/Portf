import * as THREE from 'three';
import { ISLANDS } from '../data/islands';
import { ATARDECER_PALETTE } from '../data/palette';
import type { OceanParams } from '../types/portfolio';
import { GERSTNER_WAVE_SAMPLE_GLSL } from './gerstnerGlsl';

export interface SandBeachSpec {
  id: string;
  cx: number;
  cz: number;
  outerRadius: number;
  tileIndex: number;
}

export const SAND_BEACH_SPECS: SandBeachSpec[] = [
  { id: 'home', cx: -7.5, cz: 12.0, outerRadius: 15.4, tileIndex: 0 },
  ...ISLANDS.map((island, idx) => ({
    id: island.id,
    cx: island.position[0],
    cz: island.position[1],
    outerRadius: 17.5,
    tileIndex: idx + 1,
  })),
];

export const SAND_ATLAS_TILES = SAND_BEACH_SPECS.length; // 5 tiles
export const SAND_TILE_RES = 256;
export const SAND_ATLAS_W = SAND_TILE_RES * SAND_ATLAS_TILES; // 1280
export const SAND_ATLAS_H = SAND_TILE_RES; // 256
export const SAND_TILE_WORLD_SPAN = 44.0;
export const MAX_SAND_STAMPS = 6;

export interface SandStampItem {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  radius: number;
  depth: number;
  aspect: number;
}

export interface SandSharedState {
  texture: THREE.Texture | null;
  time: number;
}

export interface SandMaterialUniforms {
  uSandDefTex: { value: THREE.Texture | null };
  uTime: { value: number };
  uWindSpeed: { value: number };
  uCurrentAngle: { value: number };
  uMinHeight: { value: number };
  uMaxHeight: { value: number };
  uFrequency: { value: number };
  uHorizonColor: { value: THREE.Color };
  uSkyTopColor: { value: THREE.Color };
}

function evalBeachElevationCPU(localX: number, localZ: number, outerRadius: number): number {
  const r = Math.hypot(localX, localZ);
  const ang = Math.atan2(localZ, localX);
  const stretch = 1.0 + Math.sin(ang * 3.0) * 0.14 + Math.cos(ang * 2.0) * 0.08;
  const maxR = Math.max(outerRadius * stretch, 0.001);
  const normR = Math.min(r / maxR, 1.0);

  if (normR <= 0.36) {
    return 1.42 - normR * 0.12;
  }
  const tSlope = THREE.MathUtils.clamp((normR - 0.36) / 0.64, 0.0, 1.0);
  const s = tSlope * tSlope * (3.0 - 2.0 * tSlope);
  return 1.38 - s * 2.53;
}

/**
 * Geometría polar de alta subdivisión para playas con desplazamiento real
 * de vértices (huellas hundidas, bordes elevados y declive hasta el lecho submarino).
 */
export function buildSculptedBeachGeometry(
  outerRadius: number,
  tileIndex: number,
  radialRings = 24,
  thetaSegs = 56
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const atlasUvs: number[] = [];
  const indices: number[] = [];

  for (let ir = 0; ir <= radialRings; ir += 1) {
    const rFrac = ir / radialRings;
    for (let it = 0; it <= thetaSegs; it += 1) {
      const ang = (it / thetaSegs) * Math.PI * 2;
      const stretch = 1.0 + Math.sin(ang * 3.0) * 0.14 + Math.cos(ang * 2.0) * 0.08;
      const r = rFrac * outerRadius * stretch;
      const lx = Math.cos(ang) * r;
      const lz = Math.sin(ang) * r;
      const ly = evalBeachElevationCPU(lx, lz, outerRadius);

      positions.push(lx, ly, lz);

      const localU = THREE.MathUtils.clamp(lx / SAND_TILE_WORLD_SPAN + 0.5, 0.004, 0.996);
      const localV = THREE.MathUtils.clamp(lz / SAND_TILE_WORLD_SPAN + 0.5, 0.004, 0.996);
      const atlasU = (tileIndex + localU) / SAND_ATLAS_TILES;
      const atlasV = localV;

      uvs.push(localU, localV);
      atlasUvs.push(atlasU, atlasV);
    }
  }

  const rowStride = thetaSegs + 1;
  for (let ir = 0; ir < radialRings; ir += 1) {
    for (let it = 0; it < thetaSegs; it += 1) {
      const a = ir * rowStride + it;
      const b = (ir + 1) * rowStride + it;
      const c = (ir + 1) * rowStride + (it + 1);
      const d = ir * rowStride + (it + 1);
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aSandAtlasUV', new THREE.Float32BufferAttribute(atlasUvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function setupBeachSandMaterial(mat: THREE.MeshStandardMaterial | null) {
  if (!mat || mat.userData.sandUniforms) return;

  const uniforms: SandMaterialUniforms = {
    uSandDefTex: { value: null },
    uTime: { value: 0 },
    uWindSpeed: { value: 12 },
    uCurrentAngle: { value: 0.45 },
    uMinHeight: { value: 0.35 },
    uMaxHeight: { value: 1.05 },
    uFrequency: { value: 0.85 },
    uHorizonColor: { value: new THREE.Color(ATARDECER_PALETTE.horizonRose) },
    uSkyTopColor: { value: new THREE.Color(ATARDECER_PALETTE.cloudCream) },
  };
  mat.userData.sandUniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSandDefTex = uniforms.uSandDefTex;
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindSpeed = uniforms.uWindSpeed;
    shader.uniforms.uCurrentAngle = uniforms.uCurrentAngle;
    shader.uniforms.uMinHeight = uniforms.uMinHeight;
    shader.uniforms.uMaxHeight = uniforms.uMaxHeight;
    shader.uniforms.uFrequency = uniforms.uFrequency;
    shader.uniforms.uHorizonColor = uniforms.uHorizonColor;
    shader.uniforms.uSkyTopColor = uniforms.uSkyTopColor;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aSandAtlasUV;
uniform sampler2D uSandDefTex;
varying vec2 vSandAtlasUV;
varying vec3 vSandWorldPos;
varying vec3 vSandWorldNormal;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
vSandWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vSandAtlasUV = aSandAtlasUV;
float sandDisp = (texture2D(uSandDefTex, aSandAtlasUV).r - 0.5) * 0.8;
transformed.y += sandDisp;
vSandWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uSandDefTex;
uniform float uTime;
uniform float uWindSpeed;
uniform float uCurrentAngle;
uniform float uMinHeight;
uniform float uMaxHeight;
uniform float uFrequency;
uniform vec3 uHorizonColor;
uniform vec3 uSkyTopColor;
varying vec2 vSandAtlasUV;
varying vec3 vSandWorldPos;
varying vec3 vSandWorldNormal;
${GERSTNER_WAVE_SAMPLE_GLSL}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 sandWave = sampleGerstnerHeightSlope(
  vSandWorldPos.xz,
  uTime,
  uWindSpeed,
  uCurrentAngle,
  uMinHeight,
  uMaxHeight,
  uFrequency
);
float tideDelta = sandWave.x - vSandWorldPos.y;
float wetZone = smoothstep(-0.46, 0.08, tideDelta + sandWave.y * 0.3);
float swashRim = smoothstep(-0.08, 0.02, tideDelta) * (1.0 - smoothstep(0.02, 0.16, tideDelta));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.50, 0.45), wetZone * 0.88);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.99, 0.98), swashRim * 0.34);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(0.92, 0.10, wetZone);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
float shL = (texture2D(uSandDefTex, vSandAtlasUV - vec2(${(1 / SAND_ATLAS_W).toFixed(6)}, 0.0)).r - 0.5) * 0.8;
float shR = (texture2D(uSandDefTex, vSandAtlasUV + vec2(${(1 / SAND_ATLAS_W).toFixed(6)}, 0.0)).r - 0.5) * 0.8;
float shD = (texture2D(uSandDefTex, vSandAtlasUV - vec2(0.0, ${(1 / SAND_ATLAS_H).toFixed(6)})).r - 0.5) * 0.8;
float shU = (texture2D(uSandDefTex, vSandAtlasUV + vec2(0.0, ${(1 / SAND_ATLAS_H).toFixed(6)})).r - 0.5) * 0.8;
vec3 sandGradWorld = vec3((shL - shR) / 0.34375, 0.0, (shD - shU) / 0.34375);
vec3 bumpedSandWorldN = normalize(vSandWorldNormal + sandGradWorld * 1.15);
normal = normalize((viewMatrix * vec4(bumpedSandWorldN, 0.0)).xyz);`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
vec3 sandViewDir = normalize(cameraPosition - vSandWorldPos);
float sandNdotV = max(dot(bumpedSandWorldN, sandViewDir), 0.0);
float sandFresnel = 0.06 + 0.94 * pow(1.0 - sandNdotV, 4.0);
vec3 sandReflDir = reflect(-sandViewDir, bumpedSandWorldN);
vec3 sandSkyRefl = mix(uHorizonColor, uSkyTopColor, clamp(sandReflDir.y * 1.4, 0.0, 1.0));
reflectedLight.indirectSpecular += sandSkyRefl * sandFresnel * wetZone * 0.88;`
      );
  };

  mat.customProgramCacheKey = () => 'reactive-tide-sand-v1';
  mat.needsUpdate = true;
}

export function syncBeachSandMaterial(
  mat: THREE.MeshStandardMaterial | null,
  sandState: SandSharedState,
  oceanParams: OceanParams
) {
  const uniforms = mat?.userData.sandUniforms as SandMaterialUniforms | undefined;
  if (!uniforms) return;

  uniforms.uSandDefTex.value = sandState.texture;
  uniforms.uTime.value = sandState.time;
  uniforms.uWindSpeed.value = oceanParams.windSpeed;
  uniforms.uCurrentAngle.value = oceanParams.currentAngle;
  uniforms.uMinHeight.value = oceanParams.minWaveHeight;
  uniforms.uMaxHeight.value = oceanParams.maxWaveHeight;
  uniforms.uFrequency.value = oceanParams.waveFrequency;
}

export function queueSandStamp(
  stampQueueRef: React.RefObject<SandStampItem[]>,
  stamp: SandStampItem
) {
  if (stampQueueRef.current.length < MAX_SAND_STAMPS) {
    stampQueueRef.current.push(stamp);
  }
}
