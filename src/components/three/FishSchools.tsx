import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import type { ShipTelemetry } from '../../types/portfolio';

interface FishSchoolsProps {
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  playerPosRef: React.RefObject<THREE.Vector3>;
}

const TEX_W = 16;
const TEX_H = 16;
const FISH_COUNT = TEX_W * TEX_H; // 256 peces en cardúmenes GPU

const REEF_SPECS: [number, number, number][] = [
  [-7.5, 12.0, 13.5],
  ...ISLANDS.map(
    (island) =>
      [island.position[0], island.position[1], island.collisionRadius + 2.5] as [
        number,
        number,
        number,
      ]
  ),
];

const BOIDS_QUAD_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BOIDS_VELOCITY_FRAG = `
  uniform sampler2D uPosTex;
  uniform sampler2D uVelTex;
  uniform float uTime;
  uniform float uDt;
  uniform vec3 uShipPos;
  uniform vec3 uPlayerPos;
  uniform vec3 uReefs[5];

  void main() {
    vec2 uv = gl_FragCoord.xy / vec2(${TEX_W.toFixed(1)}, ${TEX_H.toFixed(1)});
    vec4 selfPos = texture2D(uPosTex, uv);
    vec4 selfVel = texture2D(uVelTex, uv);

    int reefIdx = int(clamp(floor(selfPos.w), 0.0, 4.0));
    float seed = fract(selfPos.w);
    float panic = selfVel.w;

    vec3 sep = vec3(0.0);
    vec3 ali = vec3(0.0);
    vec3 coh = vec3(0.0);
    float neighborCount = 0.0;

    // Boids en GPU: separación, alineación y cohesión
    for (int y = 0; y < ${TEX_H}; y++) {
      for (int x = 0; x < ${TEX_W}; x++) {
        vec2 oUV = (vec2(float(x), float(y)) + 0.5) / vec2(${TEX_W.toFixed(1)}, ${TEX_H.toFixed(1)});
        vec4 otherPos = texture2D(uPosTex, oUV);
        vec4 otherVel = texture2D(uVelTex, oUV);

        vec3 diff = selfPos.xyz - otherPos.xyz;
        float distSq = dot(diff, diff);
        if (distSq > 0.0001 && distSq < 23.0) {
          float dist = sqrt(distSq);
          if (dist < 1.35) {
            sep += (diff / dist) * (1.35 - dist) * 5.2;
          }
          if (floor(otherPos.w) == floor(selfPos.w)) {
            ali += otherVel.xyz;
            coh += otherPos.xyz;
            neighborCount += 1.0;
          }
        }
      }
    }

    vec3 steer = sep;
    if (neighborCount > 0.0) {
      steer += ((ali / neighborCount) - selfVel.xyz) * 1.45;
      steer += ((coh / neighborCount) - selfPos.xyz) * 0.95;
    }

    // Selección del arrecife asignado para patrulla orgánica
    vec3 reef = uReefs[0];
    if (reefIdx == 1) reef = uReefs[1];
    else if (reefIdx == 2) reef = uReefs[2];
    else if (reefIdx == 3) reef = uReefs[3];
    else if (reefIdx == 4) reef = uReefs[4];

    float patrolRate = 0.24 + sin(float(reefIdx) * 1.9 + uTime * 0.07) * 0.06;
    float patrolAng =
      uTime * patrolRate +
      float(reefIdx) * 1.35 +
      sin(uTime * 0.19 + seed * 6.28318) * 0.95;
    float patrolDist =
      reef.z + 4.8 + sin(uTime * 0.34 + float(reefIdx) * 2.7) * 2.5 + (seed - 0.5) * 2.8;
    float patrolY = -1.12 - seed * 0.92 + sin(uTime * 0.65 + patrolAng * 2.0) * 0.25;

    vec3 patrolTarget = vec3(
      reef.x + sin(patrolAng) * patrolDist,
      patrolY,
      reef.y + cos(patrolAng) * patrolDist
    );
    vec3 toTarget = patrolTarget - selfPos.xyz;
    steer += normalize(toTarget + vec3(0.0001)) * clamp(length(toTarget) * 0.35, 0.25, 2.4);

    // Evasión rápida si se acerca el casco del barco o el jugador
    float nextPanic = max(0.0, panic - uDt * 1.35);

    vec3 fromShip = selfPos.xyz - uShipPos;
    float dShip = length(fromShip);
    if (dShip < 11.5) {
      vec3 dirShip = normalize(vec3(fromShip.x, fromShip.y - 0.5, fromShip.z) + vec3(0.001));
      float fear = 1.0 - dShip / 11.5;
      steer += dirShip * fear * 26.0;
      nextPanic = max(nextPanic, clamp(fear * 1.65, 0.0, 1.0));
    }

    vec3 fromPlayer = selfPos.xyz - uPlayerPos;
    float dPlayer = length(fromPlayer);
    if (dPlayer < 7.5) {
      vec3 dirPl = normalize(vec3(fromPlayer.x, fromPlayer.y - 0.45, fromPlayer.z) + vec3(0.001));
      float fearP = 1.0 - dPlayer / 7.5;
      steer += dirPl * fearP * 22.0;
      nextPanic = max(nextPanic, clamp(fearP * 1.5, 0.0, 1.0));
    }

    // Evitar núcleo rocoso de arrecifes/islas
    for (int r = 0; r < 5; r++) {
      vec2 radial = selfPos.xz - uReefs[r].xy;
      float rDist = length(radial);
      float safeR = uReefs[r].z + 1.1;
      if (rDist < safeR && rDist > 0.001) {
        steer.xz += (radial / rDist) * (safeR - rDist) * 14.0;
      }
    }

    // Profundidad submarina bajo el oleaje
    if (selfPos.y > -0.68) steer.y -= (selfPos.y + 0.68) * 12.0;
    if (selfPos.y < -2.65) steer.y += (-2.65 - selfPos.y) * 10.0;

    vec3 vel = selfVel.xyz + steer * uDt;
    float maxSpd = mix(3.6, 10.5, nextPanic);
    float minSpd = mix(1.4, 4.8, nextPanic);
    float spd = length(vel);
    if (spd > 0.0001) {
      vel = (vel / spd) * clamp(spd, minSpd, maxSpd);
    } else {
      vel = vec3(1.6, 0.0, 0.0);
    }

    gl_FragColor = vec4(vel, nextPanic);
  }
`;

