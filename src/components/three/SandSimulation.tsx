import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { GamePhase, OceanParams, ShipTelemetry } from '../../types/portfolio';
import { GERSTNER_WAVE_SAMPLE_GLSL } from '../../utils/gerstnerGlsl';
import {
  MAX_SAND_STAMPS,
  SAND_ATLAS_H,
  SAND_ATLAS_TILES,
  SAND_ATLAS_W,
  SAND_BEACH_SPECS,
  SAND_TILE_WORLD_SPAN,
  queueSandStamp,
  type SandSharedState,
  type SandStampItem,
} from '../../utils/sandDeformation';

const SAND_QUAD_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SAND_UPDATE_FRAG = `
  uniform sampler2D uPrevTex;
  uniform float uDt;
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uCurrentAngle;
  uniform float uMinHeight;
  uniform float uMaxHeight;
  uniform float uFrequency;
  uniform vec3 uBeaches[${SAND_ATLAS_TILES}];
  uniform vec4 uStamps[${MAX_SAND_STAMPS}];
  uniform vec4 uStampParams[${MAX_SAND_STAMPS}];

  varying vec2 vUv;

  ${GERSTNER_WAVE_SAMPLE_GLSL}

  float evalBeachY(vec2 localXZ, float outerRadius) {
    float r = length(localXZ);
    float ang = atan(localXZ.y, localXZ.x);
    float stretch = 1.0 + sin(ang * 3.0) * 0.14 + cos(ang * 2.0) * 0.08;
    float maxR = max(outerRadius * stretch, 0.001);
    float normR = min(r / maxR, 1.0);
    if (normR <= 0.36) {
      return 1.42 - normR * 0.12;
    }
    float tSlope = clamp((normR - 0.36) / 0.64, 0.0, 1.0);
    return 1.38 - smoothstep(0.0, 1.0, tSlope) * 2.53;
  }

  void main() {
    int tileIdx = int(clamp(floor(vUv.x * ${SAND_ATLAS_TILES.toFixed(1)}), 0.0, ${(SAND_ATLAS_TILES - 1).toFixed(1)}));
    float tileMinU = float(tileIdx) / ${SAND_ATLAS_TILES.toFixed(1)};
    float texelX = 1.0 / ${SAND_ATLAS_W.toFixed(1)};
    float texelY = 1.0 / ${SAND_ATLAS_H.toFixed(1)};
    float tileMaxU = tileMinU + (1.0 / ${SAND_ATLAS_TILES.toFixed(1)}) - texelX;
    float tileSafeMinU = tileMinU + texelX;

    vec2 localUV = vec2((vUv.x - tileMinU) * ${SAND_ATLAS_TILES.toFixed(1)}, vUv.y);
    vec2 localXZ = (localUV - 0.5) * ${SAND_TILE_WORLD_SPAN.toFixed(1)};

    vec3 beach = uBeaches[0];
    if (tileIdx == 1) beach = uBeaches[1];
    else if (tileIdx == 2) beach = uBeaches[2];
    else if (tileIdx == 3) beach = uBeaches[3];
    else if (tileIdx == 4) beach = uBeaches[4];

    vec2 worldXZ = beach.xy + localXZ;

    float hC = (texture2D(uPrevTex, vUv).r - 0.5) * 0.8;
    float hL = (texture2D(uPrevTex, vec2(max(vUv.x - texelX, tileSafeMinU), vUv.y)).r - 0.5) * 0.8;
    float hR = (texture2D(uPrevTex, vec2(min(vUv.x + texelX, tileMaxU), vUv.y)).r - 0.5) * 0.8;
    float hD = (texture2D(uPrevTex, vec2(vUv.x, max(vUv.y - texelY, texelY))).r - 0.5) * 0.8;
    float hU = (texture2D(uPrevTex, vec2(vUv.x, min(vUv.y + texelY, 1.0 - texelY))).r - 0.5) * 0.8;

    float groundY = evalBeachY(localXZ, beach.z);
    vec2 wave = sampleGerstnerHeightSlope(
      worldXZ,
      uTime,
      uWindSpeed,
      uCurrentAngle,
      uMinHeight,
      uMaxHeight,
      uFrequency
    );

    // El agua suaviza lentamente huellas y surcos mediante difusión laplaciana + nivelado
    float wash = smoothstep(-0.22, 0.08, wave.x - groundY);
    float avgN = (hL + hR + hD + hU) * 0.25;
    float diffused = mix(hC, avgN, wash * min(0.68, uDt * 18.0));
    float decayRate = mix(0.012, 1.35, wash);
    float h = diffused * exp(-decayRate * uDt);

    // Estampar huellas de pasos / arrastre de bote (fondo hundido + borde elevado)
    for (int i = 0; i < ${MAX_SAND_STAMPS}; i++) {
      vec4 st = uStamps[i];
      vec4 pm = uStampParams[i];
      if (pm.w > 0.5) {
        vec2 rel = worldXZ - st.xy;
        vec2 dir = normalize(st.zw + vec2(0.0, 0.0001));
        vec2 perp = vec2(-dir.y, dir.x);
        float longD = dot(rel, dir) / max(pm.x * pm.z, 0.05);
        float latD = dot(rel, perp) / max(pm.x, 0.05);
        float dNorm = length(vec2(latD, longD));

        if (dNorm < 0.92) {
          float k = dNorm / 0.92;
          float targetPit = -pm.y * pow(1.0 - k * k, 1.35);
          h = mix(h, min(h, targetPit), 0.78);
        } else if (dNorm < 1.85) {
          float rimP = (dNorm - 0.92) / 0.93;
          float targetRim = pm.y * 0.44 * sin(rimP * 3.14159265);
          if (h > -0.02) {
            h = mix(h, max(h, targetRim), 0.6);
          }
        }
      }
    }

    float encoded = clamp(0.5 + clamp(h, -0.34, 0.34) / 0.8, 0.0, 1.0);
    gl_FragColor = vec4(encoded, encoded, encoded, 1.0);
  }
`;

