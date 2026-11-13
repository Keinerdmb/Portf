import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { QualityMode } from '../../types/portfolio';

interface OceanProps {
  quality: QualityMode;
  shipPosRef: React.RefObject<{ x: number; z: number }>;
}

export function Ocean({ quality, shipPosRef }: OceanProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const frameCounter = useRef(0);

  // En modo Canaima reducimos los segmentos para mantener 60 FPS sin esfuerzo
  const segments = quality === 'canaima' ? 28 : 44;

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Centramos el océano alrededor del barco para simular mar infinito con geometría pequeña
    mesh.position.x = Math.round(shipPosRef.current.x / 10) * 10;
    mesh.position.z = Math.round(shipPosRef.current.z / 10) * 10;

    frameCounter.current += 1;
    // En modo Canaima actualizamos olas cada 2 frames para ahorrar CPU
    if (quality === 'canaima' && frameCounter.current % 2 !== 0) return;

    const geo = mesh.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.getElapsedTime();
    const ox = mesh.position.x;
    const oz = mesh.position.z;

    for (let i = 0; i < posAttr.count; i += 1) {
      const vx = posAttr.getX(i) + ox;
      const vz = -posAttr.getY(i) + oz;
      const wave =
        Math.sin(vx * 0.08 + t * 1.4) * 0.35 +
        Math.cos(vz * 0.09 + t * 1.1) * 0.28;
      // Al rotar el plano -90° en X, su eje Z local apunta hacia arriba en el mundo
      posAttr.setZ(i, wave);
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow={false}
    >
      <planeGeometry key={segments} args={[460, 460, segments, segments]} />
      <meshStandardMaterial
        color="#136f8a"
        roughness={0.55}
        metalness={0.12}
        flatShading
      />
    </mesh>
  );
}