const BOIDS_POSITION_FRAG = `
  uniform sampler2D uPosTex;
  uniform sampler2D uVelTex;
  uniform float uDt;

  void main() {
    vec2 uv = gl_FragCoord.xy / vec2(${TEX_W.toFixed(1)}, ${TEX_H.toFixed(1)});
    vec4 pos = texture2D(uPosTex, uv);
    vec4 vel = texture2D(uVelTex, uv);
    pos.xyz += vel.xyz * uDt;
    gl_FragColor = pos;
  }
`;

function buildSculptedFishGeometry(): THREE.BufferGeometry {
  const vertices: number[] = [];
  const addTri = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number
  ) => {
    vertices.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  };

  // Cuerpo fusiforme hidrodinámico (+Z nariz -> -Z cola)
  const n = [0, 0.01, 0.34] as const;
  const fTop = [0, 0.11, 0.09] as const;
  const fBot = [0, -0.09, 0.09] as const;
  const fL = [-0.075, 0.01, 0.08] as const;
  const fR = [0.075, 0.01, 0.08] as const;
  const tail = [0, 0.0, -0.24] as const;

  // Cabeza (4 caras)
  addTri(n[0], n[1], n[2], fTop[0], fTop[1], fTop[2], fR[0], fR[1], fR[2]);
  addTri(n[0], n[1], n[2], fR[0], fR[1], fR[2], fBot[0], fBot[1], fBot[2]);
  addTri(n[0], n[1], n[2], fBot[0], fBot[1], fBot[2], fL[0], fL[1], fL[2]);
  addTri(n[0], n[1], n[2], fL[0], fL[1], fL[2], fTop[0], fTop[1], fTop[2]);

  // Tronco trasero hacia el pedúnculo caudal
  addTri(fTop[0], fTop[1], fTop[2], tail[0], tail[1], tail[2], fR[0], fR[1], fR[2]);
  addTri(fR[0], fR[1], fR[2], tail[0], tail[1], tail[2], fBot[0], fBot[1], fBot[2]);
  addTri(fBot[0], fBot[1], fBot[2], tail[0], tail[1], tail[2], fL[0], fL[1], fL[2]);
  addTri(fL[0], fL[1], fL[2], tail[0], tail[1], tail[2], fTop[0], fTop[1], fTop[2]);

  // Aleta caudal ahorquillada (cola doble cara)
  const cTop = [0, 0.13, -0.45] as const;
  const cBot = [0, -0.12, -0.45] as const;
  const cMid = [0, 0.0, -0.35] as const;
  addTri(tail[0], tail[1], tail[2], cTop[0], cTop[1], cTop[2], cMid[0], cMid[1], cMid[2]);
  addTri(tail[0], tail[1], tail[2], cMid[0], cMid[1], cMid[2], cBot[0], cBot[1], cBot[2]);
  addTri(tail[0], tail[1], tail[2], cMid[0], cMid[1], cMid[2], cTop[0], cTop[1], cTop[2]);
  addTri(tail[0], tail[1], tail[2], cBot[0], cBot[1], cBot[2], cMid[0], cMid[1], cMid[2]);

  // Aleta dorsal superior
  addTri(0, 0.09, 0.08, 0, 0.21, -0.08, 0, 0.04, -0.15);
  addTri(0, 0.09, 0.08, 0, 0.04, -0.15, 0, 0.21, -0.08);

  // Aletas pectorales izquierda y derecha
  addTri(-0.06, -0.02, 0.08, -0.18, -0.05, -0.04, -0.04, -0.02, -0.06);
  addTri(-0.06, -0.02, 0.08, -0.04, -0.02, -0.06, -0.18, -0.05, -0.04);
  addTri(0.06, -0.02, 0.08, 0.04, -0.02, -0.06, 0.18, -0.05, -0.04);
  addTri(0.06, -0.02, 0.08, 0.18, -0.05, -0.04, 0.04, -0.02, -0.06);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