interface SandSimInstance {
  rt: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  pingIdx: number;
  initialized: boolean;
  scene: THREE.Scene;
  cam: THREE.OrthographicCamera;
  mat: THREE.ShaderMaterial;
  lastFootPos: THREE.Vector2;
  footParity: number;
  lastShipStampPos: THREE.Vector2;
}

function createSandSim(gl: THREE.WebGLRenderer): SandSimInstance {
  const canHalfFloat = Boolean(
    gl.extensions.get('EXT_color_buffer_float') || gl.extensions.get('EXT_color_buffer_half_float')
  );
  const rtOpts: THREE.RenderTargetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: canHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: SAND_QUAD_VERT,
    fragmentShader: SAND_UPDATE_FRAG,
    uniforms: {
      uPrevTex: { value: null },
      uDt: { value: 0.016 },
      uTime: { value: 0 },
      uWindSpeed: { value: 12 },
      uCurrentAngle: { value: 0.45 },
      uMinHeight: { value: 0.35 },
      uMaxHeight: { value: 1.05 },
      uFrequency: { value: 0.85 },
      uBeaches: {
        value: SAND_BEACH_SPECS.map((b) => new THREE.Vector3(b.cx, b.cz, b.outerRadius)),
      },
      uStamps: {
        value: Array.from({ length: MAX_SAND_STAMPS }, () => new THREE.Vector4()),
      },
      uStampParams: {
        value: Array.from({ length: MAX_SAND_STAMPS }, () => new THREE.Vector4()),
      },
    },
  });

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  return {
    rt: [
      new THREE.WebGLRenderTarget(SAND_ATLAS_W, SAND_ATLAS_H, rtOpts),
      new THREE.WebGLRenderTarget(SAND_ATLAS_W, SAND_ATLAS_H, rtOpts),
    ],
    pingIdx: 0,
    initialized: false,
    scene,
    cam,
    mat,
    lastFootPos: new THREE.Vector2(999, 999),
    footParity: 1,
    lastShipStampPos: new THREE.Vector2(999, 999),
  };
}

interface SandSimulationProps {
  phase: GamePhase;
  oceanParamsRef: React.RefObject<OceanParams>;
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  playerPosRef: React.RefObject<THREE.Vector3>;
  stampQueueRef: React.RefObject<SandStampItem[]>;
  sandStateRef: React.RefObject<SandSharedState>;
}

const _prevClearColor = new THREE.Color();

