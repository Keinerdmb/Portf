import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getWaveHeight } from '../../utils/oceanMath';

interface OceanProps {
  shipPosRef: React.RefObject<{ x: number; z: number }>;
}

const SEGMENTS = 38;

export function Ocean({ shipPosRef }: OceanProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseCoordsRef = useRef<Float32Array | null>(null);

  // Jitter sutil una sola vez para que las facetas del mar sean triángulos orgánicos como en la referencia
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const base = new Float32Array(posAttr.count * 2);

    for (let i = 0; i < posAttr.count; i += 1) {
      const bx = posAttr.getX(i);
      const by = posAttr.getY(i);
      // No movemos los bordes exteriores para no crear huecos
      const isEdge = Math.abs(bx) > 215 || Math.abs(by) > 215;
      const jx = isEdge ? 0 : Math.sin(bx * 12.9898 + by * 78.233) * 2.1;
      const jy = isEdge ? 0 : Math.cos(bx * 39.346 + by * 11.135) * 2.1;
      const nx = bx + jx;
      const ny = by + jy;
      posAttr.setXY(i, nx, ny);
      base[i * 2] = nx;
      base[i * 2 + 1] = ny;
    }

    baseCoordsRef.current = base;
    posAttr.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const base = baseCoordsRef.current;
    if (!mesh || !base) return;

    // Recentramos el plano en pasos discretos del tamaño de celda para evitar parpadeos
    const snap = 460 / SEGMENTS;
    mesh.position.x = Math.round(shipPosRef.current.x / snap) * snap;
    mesh.position.z = Math.round(shipPosRef.current.z / snap) * snap;

    const geo = mesh.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.getElapsedTime();
    const ox = mesh.position.x;
    const oz = mesh.position.z;

    for (let i = 0; i < posAttr.count; i += 1) {
      const lx = base[i * 2];
      const ly = base[i * 2 + 1];
      const wx = lx + ox;
      const wz = -ly + oz;
      posAttr.setZ(i, getWaveHeight(wx, wz, t));
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
      <planeGeometry args={[460, 460, SEGMENTS, SEGMENTS]} />
      <meshStandardMaterial
        color="#1d8f9c"
        roughness={0.36}
        metalness={0.22}
        flatShading
      />
    </mesh>
  );
}