interface FishRenderUniforms {
  uPosTex: { value: THREE.Texture | null };
  uVelTex: { value: THREE.Texture | null };
  uTime: { value: number };
}

interface GpuBoidsSim {
  posRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  velRT: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  pingIdx: number;
  simScene: THREE.Scene;
  simCam: THREE.OrthographicCamera;
  velMat: THREE.ShaderMaterial;
  posMat: THREE.ShaderMaterial;
  simQuad: THREE.Mesh;
  seeded: boolean;
  seedPosTex: THREE.DataTexture;
  seedVelTex: THREE.DataTexture;
}

function setupFishMaterial(mat: THREE.MeshStandardMaterial | null) {
  if (!mat || mat.userData.fishUniforms) return;

  const uniforms: FishRenderUniforms = {
    uPosTex: { value: null },
    uVelTex: { value: null },
    uTime: { value: 0 },
  };
  mat.userData.fishUniforms = uniforms;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPosTex = uniforms.uPosTex;
    shader.uniforms.uVelTex = uniforms.uVelTex;
    shader.uniforms.uTime = uniforms.uTime;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aTexUV;
attribute float aScale;
attribute vec3 aColorMix;
uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform float uTime;
varying vec3 vFishColor;
varying vec3 vFishLocalPos;
varying float vFishPanic;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
vec4 fishPosTex = texture2D(uPosTex, aTexUV);
vec4 fishVelTex = texture2D(uVelTex, aTexUV);
vec3 fishFwd = normalize(fishVelTex.xyz + vec3(0.0, 0.0, 0.0001));
vec3 worldUpRef = abs(fishFwd.y) > 0.95 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
vec3 fishRight = normalize(cross(worldUpRef, fishFwd));
vec3 fishUp = cross(fishFwd, fishRight);
mat3 fishBasis = mat3(fishRight, fishUp, fishFwd);
objectNormal = normalize(fishBasis * objectNormal);`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float fSeed = fract(fishPosTex.w);
float fPanic = fishVelTex.w;
float swimFreq = 7.8 + fPanic * 11.5;
float tailMask = smoothstep(0.24, -0.45, position.z);
float bodyWave = sin(uTime * swimFreq - position.z * 9.5 + fSeed * 6.28318);
vec3 animFishPos = transformed;
animFishPos.x += bodyWave * (0.012 + tailMask * tailMask * 0.14);
float finMask = smoothstep(0.07, 0.18, abs(position.x));
animFishPos.y += cos(uTime * (swimFreq * 0.85) + fSeed * 6.28318) * finMask * 0.035;

transformed = fishPosTex.xyz + fishBasis * (animFishPos * aScale);
vFishColor = aColorMix;
vFishLocalPos = position;
vFishPanic = fPanic;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFishColor;
varying vec3 vFishLocalPos;
varying float vFishPanic;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float scaleGrid = sin(vFishLocalPos.z * 58.0 + sin(vFishLocalPos.y * 42.0)) * cos(vFishLocalPos.y * 48.0);
float scaleGlint = smoothstep(0.25, 0.92, scaleGrid * 0.5 + 0.5);
vec3 iridescent = mix(vFishColor, vec3(1.0, 0.95, 0.80), scaleGlint * 0.45);
diffuseColor.rgb = iridescent;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float scaleFlash = smoothstep(0.35, 0.95, sin(vFishLocalPos.z * 58.0) * cos(vFishLocalPos.y * 48.0) * 0.5 + 0.5);
totalEmissiveRadiance += vFishColor * (0.14 + scaleFlash * 0.18 + vFishPanic * 0.22);`
      );
  };

  mat.customProgramCacheKey = () => 'gpu-boids-fish-v1';
  mat.needsUpdate = true;
}