export function SandSimulation({
  phase,
  oceanParamsRef,
  shipTelemetryRef,
  playerPosRef,
  stampQueueRef,
  sandStateRef,
}: SandSimulationProps) {
  const { gl } = useThree();
  const simRef = useRef<SandSimInstance | null>(null);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.getElapsedTime();

    if (!simRef.current) {
      simRef.current = createSandSim(gl);
    }
    const sim = simRef.current;

    const prevTarget = gl.getRenderTarget();

    if (!sim.initialized) {
      gl.getClearColor(_prevClearColor);
      const prevAlpha = gl.getClearAlpha();
      gl.setClearColor(new THREE.Color(0.5, 0.5, 0.5), 1.0);
      gl.setRenderTarget(sim.rt[0]);
      gl.clear();
      gl.setRenderTarget(sim.rt[1]);
      gl.clear();
      gl.setClearColor(_prevClearColor, prevAlpha);
      sim.initialized = true;
    }

    // 1. Huellas automáticas de pasos del jugador sobre playa cercana
    if (phase === 'boarding' || phase === 'title') {
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;
      const dxFoot = px - sim.lastFootPos.x;
      const dzFoot = pz - sim.lastFootPos.y;
      const stepDist = Math.hypot(dxFoot, dzFoot);

      if (stepDist >= 0.58 && stepDist < 8.0) {
        const home = SAND_BEACH_SPECS[0];
        if (Math.hypot(px - home.cx, pz - home.cz) < home.outerRadius) {
          const dirX = dxFoot / stepDist;
          const dirZ = dzFoot / stepDist;
          sim.footParity *= -1;
          const lateral = sim.footParity * 0.18;
          queueSandStamp(stampQueueRef, {
            x: px - dirZ * lateral,
            z: pz + dirX * lateral,
            dirX,
            dirZ,
            radius: 0.34,
            depth: 0.11,
            aspect: 1.55,
          });
        }
        sim.lastFootPos.set(px, pz);
      } else if (sim.lastFootPos.x > 500) {
        sim.lastFootPos.set(px, pz);
      }
    }

    // 2. Arrastre de quilla / casco en playas poco profundas al navegar cerca de las orillas
    const ship = shipTelemetryRef.current;
    if (phase === 'sailing' && Math.abs(ship.speed) > 0.35) {
      const sinH = Math.sin(ship.heading);
      const cosH = Math.cos(ship.heading);
      const keelX = ship.x - sinH * 2.2;
      const keelZ = ship.z - cosH * 2.2;
      const dragDist = Math.hypot(keelX - sim.lastShipStampPos.x, keelZ - sim.lastShipStampPos.y);

      if (dragDist >= 0.55) {
        for (const beach of SAND_BEACH_SPECS) {
          if (Math.hypot(keelX - beach.cx, keelZ - beach.cz) < beach.outerRadius - 0.15) {
            queueSandStamp(stampQueueRef, {
              x: keelX,
              z: keelZ,
              dirX: -sinH,
              dirZ: -cosH,
              radius: 0.78,
              depth: 0.15,
              aspect: 2.05,
            });
            break;
          }
        }
        sim.lastShipStampPos.set(keelX, keelZ);
      }
    }

    const params = oceanParamsRef.current;
    const readIdx = sim.pingIdx;
    const writeIdx = 1 - readIdx;

    const uStamps = sim.mat.uniforms.uStamps.value as THREE.Vector4[];
    const uStampParams = sim.mat.uniforms.uStampParams.value as THREE.Vector4[];
    const queue = stampQueueRef.current;

    for (let i = 0; i < MAX_SAND_STAMPS; i += 1) {
      if (i < queue.length) {
        const s = queue[i];
        uStamps[i].set(s.x, s.z, s.dirX, s.dirZ);
        uStampParams[i].set(s.radius, s.depth, s.aspect, 1.0);
      } else {
        uStampParams[i].set(0, 0, 1, 0);
      }
    }
    queue.length = 0;

    sim.mat.uniforms.uPrevTex.value = sim.rt[readIdx].texture;
    sim.mat.uniforms.uDt.value = dt;
    sim.mat.uniforms.uTime.value = t;
    sim.mat.uniforms.uWindSpeed.value = params.windSpeed;
    sim.mat.uniforms.uCurrentAngle.value = params.currentAngle;
    sim.mat.uniforms.uMinHeight.value = params.minWaveHeight;
    sim.mat.uniforms.uMaxHeight.value = params.maxWaveHeight;
    sim.mat.uniforms.uFrequency.value = params.waveFrequency;

    gl.setRenderTarget(sim.rt[writeIdx]);
    gl.render(sim.scene, sim.cam);
    gl.setRenderTarget(prevTarget);

    sim.pingIdx = writeIdx;
    sandStateRef.current.texture = sim.rt[writeIdx].texture;
    sandStateRef.current.time = t;
  });

  return null;
}
