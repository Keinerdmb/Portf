import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import { ATARDECER_PALETTE } from '../../data/palette';
import type {
  GamePhase,
  IslandId,
  OceanParams,
  ShipTelemetry,
} from '../../types/portfolio';
import {
  sampleGerstnerSurface,
  stepBuoyantBody,
  WORLD_COLLIDERS,
} from '../../utils/oceanMath';
import { PirateCharacter } from './PirateCharacter';

interface PirateShipProps {
  phase: GamePhase;
  isFirstPerson: boolean;
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  shipPosRef: React.RefObject<{ x: number; z: number }>;
  oceanParamsRef: React.RefObject<OceanParams>;
  activeModalIsland: IslandId | null;
  onNearbyIslandChange: (islandId: IslandId | null) => void;
  onHullCollision: () => void;
  mobileInputRef: React.RefObject<{ forward: number; turn: number }>;
}

const SHIP_RADIUS = 2.75;

interface HullStation {
  z: number;
  halfW: number;
  keelY: number;
  sheerY: number;
}

function buildSculptedBoatGeometries() {
  const stations: HullStation[] = [
    { z: -4.95, halfW: 0.04, keelY: 0.45, sheerY: 1.56 },
    { z: -4.15, halfW: 0.68, keelY: -0.1, sheerY: 1.42 },
    { z: -3.0, halfW: 1.18, keelY: -0.22, sheerY: 1.3 },
    { z: -1.6, halfW: 1.44, keelY: -0.25, sheerY: 1.24 },
    { z: -0.2, halfW: 1.48, keelY: -0.25, sheerY: 1.24 },
    { z: 0.9, halfW: 1.42, keelY: -0.22, sheerY: 1.28 },
    { z: 1.5, halfW: 1.35, keelY: -0.18, sheerY: 1.46 },
    { z: 2.5, halfW: 1.22, keelY: -0.1, sheerY: 1.52 },
    { z: 3.15, halfW: 1.05, keelY: 0.05, sheerY: 1.58 },
  ];

  const hullVerts: number[] = [];
  const deckVerts: number[] = [];

  const pushTri = (arr: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  const pushQuad = (
    arr: number[],
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3
  ) => {
    pushTri(arr, a, b, c);
    pushTri(arr, a, c, d);
  };

  for (let i = 0; i < stations.length - 1; i += 1) {
    const s0 = stations[i];
    const s1 = stations[i + 1];
    const deckY = 0.78;
    const thickness = 0.11;

    const k0 = new THREE.Vector3(0, s0.keelY, s0.z);
    const lb0 = new THREE.Vector3(-s0.halfW * 0.72, 0.25, s0.z);
    const rb0 = new THREE.Vector3(s0.halfW * 0.72, 0.25, s0.z);
    const lt0 = new THREE.Vector3(-s0.halfW, s0.sheerY, s0.z);
    const rt0 = new THREE.Vector3(s0.halfW, s0.sheerY, s0.z);

    const k1 = new THREE.Vector3(0, s1.keelY, s1.z);
    const lb1 = new THREE.Vector3(-s1.halfW * 0.72, 0.25, s1.z);
    const rb1 = new THREE.Vector3(s1.halfW * 0.72, 0.25, s1.z);
    const lt1 = new THREE.Vector3(-s1.halfW, s1.sheerY, s1.z);
    const rt1 = new THREE.Vector3(s1.halfW, s1.sheerY, s1.z);

    pushQuad(hullVerts, k0, k1, lb1, lb0);
    pushQuad(hullVerts, lb0, lb1, lt1, lt0);
    pushQuad(hullVerts, k0, rb0, rb1, k1);
    pushQuad(hullVerts, rb0, rt0, rt1, rb1);

    const lti0 = new THREE.Vector3(-Math.max(0, s0.halfW - thickness), s0.sheerY, s0.z);
    const lti1 = new THREE.Vector3(-Math.max(0, s1.halfW - thickness), s1.sheerY, s1.z);
    const rti0 = new THREE.Vector3(Math.max(0, s0.halfW - thickness), s0.sheerY, s0.z);
    const rti1 = new THREE.Vector3(Math.max(0, s1.halfW - thickness), s1.sheerY, s1.z);

    const ld0 = new THREE.Vector3(-Math.max(0, s0.halfW * 0.85 - thickness), deckY, s0.z);
    const ld1 = new THREE.Vector3(-Math.max(0, s1.halfW * 0.85 - thickness), deckY, s1.z);
    const rd0 = new THREE.Vector3(Math.max(0, s0.halfW * 0.85 - thickness), deckY, s0.z);
    const rd1 = new THREE.Vector3(Math.max(0, s1.halfW * 0.85 - thickness), deckY, s1.z);

    pushQuad(hullVerts, lt0, lt1, lti1, lti0);
    pushQuad(hullVerts, rti0, rti1, rt1, rt0);
    pushQuad(hullVerts, lti0, lti1, ld1, ld0);
    pushQuad(hullVerts, rd0, rd1, rti1, rti0);
    pushQuad(deckVerts, ld0, ld1, rd1, rd0);
  }

  const last = stations[stations.length - 1];
  const lk = new THREE.Vector3(0, last.keelY, last.z);
  const llb = new THREE.Vector3(-last.halfW * 0.72, 0.25, last.z);
  const lrb = new THREE.Vector3(last.halfW * 0.72, 0.25, last.z);
  const llt = new THREE.Vector3(-last.halfW, last.sheerY, last.z);
  const lrt = new THREE.Vector3(last.halfW, last.sheerY, last.z);
  pushTri(hullVerts, lk, lrb, llb);
  pushQuad(hullVerts, llb, lrb, lrt, llt);

  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(hullVerts, 3));
  hullGeo.computeVertexNormals();

  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckVerts, 3));
  deckGeo.computeVertexNormals();

  const sailGeo = new THREE.PlaneGeometry(4.2, 4.4, 7, 7);
  const posAttr = sailGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i += 1) {
    const px = posAttr.getX(i) + 2.1;
    const py = posAttr.getY(i) + 2.2;
    const u = px / 4.2;
    const v = py / 4.4;
    const maxWidthAtV = THREE.MathUtils.lerp(4.2, 0.55, v * 0.92);
    const nx = u * maxWidthAtV;
    const ny = py + u * 0.45 * (1 - v);
    const belly = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.65;
    posAttr.setXYZ(i, nx, ny, belly);
  }
  sailGeo.computeVertexNormals();

  return { hullGeo, deckGeo, sailGeo };
}