function createGpuBoidsSim(gl: THREE.WebGLRenderer): GpuBoidsSim {
  const canFloat = Boolean(gl.extensions.get('EXT_color_buffer_float'));
  const rtType = canFloat ? THREE.FloatType : THREE.HalfFloatType;
  const rtOpts: THREE.RenderTargetOptions = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: rtType,
    depthBuffer: false,
    stencilBuffer: false,
  };

  const posData = new Float32Array(FISH_COUNT * 4);
  const velData = new Float32Array(FISH_COUNT * 4);

  for (let i = 0; i < FISH_COUNT; i += 1) {
    const reefIdx = i % REEF_SPECS.length;
    const [rx, rz, rr] = REEF_SPECS[reefIdx];
    const seed = ((i * 73 + 19) % 997) / 997;
    const angle = (i / FISH_COUNT) * Math.PI * 2 * REEF_SPECS.length + seed * 0.8;
    const dist = rr + 3.5 + seed * 6.5;

    const px = rx + Math.sin(angle) * dist;
    const pz = rz + Math.cos(angle) * dist;
    const py = -1.05 - seed * 1.1;

    const idx4 = i * 4;
    posData[idx4] = px;
    posData[idx4 + 1] = py;
    posData[idx4 + 2] = pz;
    posData[idx4 + 3] = reefIdx + seed * 0.98;

    velData[idx4] = Math.cos(angle) * 2.4;
    velData[idx4 + 1] = 0;
    velData[idx4 + 2] = -Math.sin(angle) * 2.4;
    velData[idx4 + 3] = 0;
  }

  const seedPosTex = new THREE.DataTexture(posData, TEX_W, TEX_H, THREE.RGBAFormat, THREE.FloatType);
  seedPosTex.minFilter = THREE.NearestFilter;
  seedPosTex.magFilter = THREE.NearestFilter;
  seedPosTex.needsUpdate = true;

  const seedVelTex = new THREE.DataTexture(velData, TEX_W, TEX_H, THREE.RGBAFormat, THREE.FloatType);
  seedVelTex.minFilter = THREE.NearestFilter;
  seedVelTex.magFilter = THREE.NearestFilter;
  seedVelTex.needsUpdate = true;

  const reefVecs = REEF_SPECS.map(([x, z, r]) => new THREE.Vector3(x, z, r));

  const velMat = new THREE.ShaderMaterial({
    vertexShader: BOIDS_QUAD_VERT,
    fragmentShader: BOIDS_VELOCITY_FRAG,
    uniforms: {
      uPosTex: { value: seedPosTex },
      uVelTex: { value: seedVelTex },
      uTime: { value: 0 },
      uDt: { value: 0.016 },
      uShipPos: { value: new THREE.Vector3() },
      uPlayerPos: { value: new THREE.Vector3() },
      uReefs: { value: reefVecs },
    },
  });

  const posMat = new THREE.ShaderMaterial({
    vertexShader: BOIDS_QUAD_VERT,
    fragmentShader: BOIDS_POSITION_FRAG,
    uniforms: {
      uPosTex: { value: seedPosTex },
      uVelTex: { value: seedVelTex },
      uDt: { value: 0.016 },
    },
  });

  const simScene = new THREE.Scene();
  const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), velMat);
  simScene.add(simQuad);

  return {
    posRT: [
      new THREE.WebGLRenderTarget(TEX_W, TEX_H, rtOpts),
      new THREE.WebGLRenderTarget(TEX_W, TEX_H, rtOpts),
    ],
    velRT: [
      new THREE.WebGLRenderTarget(TEX_W, TEX_H, rtOpts),
      new THREE.WebGLRenderTarget(TEX_W, TEX_H, rtOpts),
    ],
    pingIdx: 0,
    simScene,
    simCam,
    velMat,
    posMat,
    simQuad,
    seeded: false,
    seedPosTex,
    seedVelTex,
  };
}

