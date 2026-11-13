import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getWaveHeight } from '../../utils/oceanMath';

interface OceanProps {
  shipPosRef: React.RefObject<{ x: number; z: number }>;
}

// Malla cercana de alta definición (~2.8 unidades por triángulo, nítida junto al barco)
const INNER_SIZE = 168;
const INNER_SEGMENTS = 58;

// Malla exterior para cubrir hasta el horizonte sin desperdiciar polígonos
const OUTER_SIZE = 760;
const OUTER_SEGMENTS = 28;
const OUTER_HOLE_LIMIT = 40;

const DEEP_R = 0.05;
const DEEP_G = 0.42;
const DEEP_B = 0.49;

const CREST_R = 0.29;
const CREST_G = 0.85;
const CREST_B = 0.83;

function getSwellHeight(wx: number, wz: number, time: number): number {
  return (
    Math.sin(wx * 0.08 + time * 1.25) * 0.3 +
    Math.cos(wz * 0.09 + time * 1.05) * 0.25
  );
}

function initFacetedGrid(
  mesh: THREE.Mesh,
  size: number,
  jitterAmount: number,
  hideCenterHole = false
): Float32Array {
  const geo = mesh.geometry;
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const base = new Float32Array(posAttr.count * 2);
  const colors = new Float32Array(posAttr.count * 3);
  const edgeLimit = size * 0.47;

  for (let i = 0; i < posAttr.count; i += 1) {
    const bx = posAttr.getX(i);
    const by = posAttr.getY(i);
    const isEdge = Math.abs(bx) > edgeLimit || Math.abs(by) > edgeLimit;
    const jx = isEdge ? 0 : Math.sin(bx * 12.9898 + by * 78.233) * jitterAmount;
    const jy = isEdge ? 0 : Math.cos(bx * 39.346 + by * 11.135) * jitterAmount;
    const nx = bx + jx;
    const ny = by + jy;

    posAttr.setXY(i, nx, ny);
    base[i * 2] = nx;
    base[i * 2 + 1] = ny;

    if (hideCenterHole && Math.abs(nx) < OUTER_HOLE_LIMIT && Math.abs(ny) < OUTER_HOLE_LIMIT) {
      posAttr.setZ(i, -4.0);
    }

    colors[i * 3] = 0.14;
    colors[i * 3 + 1] = 0.62;
    colors[i * 3 + 2] = 0.66;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  posAttr.needsUpdate = true;
  return base;
}

export function Ocean({ shipPosRef }: OceanProps) {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const innerBaseRef = useRef<Float32Array | null>(null);
  const outerBaseRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (innerRef.current) {
      innerBaseRef.current = initFacetedGrid(innerRef.current, INNER_SIZE, 0.95, false);
    }
    if (outerRef.current) {
      outerBaseRef.current = initFacetedGrid(outerRef.current, OUTER_SIZE, 4.2, true);
    }
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const sx = shipPosRef.current.x;
    const sz = shipPosRef.current.z;

    // 1. Mar cercano nítido (facetas pequeñas y reflejos solares)
    const inner = innerRef.current;
    const innerBase = innerBaseRef.current;
    if (inner && innerBase) {
      const snap = INNER_SIZE / INNER_SEGMENTS;
      inner.position.x = Math.round(sx / snap) * snap;
      inner.position.z = Math.round(sz / snap) * snap;

      const geo = inner.geometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const colorAttr = geo.attributes.color as THREE.BufferAttribute | undefined;

      if (colorAttr) {
        const ox = inner.position.x;
        const oz = inner.position.z;
        const halfInner = INNER_SIZE * 0.5;

        for (let i = 0; i < posAttr.count; i += 1) {
          const lx = innerBase[i * 2];
          const ly = innerBase[i * 2 + 1];
          const wx = lx + ox;
          const wz = -ly + oz;

          // En el borde exterior del mar cercano desvanecemos el chop para unir perfecto con outer
          const edgeDist = Math.max(Math.abs(lx), Math.abs(ly)) / halfInner;
          const chopFade = edgeDist > 0.78 ? Math.max(0, 1 - (edgeDist - 0.78) / 0.22) : 1;

          const swell = getSwellHeight(wx, wz, t);
          const fullH = getWaveHeight(wx, wz, t);
          const h = swell + (fullH - swell) * chopFade;
          posAttr.setZ(i, h);

          const k = Math.max(0, Math.min(1, (h + 0.9) / 1.8));
          colorAttr.setXYZ(
            i,
            DEEP_R + (CREST_R - DEEP_R) * k,
            DEEP_G + (CREST_G - DEEP_G) * k,
            DEEP_B + (CREST_B - DEEP_B) * k
          );
        }

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        geo.computeVertexNormals();
      }
    }

    // 2. Mar lejano hasta el horizonte (misma altura base de marejada para cero costuras)
    const outer = outerRef.current;
    const outerBase = outerBaseRef.current;
    if (outer && outerBase) {
      const snapOuter = OUTER_SIZE / OUTER_SEGMENTS;
      outer.position.x = Math.round(sx / snapOuter) * snapOuter;
      outer.position.z = Math.round(sz / snapOuter) * snapOuter;

      const geo = outer.geometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const ox = outer.position.x;
      const oz = outer.position.z;

      for (let i = 0; i < posAttr.count; i += 1) {
        const lx = outerBase[i * 2];
        const ly = outerBase[i * 2 + 1];
        if (Math.abs(lx) < OUTER_HOLE_LIMIT && Math.abs(ly) < OUTER_HOLE_LIMIT) {
          posAttr.setZ(i, -4.0);
          continue;
        }
        const wx = lx + ox;
        const wz = -ly + oz;
        posAttr.setZ(i, getSwellHeight(wx, wz, t) - 0.05);
      }

      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
    }
  });

  return (
    <group>
      <mesh ref={innerRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <planeGeometry args={[INNER_SIZE, INNER_SIZE, INNER_SEGMENTS, INNER_SEGMENTS]} />
        <meshPhongMaterial
          vertexColors
          flatShading
          shininess={95}
          specular="#ffe4a8"
        />
      </mesh>

      <mesh ref={outerRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <planeGeometry args={[OUTER_SIZE, OUTER_SIZE, OUTER_SEGMENTS, OUTER_SEGMENTS]} />
        <meshPhongMaterial
          color="#1b8a96"
          flatShading
          shininess={70}
          specular="#ffdfa0"
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
    </group>
  );
}
