import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getWaveHeight } from '../../utils/oceanMath';

interface OceanProps {
  shipPosRef: React.RefObject<{ x: number; z: number }>;
}

const SEGMENTS = 46;
const SIZE = 720;

// Paleta Steven Universe: agua aqua-turquesa luminosa con valles turquesa profundos
const DEEP_R = 0.09;
const DEEP_G = 0.55;
const DEEP_B = 0.68;

const CREST_R = 0.36;
const CREST_G = 0.87;
const CREST_B = 0.86;

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

    const limit = SIZE * 0.47;
    for (let i = 0; i < posAttr.count; i += 1) {
      const bx = posAttr.getX(i);
      const by = posAttr.getY(i);
      const isEdge = Math.abs(bx) > limit || Math.abs(by) > limit;
      const jx = isEdge ? 0 : Math.sin(bx * 12.9898 + by * 78.233) * 2.5;
      const jy = isEdge ? 0 : Math.cos(bx * 39.346 + by * 11.135) * 2.5;
      const nx = bx + jx;
      const ny = by + jy;
      posAttr.setXY(i, nx, ny);
      base[i * 2] = nx;
      base[i * 2 + 1] = ny;

      colors[i * 3] = 0.2;
      colors[i * 3 + 1] = 0.7;
      colors[i * 3 + 2] = 0.76;
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

    const snap = SIZE / SEGMENTS;
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

      const k = Math.max(0, Math.min(1, (h + 0.85) / 1.7));
      // Reflejo suave rosado-dorado del atardecer en las crestas altas
      const shimmer = k * k * 0.26;

      colorAttr.setXYZ(
        i,
        DEEP_R + (CREST_R - DEEP_R) * k + shimmer * 0.95,
        DEEP_G + (CREST_G - DEEP_G) * k + shimmer * 0.65,
        DEEP_B + (CREST_B - DEEP_B) * k + shimmer * 0.35
      );
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
      <planeGeometry args={[SIZE, SIZE, SEGMENTS, SEGMENTS]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.34}
        metalness={0.14}
        flatShading
      />
    </mesh>
  );
}
