import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { OceanParams, ShipTelemetry } from '../../types/portfolio';
import { sampleGerstnerSurface } from '../../utils/oceanMath';

interface WakeTrailProps {
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  oceanParamsRef: React.RefObject<OceanParams>;
}

const FOAM_COUNT = 34;
const SPRAY_COUNT = 30;

interface FoamNode {
  x: number;
  z: number;
  vx: number;
  vz: number;
  age: number;
  life: number;
  baseScale: number;
}

interface SprayNode {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
}

export function WakeTrail({ shipTelemetryRef, oceanParamsRef }: WakeTrailProps) {
  const foamMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sprayMeshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const foamNodesRef = useRef<FoamNode[]>(
    Array.from({ length: FOAM_COUNT }, () => ({
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      age: 10,
      life: 1,
      baseScale: 0.6,
    }))
  );
  const sprayNodesRef = useRef<SprayNode[]>(
    Array.from({ length: SPRAY_COUNT }, () => ({
      x: 0,
      y: -10,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 10,
      life: 1,
      size: 1,
    }))
  );

  const foamAccumRef = useRef(0);
  const foamCursorRef = useRef(0);
  const sprayAccumRef = useRef(0);
  const sprayCursorRef = useRef(0);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.getElapsedTime();
    const ship = shipTelemetryRef.current;
    const params = oceanParamsRef.current;
    const speedAbs = Math.abs(ship.speed);
    const sinH = Math.sin(ship.heading);
    const cosH = Math.cos(ship.heading);

    // 1. Estela de espuma blanca en popa y línea de flotación al cortar el agua
    if (speedAbs > 1.0) {
      foamAccumRef.current += dt * (6.0 + speedAbs * 0.65);
      while (foamAccumRef.current >= 1) {
        foamAccumRef.current -= 1;
        const idx = foamCursorRef.current % FOAM_COUNT;
        foamCursorRef.current += 1;

        const isBowSideWake = idx % 3 === 0 && ship.speed > 4.0;
        const sideSign = Math.random() > 0.5 ? 1 : -1;
        const longOffset = isBowSideWake ? -1.8 + Math.random() * 1.4 : 3.25;
        const latOffset = isBowSideWake
          ? sideSign * (1.05 + Math.random() * 0.25)
          : (Math.random() - 0.5) * 1.35;
        const driftLat = isBowSideWake ? sideSign * (1.2 + speedAbs * 0.06) : (Math.random() - 0.5) * 0.6;

        foamNodesRef.current[idx] = {
          x: ship.x + sinH * longOffset + cosH * latOffset,
          z: ship.z + cosH * longOffset - sinH * latOffset,
          vx: cosH * driftLat,
          vz: -sinH * driftLat,
          age: 0,
          life: isBowSideWake ? 1.15 : 1.55,
          baseScale: isBowSideWake ? 0.45 : 0.68,
        };
      }
    }

    // 2. Salpicaduras de proa dinámicas al cortar olas o escorar a alta velocidad
    if (ship.speed > 2.8) {
      const bowX = ship.x - sinH * 3.9;
      const bowZ = ship.z - cosH * 3.9;
      const bowWave = sampleGerstnerSurface(bowX, bowZ, t, params);
      const plungeFactor = Math.max(0, -ship.velY * 0.9) + Math.max(0, -ship.pitch * 4.5);
      const turnSplash = Math.abs(ship.steerAngle) * (ship.speed / 18) * 1.4;
      const waveCutIntensity = 1 + plungeFactor + turnSplash + bowWave.slope * 2.2;

      sprayAccumRef.current += dt * (4.0 + ship.speed * 0.85) * waveCutIntensity;
      while (sprayAccumRef.current >= 1) {
        sprayAccumRef.current -= 1;
        const idx = sprayCursorRef.current % SPRAY_COUNT;
        sprayCursorRef.current += 1;

        const side = idx % 2 === 0 ? 1 : -1;
        const fwdRatio = THREE.MathUtils.clamp(ship.speed / 16, 0.2, 1.35);
        const longPos = -3.85 + Math.random() * 0.9;
        const latPos = side * (0.38 + Math.random() * 0.42);
        const outward = side * (1.65 + fwdRatio * 2.5 + Math.random() * 1.2);
        const forwardCarry = -ship.speed * 0.22;

        sprayNodesRef.current[idx] = {
          x: ship.x + sinH * longPos + cosH * latPos,
          y: Math.max(bowWave.height, ship.y) + 0.18,
          z: ship.z + cosH * longPos - sinH * latPos,
          vx: cosH * outward + sinH * forwardCarry,
          vy: 2.3 + fwdRatio * 2.9 + plungeFactor * 1.6 + Math.random() * 1.7,
          vz: -sinH * outward + cosH * forwardCarry,
          age: 0,
          life: 0.58 + Math.random() * 0.28,
          size: 0.65 + Math.random() * 0.65 + Math.min(plungeFactor * 0.25, 0.4),
        };
      }
    }

    for (let i = 0; i < FOAM_COUNT; i += 1) {
      const node = foamNodesRef.current[i];
      const mesh = foamMeshRefs.current[i];
      if (!mesh) continue;

      node.age += dt;
      if (node.age >= node.life) {
        mesh.visible = false;
        continue;
      }

      node.x += node.vx * dt;
      node.z += node.vz * dt;
      node.vx *= 1 - dt * 1.8;
      node.vz *= 1 - dt * 1.8;

      const progress = node.age / node.life;
      const sample = sampleGerstnerSurface(node.x, node.z, t, params);
      const scale = node.baseScale + progress * 1.85;

      mesh.visible = true;
      mesh.position.set(node.x, sample.height + 0.08, node.z);
      mesh.scale.set(scale, 1, scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - progress) * (1 - progress * 0.35) * 0.58;
    }

    for (let i = 0; i < SPRAY_COUNT; i += 1) {
      const node = sprayNodesRef.current[i];
      const mesh = sprayMeshRefs.current[i];
      if (!mesh) continue;

      node.age += dt;
      if (node.age >= node.life) {
        mesh.visible = false;
        continue;
      }

      node.vy -= 13.5 * dt;
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      node.z += node.vz * dt;

      const waterSample = sampleGerstnerSurface(node.x, node.z, t, params);
      if (node.y < waterSample.height - 0.05 && node.vy < 0) {
        mesh.visible = false;
        node.age = node.life;
        continue;
      }

      const progress = node.age / node.life;
      const scale = node.size * (0.75 + progress * 0.9);
      mesh.visible = true;
      mesh.position.set(node.x, node.y, node.z);
      mesh.scale.setScalar(scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - progress) * 0.78;
    }
  });

  return (
    <group>
      {Array.from({ length: FOAM_COUNT }).map((_, idx) => (
        <mesh
          key={`foam-${idx}`}
          ref={(el) => {
            foamMeshRefs.current[idx] = el;
          }}
          visible={false}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.62, 7]} />
          <meshBasicMaterial color="#effcf9" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({ length: SPRAY_COUNT }).map((_, idx) => (
        <mesh
          key={`spray-${idx}`}
          ref={(el) => {
            sprayMeshRefs.current[idx] = el;
          }}
          visible={false}
        >
          <icosahedronGeometry args={[0.16, 0]} />
          <meshBasicMaterial color="#f2fcff" transparent opacity={0.75} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
