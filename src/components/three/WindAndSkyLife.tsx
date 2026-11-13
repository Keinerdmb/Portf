import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ISLANDS } from '../../data/islands';
import { ATARDECER_PALETTE } from '../../data/palette';
import type { DynamicWindState } from '../../types/portfolio';

interface WindAndSkyLifeProps {
  shipPosRef: React.RefObject<{ x: number; z: number }>;
  liveWindRef: React.RefObject<DynamicWindState>;
}

const RIBBON_COUNT = 26;
const RIBBON_SEGMENTS = 16;
const BOUND_RADIUS = 56;

interface RibbonParticle {
  ox: number;
  oy: number;
  oz: number;
  speedMul: number;
  phase: number;
  halfWidth: number;
  lifeFade: number;
  points: Float32Array;
}

const RIBBON_VERTEX_SHADER = `
  attribute float aRibbonSeed;
  attribute float aRibbonFade;
  varying vec2 vUv;
  varying float vSeed;
  varying float vFade;

  void main() {
    vUv = uv;
    vSeed = aRibbonSeed;
    vFade = aRibbonFade;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIBBON_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uWindSpeed;
  uniform float uGust;
  uniform vec3 uBaseColor;
  uniform vec3 uGustColor;

  varying vec2 vUv;
  varying float vSeed;
  varying float vFade;

  void main() {
    float crossProfile = pow(sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265), 1.45);
    float alongFade = smoothstep(0.0, 0.22, vUv.x) * (1.0 - smoothstep(0.35, 1.0, vUv.x));

    float pulse = 0.72 + 0.28 * sin(vUv.x * 11.0 - uTime * (4.5 + uWindSpeed * 0.28) + vSeed * 6.2831);
    float windAlpha = clamp(0.14 + (uWindSpeed / 26.0) * 0.24 + uGust * 0.22, 0.10, 0.56);

    vec3 col = mix(uBaseColor, uGustColor, clamp(uGust * 0.85 + pulse * 0.2, 0.0, 1.0));
    float alpha = crossProfile * alongFade * pulse * windAlpha * vFade;

    if (alpha < 0.008) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

function initRibbonPoints(
  points: Float32Array,
  hx: number,
  hy: number,
  hz: number,
  dirX: number,
  dirZ: number,
  segLen: number
) {
  for (let s = 0; s < RIBBON_SEGMENTS; s += 1) {
    points[s * 3] = hx - dirX * s * segLen;
    points[s * 3 + 1] = hy;
    points[s * 3 + 2] = hz - dirZ * s * segLen;
  }
}

function createRibbons(): RibbonParticle[] {
  return Array.from({ length: RIBBON_COUNT }, (_, i) => {
    const ox = Math.sin(i * 19.31 + 0.7) * BOUND_RADIUS * 0.9;
    const oy = 2.4 + ((i * 1.73) % 10.5);
    const oz = Math.cos(i * 7.73 + 1.4) * BOUND_RADIUS * 0.9;
    const pts = new Float32Array(RIBBON_SEGMENTS * 3);
    initRibbonPoints(pts, ox, oy, oz, 0.43, -0.9, 0.4);
    return {
      ox,
      oy,
      oz,
      speedMul: 0.78 + (i % 5) * 0.12,
      phase: i * 1.37,
      halfWidth: 0.085 + (i % 3) * 0.032,
      lifeFade: 1,
      points: pts,
    };
  });
}

function initRibbonGeometry(geo: THREE.BufferGeometry | null) {
  if (!geo || geo.userData.ribbonInitialized) return;
  geo.userData.ribbonInitialized = true;

  const vertCount = RIBBON_COUNT * RIBBON_SEGMENTS * 2;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const seeds = new Float32Array(vertCount);
  const fades = new Float32Array(vertCount);
  const indices: number[] = [];

  for (let r = 0; r < RIBBON_COUNT; r += 1) {
    const seed = (r * 0.6180339887) % 1;
    for (let s = 0; s < RIBBON_SEGMENTS; s += 1) {
      const u = s / (RIBBON_SEGMENTS - 1);
      const vBase = (r * RIBBON_SEGMENTS + s) * 2;
      uvs[vBase * 2] = u;
      uvs[vBase * 2 + 1] = 0;
      uvs[(vBase + 1) * 2] = u;
      uvs[(vBase + 1) * 2 + 1] = 1;
      seeds[vBase] = seed;
      seeds[vBase + 1] = seed;
      fades[vBase] = 1;
      fades[vBase + 1] = 1;

      if (s < RIBBON_SEGMENTS - 1) {
        const i0 = vBase;
        const i1 = vBase + 1;
        const i2 = vBase + 2;
        const i3 = vBase + 3;
        indices.push(i0, i1, i2, i2, i1, i3);
      }
    }
  }

  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const fadeAttr = new THREE.BufferAttribute(fades, 1);
  fadeAttr.setUsage(THREE.DynamicDrawUsage);

  geo.setAttribute('position', posAttr);
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aRibbonSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aRibbonFade', fadeAttr);
  geo.setIndex(indices);
}

export function WindAndSkyLife({ shipPosRef, liveWindRef }: WindAndSkyLifeProps) {
  const birdGroupsRef = useRef<(THREE.Group | null)[]>([]);
  const leftWingsRef = useRef<(THREE.Mesh | null)[]>([]);
  const rightWingsRef = useRef<(THREE.Mesh | null)[]>([]);
  const ribbonMeshRef = useRef<THREE.Mesh>(null);
  const ribbonMatRef = useRef<THREE.ShaderMaterial>(null);
  const ribbonsRef = useRef<RibbonParticle[] | null>(null);

  const ribbonUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWindSpeed: { value: 12 },
      uGust: { value: 0 },
      uBaseColor: { value: new THREE.Color(ATARDECER_PALETTE.windCream) },
      uGustColor: { value: new THREE.Color(ATARDECER_PALETTE.sunGlow) },
    }),
    []
  );

  // Bandadas de gaviotas low-poly sobrevolando cerca de las islas
  const birdsData = useMemo(
    () =>
      ISLANDS.flatMap((island, iIdx) =>
        [0, 1].map((bIdx) => ({
          cx: island.position[0],
          cz: island.position[1],
          radius: 11 + bIdx * 4,
          height: 12 + (iIdx % 2) * 2.5 + bIdx * 1.5,
          speed: 0.35 + bIdx * 0.1,
          phase: iIdx * 1.7 + bIdx * 2.4,
        }))
      ),
    []
  );

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.getElapsedTime();
    const wind = liveWindRef.current;

    if (!ribbonsRef.current) {
      ribbonsRef.current = createRibbons();
    }

    const sx = shipPosRef.current.x;
    const sz = shipPosRef.current.z;
    const windSpeed = wind.speed;
    const gust = wind.gustIntensity;
    const dirX = wind.dirX;
    const dirZ = wind.dirZ;

    if (ribbonMatRef.current) {
      ribbonMatRef.current.uniforms.uTime.value = t;
      ribbonMatRef.current.uniforms.uWindSpeed.value = windSpeed;
      ribbonMatRef.current.uniforms.uGust.value = gust;
    }

    const ribbonGeo = ribbonMeshRef.current?.geometry;
    const posAttr = ribbonGeo?.getAttribute('position') as THREE.BufferAttribute | undefined;
    const fadeAttr = ribbonGeo?.getAttribute('aRibbonFade') as THREE.BufferAttribute | undefined;
    const ribbons = ribbonsRef.current;
    const segLen = 0.25 + (windSpeed / 26) * 0.36 + gust * 0.24;
    const advSpeed = 4.0 + windSpeed * 1.18 + gust * 7.5;

    if (posAttr && fadeAttr) {
      for (let r = 0; r < RIBBON_COUNT; r += 1) {
        const rb = ribbons[r];
        const travel = advSpeed * rb.speedMul * dt;

        const curlX = Math.cos(t * 1.8 + rb.phase + rb.oy * 0.35) * (0.65 + gust * 0.9);
        const curlZ = Math.sin(t * 1.6 + rb.phase * 1.3) * (0.65 + gust * 0.9);
        const curlY = Math.sin(t * 2.6 + rb.phase + rb.ox * 0.12) * (0.9 + gust * 0.8);

        rb.ox += dirX * travel + curlX * dt;
        rb.oz += dirZ * travel + curlZ * dt;
        rb.oy = THREE.MathUtils.clamp(rb.oy + curlY * dt, 2.2, 13.8);

        let wrapped = false;
        if (rb.ox > BOUND_RADIUS) {
          rb.ox -= BOUND_RADIUS * 2;
          wrapped = true;
        } else if (rb.ox < -BOUND_RADIUS) {
          rb.ox += BOUND_RADIUS * 2;
          wrapped = true;
        }
        if (rb.oz > BOUND_RADIUS) {
          rb.oz -= BOUND_RADIUS * 2;
          wrapped = true;
        } else if (rb.oz < -BOUND_RADIUS) {
          rb.oz += BOUND_RADIUS * 2;
          wrapped = true;
        }

        const hx = sx + rb.ox;
        const hy = rb.oy;
        const hz = sz + rb.oz;

        if (wrapped) {
          initRibbonPoints(rb.points, hx, hy, hz, dirX, dirZ, segLen);
          rb.lifeFade = 0;
        } else {
          rb.lifeFade = Math.min(1, rb.lifeFade + dt * 2.6);
          rb.points[0] = hx;
          rb.points[1] = hy;
          rb.points[2] = hz;
          for (let s = 1; s < RIBBON_SEGMENTS; s += 1) {
            const px = rb.points[(s - 1) * 3];
            const py = rb.points[(s - 1) * 3 + 1];
            const pz = rb.points[(s - 1) * 3 + 2];
            let dx = rb.points[s * 3] - px;
            let dy = rb.points[s * 3 + 1] - py;
            let dz = rb.points[s * 3 + 2] - pz;
            const dist = Math.hypot(dx, dy, dz);
            if (dist > 0.0001) {
              const inv = segLen / dist;
              dx *= inv;
              dy *= inv;
              dz *= inv;
              rb.points[s * 3] = px + dx;
              rb.points[s * 3 + 1] = py + dy;
              rb.points[s * 3 + 2] = pz + dz;
            } else {
              rb.points[s * 3] = px - dirX * segLen;
              rb.points[s * 3 + 1] = py;
              rb.points[s * 3 + 2] = pz - dirZ * segLen;
            }
          }
        }

        const edgeDist = Math.max(Math.abs(rb.ox), Math.abs(rb.oz)) / BOUND_RADIUS;
        const boxFade = 1.0 - THREE.MathUtils.smoothstep(edgeDist, 0.78, 1.0);
        const totalFade = rb.lifeFade * boxFade;

        for (let s = 0; s < RIBBON_SEGMENTS; s += 1) {
          const cx = rb.points[s * 3];
          const cy = rb.points[s * 3 + 1];
          const cz = rb.points[s * 3 + 2];

          const prevIdx = Math.max(0, s - 1);
          const nextIdx = Math.min(RIBBON_SEGMENTS - 1, s + 1);
          const tx = rb.points[nextIdx * 3] - rb.points[prevIdx * 3];
          const ty = rb.points[nextIdx * 3 + 1] - rb.points[prevIdx * 3 + 1];
          const tz = rb.points[nextIdx * 3 + 2] - rb.points[prevIdx * 3 + 2];

          const twist = s * 0.18 + t * (2.5 + gust * 2.5) + rb.phase;
          const upX = Math.sin(twist) * 0.42;
          const upY = 1.0;
          const upZ = Math.cos(twist) * 0.42;

          let sideX = ty * upZ - tz * upY;
          let sideY = tz * upX - tx * upZ;
          let sideZ = tx * upY - ty * upX;
          const sLen = Math.hypot(sideX, sideY, sideZ) || 1;
          sideX /= sLen;
          sideY /= sLen;
          sideZ /= sLen;

          const u = s / (RIBBON_SEGMENTS - 1);
          const wProfile = Math.sin(u * Math.PI) * (0.85 + gust * 0.55);
          const halfW = rb.halfWidth * wProfile;

          const vIdx = (r * RIBBON_SEGMENTS + s) * 2;
          posAttr.setXYZ(vIdx, cx - sideX * halfW, cy - sideY * halfW, cz - sideZ * halfW);
          posAttr.setXYZ(vIdx + 1, cx + sideX * halfW, cy + sideY * halfW, cz + sideZ * halfW);
          fadeAttr.setX(vIdx, totalFade);
          fadeAttr.setX(vIdx + 1, totalFade);
        }
      }

      posAttr.needsUpdate = true;
      fadeAttr.needsUpdate = true;
    }

    // Gaviotas planeando y batiendo alas suavemente
    for (let i = 0; i < birdsData.length; i += 1) {
      const b = birdsData[i];
      const grp = birdGroupsRef.current[i];
      if (!grp) continue;

      const ang = t * b.speed + b.phase;
      const bx = b.cx + Math.cos(ang) * b.radius;
      const bz = b.cz + Math.sin(ang) * b.radius;
      const by = b.height + Math.sin(t * 2 + b.phase) * 0.5;

      grp.position.set(bx, by, bz);
      grp.rotation.y = -ang;

      const flap = Math.sin(t * 7.5 + b.phase * 3) * 0.45;
      const lw = leftWingsRef.current[i];
      const rw = rightWingsRef.current[i];
      if (lw) lw.rotation.z = flap;
      if (rw) rw.rotation.z = -flap;
    }
  });

  return (
    <group>
      {/* Estelas de viento semi-transparentes (Ribbon Trails) */}
      <mesh ref={ribbonMeshRef} frustumCulled={false} renderOrder={3}>
        <bufferGeometry ref={initRibbonGeometry} />
        <shaderMaterial
          ref={ribbonMatRef}
          vertexShader={RIBBON_VERTEX_SHADER}
          fragmentShader={RIBBON_FRAGMENT_SHADER}
          uniforms={ribbonUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Gaviotas estilizadas */}
      {birdsData.map((_, idx) => (
        <group
          key={`bird-${idx}`}
          ref={(el) => {
            birdGroupsRef.current[idx] = el;
          }}
        >
          <mesh
            ref={(el) => {
              leftWingsRef.current[idx] = el;
            }}
            position={[-0.25, 0, 0]}
          >
            <boxGeometry args={[0.5, 0.05, 0.16]} />
            <meshBasicMaterial color={ATARDECER_PALETTE.gullApricot} />
          </mesh>
          <mesh
            ref={(el) => {
              rightWingsRef.current[idx] = el;
            }}
            position={[0.25, 0, 0]}
          >
            <boxGeometry args={[0.5, 0.05, 0.16]} />
            <meshBasicMaterial color={ATARDECER_PALETTE.gullApricot} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
