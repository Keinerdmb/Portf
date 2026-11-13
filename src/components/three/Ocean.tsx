import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getWaveHeight } from '../../utils/oceanMath';

interface OceanProps {
  shipPosRef: React.RefObject<{ x: number; z: number }>;
}

const SEGMENTS = 40;

const DEEP_R = 0.06;
const DEEP_G = 0.43;
const DEEP_B = 0.49;

const CREST_R = 0.28;
const CREST_G = 0.78;
const CREST_B = 0.81;

export function Ocean({ shipPosRef }: OceanProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseCoordsRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const base = new Float32Array(posAttr.count * 2);
    const colors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i += 1) {
      const bx = posAttr.getX(i);
      const by = posAttr.getY(i);
      const isEdge = Math.abs(bx) > 215 || Math.abs(by) > 215;
      const jx = isEdge ? 0 : Math.sin(bx * 12.9898 + by * 78.233) * 2.4;
      const jy = isEdge ? 0 : Math.cos(bx * 39.346 + by * 11.135) * 2.4;
      const nx = bx + jx;
      const ny = by + jy;
      posAttr.setXY(i, nx, ny);
      base[i * 2] = nx;
      base[i * 2 + 1] = ny;

      colors[i * 3] = 0.14;
      colors[i * 3 + 1] = 0.6;
      colors[i * 3 + 2] = 0.65;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    baseCoordsRef.current = base;
    posAttr.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const base = baseCoordsRef.current;
    if (!mesh || !base) return;

    const geo = mesh.geometry;
    const colorAttr = geo.attributes.color as THREE.BufferAttribute | undefined;
    if (!colorAttr) return;

    const snap = 460 / SEGMENTS;
    mesh.position.x = Math.round(shipPosRef.current.x / snap) * snap;
    mesh.position.z = Math.round(shipPosRef.current.z / snap) * snap;

    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.getElapsedTime();
    const ox = mesh.position.x;
    const oz = mesh.position.z;

    for (let i = 0; i < posAttr.count; i += 1) {
      const lx = base[i * 2];
      const ly = base[i * 2 + 1];
      const wx = lx + ox;
      const wz = -ly + oz;
      const h = getWaveHeight(wx, wz, t);
      posAttr.setZ(i, h);

      // Factor de cresta (0 en valle -> 1 en cresta) para colorear las facetas como en la referencia
      const k = Math.max(0, Math.min(1, (h + 0.85) / 1.7));
      // Destello cálido sutil hacia el sol (-X, -Z) en crestas altas
      const sunPath = Math.max(0, 1 - Math.abs(wx + 24) / 65) * Math.max(0, (-wz + 20) / 160);
      const shimmer = k * k * sunPath * 0.45;

      colorAttr.setXYZ(
        i,
        DEEP_R + (CREST_R - DEEP_R) * k + shimmer * 0.9,
        DEEP_G + (CREST_G - DEEP_G) * k + shimmer * 0.55,
        DEEP_B + (CREST_B - DEEP_B) * k + shimmer * 0.15
      );
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
      <planeGeometry args={[460, 460, SEGMENTS, SEGMENTS]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.32}
        metalness={0.18}
        flatShading
      />
    </mesh>
  );
}