interface HullCausticsUniforms {
  uCausticTime: { value: number };
  uWaterlineY: { value: number };
}

function setupHullCausticsMaterial(mat: THREE.MeshStandardMaterial | null) {
  if (!mat || mat.userData.causticsUniforms) return;

  const uniforms: HullCausticsUniforms = {
    uCausticTime: { value: 0 },
    uWaterlineY: { value: 0 },
  };
  mat.userData.causticsUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCausticTime = uniforms.uCausticTime;
    shader.uniforms.uWaterlineY = uniforms.uWaterlineY;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vHullWorldPos;
varying vec3 vHullLocalPos;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vHullLocalPos = position;
vHullWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uCausticTime;
uniform float uWaterlineY;
varying vec3 vHullWorldPos;
varying vec3 vHullLocalPos;

float hullCausticNet(vec2 p, float t) {
  vec2 a = p * 2.15 + vec2(t * 0.42, -t * 0.31);
  vec2 b = p * 2.75 + vec2(-t * 0.36, t * 0.48);
  float w1 = sin(a.x * 2.4 + cos(a.y * 2.1 - t * 1.1));
  float w2 = sin(b.y * 2.7 - sin(b.x * 2.2 + t * 0.95));
  float ridg = 1.0 - abs(w1 + w2) * 0.5;
  return pow(clamp(ridg, 0.0, 1.0), 4.0);
}`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float depthBelowWater = uWaterlineY - vHullWorldPos.y;
float wetBand = smoothstep(-0.32, 0.08, depthBelowWater);
diffuseColor.rgb *= mix(1.0, 0.72, wetBand);
float submerged = smoothstep(-0.18, 0.25, depthBelowWater) * (1.0 - smoothstep(1.2, 2.4, depthBelowWater));
vec2 causticUV = vHullWorldPos.xz + vec2(vHullLocalPos.y * 0.65, -vHullLocalPos.y * 0.45);
float cA = hullCausticNet(causticUV, uCausticTime);
float cB = hullCausticNet(causticUV * 1.45 + 3.1, -uCausticTime * 0.8);
float caustic = cA * 0.65 + cB * 0.45;
totalEmissiveRadiance += vec3(0.24, 0.86, 0.78) * caustic * submerged * 0.62;`
      );
  };
  mat.customProgramCacheKey = () => 'hull-caustics-v1';
  mat.needsUpdate = true;
}