function initFishInstancedMesh(mesh: THREE.InstancedMesh | null) {
  if (!mesh || mesh.userData.identityInit) return;
  const id = new THREE.Matrix4();
  for (let i = 0; i < FISH_COUNT; i += 1) {
    mesh.setMatrixAt(i, id);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.identityInit = true;
}

export function FishSchools({ shipTelemetryRef, playerPosRef }: FishSchoolsProps) {
  const { gl } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const simRef = useRef<GpuBoidsSim | null>(null);

  const fishGeo = useMemo(() => {
    const geo = buildSculptedFishGeometry();
    const uvs = new Float32Array(FISH_COUNT * 2);
    const scales = new Float32Array(FISH_COUNT);
    const colors = new Float32Array(FISH_COUNT * 3);

    const paletteColors = [
      new THREE.Color('#ffd699'), // Dorado atardecer
      new THREE.Color('#fd8457'), // Coral vivo
      new THREE.Color('#5eead4'), // Turquesa arrecife
      new THREE.Color('#e2e8f0'), // Plateado metálico
    ];

    for (let i = 0; i < FISH_COUNT; i += 1) {
      const ix = i % TEX_W;
      const iy = Math.floor(i / TEX_W);
      uvs[i * 2] = (ix + 0.5) / TEX_W;
      uvs[i * 2 + 1] = (iy + 0.5) / TEX_H;

      const sRand = ((i * 53 + 11) % 100) / 100;
      scales[i] = 0.62 + sRand * 0.92;

      const c = paletteColors[i % paletteColors.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('aTexUV', new THREE.InstancedBufferAttribute(uvs, 2));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    geo.setAttribute('aColorMix', new THREE.InstancedBufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.getElapsedTime();

    if (!simRef.current) {
      simRef.current = createGpuBoidsSim(gl);
    }
    const sim = simRef.current;

    const readIdx = sim.pingIdx;
    const writeIdx = 1 - readIdx;

    const posReadTex = sim.seeded ? sim.posRT[readIdx].texture : sim.seedPosTex;
    const velReadTex = sim.seeded ? sim.velRT[readIdx].texture : sim.seedVelTex;

    const ship = shipTelemetryRef.current;
    const playerPos = playerPosRef.current;

    const prevTarget = gl.getRenderTarget();

    // Paso 1: actualizar velocidades (GPU Boids)
    sim.velMat.uniforms.uPosTex.value = posReadTex;
    sim.velMat.uniforms.uVelTex.value = velReadTex;
    sim.velMat.uniforms.uTime.value = t;
    sim.velMat.uniforms.uDt.value = dt;
    sim.velMat.uniforms.uShipPos.value.set(ship.x, ship.y - 0.3, ship.z);
    sim.velMat.uniforms.uPlayerPos.value.copy(playerPos);
    sim.simQuad.material = sim.velMat;
    gl.setRenderTarget(sim.velRT[writeIdx]);
    gl.render(sim.simScene, sim.simCam);

    // Paso 2: integrar posiciones con la nueva velocidad GPU
    sim.posMat.uniforms.uPosTex.value = posReadTex;
    sim.posMat.uniforms.uVelTex.value = sim.velRT[writeIdx].texture;
    sim.posMat.uniforms.uDt.value = dt;
    sim.simQuad.material = sim.posMat;
    gl.setRenderTarget(sim.posRT[writeIdx]);
    gl.render(sim.simScene, sim.simCam);

    gl.setRenderTarget(prevTarget);

    sim.seeded = true;
    sim.pingIdx = writeIdx;

    const uniforms = matRef.current?.userData.fishUniforms as FishRenderUniforms | undefined;
    if (uniforms) {
      uniforms.uPosTex.value = sim.posRT[writeIdx].texture;
      uniforms.uVelTex.value = sim.velRT[writeIdx].texture;
      uniforms.uTime.value = t;
    }
  });

  return (
    <instancedMesh
      ref={(el) => {
        meshRef.current = el;
        initFishInstancedMesh(el);
      }}
      args={[fishGeo, undefined, FISH_COUNT]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        ref={(el) => {
          matRef.current = el;
          setupFishMaterial(el);
        }}
        color="#ffffff"
        metalness={0.86}
        roughness={0.22}
        flatShading
      />
    </instancedMesh>
  );
}