function syncHullCaustics(mat: THREE.MeshStandardMaterial | null, time: number, waterlineY: number) {
  const uniforms = mat?.userData.causticsUniforms as HullCausticsUniforms | undefined;
  if (!uniforms) return;
  uniforms.uCausticTime.value = time;
  uniforms.uWaterlineY.value = waterlineY;
}

export function PirateShip({
  phase,
  isFirstPerson,
  shipTelemetryRef,
  shipPosRef,
  oceanParamsRef,
  activeModalIsland,
  onNearbyIslandChange,
  onHullCollision,
  mobileInputRef,
}: PirateShipProps) {
  const shipGroupRef = useRef<THREE.Group>(null);
  const wheelRef = useRef<THREE.Group>(null);
  const boomGroupRef = useRef<THREE.Group>(null);
  const sailMeshRef = useRef<THREE.Mesh>(null);
  const flagRef = useRef<THREE.Mesh>(null);

  const keysRef = useRef<Set<string>>(new Set());
  const lastNearbyRef = useRef<IslandId | null>(null);
  const lastCollisionTimeRef = useRef(0);
  const impactRollRef = useRef(0);
  const delayedWavePitchRef = useRef(0);
  const delayedWaveRollRef = useRef(0);
  const hullMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const { hullGeo, deckGeo, sailGeo } = useMemo(() => buildSculptedBoatGeometries(), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    const onBlur = () => keysRef.current.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.getElapsedTime();
    const state = shipTelemetryRef.current;
    const params = oceanParamsRef.current;

    let targetTurn = 0;
    let thrust = 0;

    if (phase === 'sailing' && !activeModalIsland) {
      const keys = keysRef.current;
      if (keys.has('KeyW') || keys.has('ArrowUp')) thrust += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) thrust -= 0.55;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) targetTurn += 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) targetTurn -= 1;

      thrust += mobileInputRef.current.forward;
      targetTurn += mobileInputRef.current.turn;
    }

    // Física de viento y corriente en tiempo real (producto punto entre proa y viento)
    const windAlign = Math.cos(state.heading + params.currentAngle);
    state.windAlignment = windAlign;
    const windScale = 0.75 + (params.windSpeed / 15) * 0.45;
    const windBonus = windScale * (1 + windAlign * 0.25);
    const maxSpeed = 18 * windBonus;

    if (thrust !== 0) {
      const targetSpd = thrust > 0 ? thrust * maxSpeed : thrust * 10;
      state.speed = THREE.MathUtils.lerp(state.speed, targetSpd, dt * 2.1);
    } else {
      state.speed = THREE.MathUtils.lerp(state.speed, 0, dt * 1.25);
    }

    state.steerAngle = THREE.MathUtils.lerp(state.steerAngle, targetTurn, dt * 5.2);
    const turnAuthority = 0.45 + Math.min(Math.abs(state.speed) / 18, 1) * 0.75;
    state.heading += state.steerAngle * turnAuthority * dt * 1.4;

    state.x -= Math.sin(state.heading) * state.speed * dt;
    state.z -= Math.cos(state.heading) * state.speed * dt;

    // Deriva sutil por corriente del agua cuando navega
    if (phase === 'sailing') {
      const currentDrift = (params.windSpeed / 25) * 0.85;
      state.x += Math.sin(params.currentAngle) * currentDrift * dt;
      state.z -= Math.cos(params.currentAngle) * currentDrift * dt;
    }

    // Colisiones reales con islas, muelle y costa
    if (phase === 'sailing') {
      for (const col of WORLD_COLLIDERS) {
        const dx = state.x - col.x;
        const dz = state.z - col.z;
        const minDist = col.radius + SHIP_RADIUS;
        const distSq = dx * dx + dz * dz;

        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const nz = dz / dist;

          state.x = col.x + nx * minDist;
          state.z = col.z + nz * minDist;

          const dirX = -Math.sin(state.heading);
          const dirZ = -Math.cos(state.heading);
          const impactDot = dirX * nx + dirZ * nz;
          if (impactDot < -0.15) {
            state.speed *= 0.35;
            impactRollRef.current = (Math.random() > 0.5 ? 1 : -1) * 0.14;
            if (t - lastCollisionTimeRef.current > 0.45) {
              lastCollisionTimeRef.current = t;
              onHullCollision();
            }
          }
        }
      }
    }

    state.x = THREE.MathUtils.clamp(state.x, -165, 165);
    state.z = THREE.MathUtils.clamp(state.z, -175, 110);
    shipPosRef.current.x = state.x;
    shipPosRef.current.z = state.z;

    // Muestreo en 4 puntos (proa, popa, babor, estribor) + inercia pesada de galeón
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);

    const bowS = sampleGerstnerSurface(state.x - sinH * 3.8, state.z - cosH * 3.8, t, params);
    const sternS = sampleGerstnerSurface(state.x + sinH * 2.8, state.z + cosH * 2.8, t, params);
    const portS = sampleGerstnerSurface(state.x - cosH * 1.35, state.z + sinH * 1.35, t, params);
    const starS = sampleGerstnerSurface(state.x + cosH * 1.35, state.z - sinH * 1.35, t, params);

    const avgWaveY = (bowS.height + sternS.height + portS.height + starS.height) * 0.25;
    // Rigidez reducida y mayor calado para simular la gran masa de madera
    const buoyant = stepBuoyantBody(state.y, state.velY, avgWaveY, dt, 15.5, 4.3, 0.04);
    state.y = buoyant.y;
    state.velY = buoyant.velY;

    const rawWavePitch = Math.atan2(bowS.height - sternS.height, 6.6);
    const rawWaveRoll = Math.atan2(starS.height - portS.height, 2.7);

    // Ligero retraso entre el impacto de la ola y la respuesta angular del casco
    delayedWavePitchRef.current = THREE.MathUtils.lerp(
      delayedWavePitchRef.current,
      rawWavePitch,
      dt * 3.1
    );
    delayedWaveRollRef.current = THREE.MathUtils.lerp(
      delayedWaveRollRef.current,
      rawWaveRoll,
      dt * 3.4
    );

    const speedNorm = THREE.MathUtils.clamp(state.speed / 16, -0.6, 1.35);
    const bowLift = speedNorm * 0.045;
    // Escora lateral pronunciada al girar el timón a alta velocidad
    const rudderHeelTarget = -state.steerAngle * speedNorm * Math.abs(speedNorm) * 0.165;

    const targetPitch = delayedWavePitchRef.current * 0.72 + bowLift;
    const targetRoll = delayedWaveRollRef.current * 0.68 + rudderHeelTarget;

    // Centro de gravedad bajo (par adrizante de quilla) + amortiguación angular alta (angular drag)
    const pitchTorque = (targetPitch - state.pitch) * 11.5 - state.pitchVel * 4.4;
    const rollTorque =
      (targetRoll - state.roll) * 10.5 - state.rollVel * 4.6 + impactRollRef.current * 9.0;

    state.pitchVel += pitchTorque * dt;
    state.rollVel += rollTorque * dt;
    state.pitch = THREE.MathUtils.clamp(state.pitch + state.pitchVel * dt, -0.34, 0.34);
    state.roll = THREE.MathUtils.clamp(state.roll + state.rollVel * dt, -0.42, 0.42);
    impactRollRef.current = THREE.MathUtils.lerp(impactRollRef.current, 0, dt * 5.0);

    syncHullCaustics(hullMatRef.current, t, avgWaveY + 0.18);

    if (shipGroupRef.current) {
      shipGroupRef.current.position.set(state.x, state.y, state.z);
      shipGroupRef.current.rotation.x = state.pitch;
      shipGroupRef.current.rotation.y = state.heading;
      shipGroupRef.current.rotation.z = state.roll;
    }

    if (wheelRef.current) {
      wheelRef.current.rotation.z = state.steerAngle * 1.45;
    }

    if (boomGroupRef.current) {
      const relWind = -(state.heading + params.currentAngle);
      const sailSweep = Math.sin(relWind) * 0.3 + 0.56;
      boomGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        boomGroupRef.current.rotation.y,
        THREE.MathUtils.clamp(sailSweep, 0.25, 1.05),
        dt * 2.5
      );
    }

    if (sailMeshRef.current) {
      const billow =
        1 +
        (params.windSpeed / 25) * 0.25 +
        (Math.max(state.speed, 0) / 22) * 0.28 +
        Math.sin(t * 3.5) * 0.04;
      sailMeshRef.current.scale.z = THREE.MathUtils.lerp(sailMeshRef.current.scale.z, billow, dt * 4);
    }

    if (flagRef.current) {
      const relWind = -(state.heading + params.currentAngle);
      flagRef.current.rotation.y = relWind + Math.sin(t * (4 + params.windSpeed * 0.25)) * 0.18;
    }

    if (phase === 'sailing') {
      let found: IslandId | null = null;
      for (const island of ISLANDS) {
        const dx = state.x - island.position[0];
        const dz = state.z - island.position[1];
        if (dx * dx + dz * dz <= island.dockRadius * island.dockRadius) {
          found = island.id;
          break;
        }
      }
      if (found !== lastNearbyRef.current) {
        lastNearbyRef.current = found;
        onNearbyIslandChange(found);
      }
    }
  });

  return (
    <group ref={shipGroupRef} position={[0, 0, 0]}>
      <mesh geometry={hullGeo}>
        <meshStandardMaterial
          ref={(el) => {
            hullMatRef.current = el;
            setupHullCausticsMaterial(el);
          }}
          color={ATARDECER_PALETTE.woodHull}
          flatShading
          roughness={0.82}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh geometry={deckGeo}>
        <meshStandardMaterial
          color={ATARDECER_PALETTE.woodDeck}
          flatShading
          roughness={0.86}
          side={THREE.DoubleSide}
        />
      </mesh>

      {[
        { z: -2.7, w: 1.45, y: 0.92 },
        { z: -1.45, w: 2.35, y: 0.92 },
        { z: -0.15, w: 2.45, y: 0.92 },
        { z: 0.85, w: 2.3, y: 0.96 },
      ].map((b) => (
        <mesh key={b.z} position={[0, b.y, b.z]}>
          <boxGeometry args={[b.w, 0.08, 0.34]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.woodTrim} flatShading />
        </mesh>
      ))}

      <mesh position={[0, 0.9, 2.15]}>
        <cylinderGeometry args={[1.05, 1.2, 0.24, 6]} />
        <meshStandardMaterial color={ATARDECER_PALETTE.woodPlank} flatShading />
      </mesh>

      <mesh position={[0, 1.48, -5.5]} rotation={[Math.PI / 2.2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.09, 2.0, 6]} />
        <meshStandardMaterial color={ATARDECER_PALETTE.woodPost} flatShading />
      </mesh>

      <group position={[-0.24, 1.25, -3.5]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.1, 0.13, 0.22, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.riggingDark} flatShading />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.11, 0.09, 0.28, 6]} />
          <meshStandardMaterial
            color={ATARDECER_PALETTE.lanternCore}
            emissive={ATARDECER_PALETTE.lanternEmissive}
            emissiveIntensity={3.0}
            flatShading
          />
        </mesh>
        <mesh position={[0, 0.56, 0]}>
          <coneGeometry args={[0.15, 0.16, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.hatPlum} flatShading />
        </mesh>
        <pointLight
          position={[0, 0.45, 0]}
          color={ATARDECER_PALETTE.lanternLight}
          intensity={5.5}
          distance={11}
        />
      </group>

      <group position={[0, 0.78, -0.95]}>
        <mesh position={[0, 3.25, 0]}>
          <cylinderGeometry args={[0.09, 0.15, 6.5, 8]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.woodDark} flatShading />
        </mesh>

        <mesh position={[-1.4, 0.46, 0.45]}>
          <boxGeometry args={[0.14, 0.16, 0.45]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.woodPost} flatShading />
        </mesh>
        <mesh position={[1.4, 0.46, 0.45]}>
          <boxGeometry args={[0.14, 0.16, 0.45]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.woodPost} flatShading />
        </mesh>

        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.74, 2.95, 0.18]} rotation={[0.04, 0, side * 0.25]}>
              <cylinderGeometry args={[0.02, 0.022, 5.2, 5]} />
              <meshStandardMaterial color={ATARDECER_PALETTE.riggingDark} flatShading />
            </mesh>
            <mesh position={[side * 0.72, 2.95, 0.48]} rotation={[0.08, 0, side * 0.24]}>
              <cylinderGeometry args={[0.018, 0.02, 5.2, 5]} />
              <meshStandardMaterial color={ATARDECER_PALETTE.riggingDark} flatShading />
            </mesh>
          </group>
        ))}

        <group ref={boomGroupRef} position={[0, 1.55, 0]} rotation={[0, 0.56, 0]}>
          <mesh position={[2.0, 0.22, 0]} rotation={[0, 0, Math.PI / 2 - 0.1]}>
            <cylinderGeometry args={[0.055, 0.085, 4.2, 7]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.woodPlank} flatShading />
          </mesh>
          <mesh ref={sailMeshRef} geometry={sailGeo} position={[0.05, 0.05, 0]}>
            <meshStandardMaterial
              color={ATARDECER_PALETTE.sailCream}
              roughness={0.82}
              flatShading
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>

        <group position={[0, 6.45, 0]}>
          <mesh ref={flagRef} position={[0, 0, -0.45]}>
            <coneGeometry args={[0.16, 0.9, 4]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.coralAccent} flatShading />
          </mesh>
        </group>
      </group>

      <group position={[0, 1.0, 1.38]}>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.14, 0.22, 0.72, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.woodDark} flatShading />
        </mesh>
        <group ref={wheelRef} position={[0, 0.75, 0.16]}>
          <mesh>
            <torusGeometry args={[0.46, 0.058, 7, 14]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.woodDeck} flatShading />
          </mesh>
          <mesh>
            <torusGeometry args={[0.24, 0.03, 6, 12]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.woodHull} flatShading />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.13, 8]} />
            <meshStandardMaterial color={ATARDECER_PALETTE.sandGold} flatShading />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
            const ang = (idx * Math.PI) / 4;
            return (
              <group key={idx} rotation={[0, 0, ang]}>
                <mesh position={[0, 0.25, 0]}>
                  <cylinderGeometry args={[0.025, 0.035, 0.44, 6]} />
                  <meshStandardMaterial color={ATARDECER_PALETTE.woodTrim} flatShading />
                </mesh>
                <mesh position={[0, 0.56, 0]}>
                  <cylinderGeometry args={[0.022, 0.042, 0.19, 6]} />
                  <meshStandardMaterial color={ATARDECER_PALETTE.sandGold} flatShading />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>

      {phase === 'sailing' && (
        <group position={[0, 1.02, 2.1]}>
          <PirateCharacter isWalking={false} hiddenInFirstPerson={isFirstPerson} />
        </group>
      )}
    </group>
  );
}
