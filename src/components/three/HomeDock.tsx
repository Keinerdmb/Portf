import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function buildDockPalm() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.3, 1.4, 0.1),
    new THREE.Vector3(0.7, 2.8, 0.2),
    new THREE.Vector3(1.0, 4.0, 0.3),
  ]);
  const trunkGeo = new THREE.TubeGeometry(curve, 7, 0.18, 6, false);

  const frondGeo = new THREE.PlaneGeometry(0.65, 2.2, 2, 5);
  const pos = frondGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i) + 1.1;
    const t = y / 2.2;
    const widthScale = Math.sin(t * Math.PI) * 1.15;
    const droopZ = -(t * t) * 0.9;
    pos.setXYZ(i, x * widthScale, droopZ, y);
  }
  frondGeo.computeVertexNormals();

  const cliffGeo = new THREE.DodecahedronGeometry(4.4, 1);
  const cPos = cliffGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < cPos.count; i += 1) {
    const vx = cPos.getX(i);
    const vy = cPos.getY(i);
    const vz = cPos.getZ(i);
    const noise = 0.85 + Math.sin(vx * 0.8 + vz * 0.8) * 0.2;
    cPos.setXYZ(i, vx * noise, Math.max(-0.4, vy), vz * noise);
  }
  cliffGeo.computeVertexNormals();

  return { trunkGeo, frondGeo, cliffGeo };
}

export function HomeDock() {
  const palmRef = useRef<THREE.Group>(null);
  const { trunkGeo, frondGeo, cliffGeo } = useMemo(() => buildDockPalm(), []);

  useFrame(({ clock }) => {
    if (palmRef.current) {
      palmRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 1.4) * 0.06;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Costa / Isla de partida detrás del muelle */}
      <group position={[-7.5, 0, 12]}>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[8.8, 11.5, 2.4, 10]} />
          <meshStandardMaterial color="#dfb07c" flatShading roughness={0.9} />
        </mesh>
        <mesh geometry={cliffGeo} position={[-1.5, 2.1, 1]}>
          <meshStandardMaterial color="#4a6b53" flatShading roughness={0.85} />
        </mesh>
        <mesh geometry={cliffGeo} position={[2.8, 1.4, -1]} scale={0.6}>
          <meshStandardMaterial color="#585168" flatShading roughness={0.9} />
        </mesh>

        {/* Palmera curva estilizada */}
        <group position={[-2.2, 3.2, -1]}>
          <mesh geometry={trunkGeo}>
            <meshStandardMaterial color="#6b442a" flatShading />
          </mesh>
          <group ref={palmRef} position={[1.0, 4.0, 0.3]}>
            {[0, 1.05, 2.1, 3.15, 4.2, 5.25].map((angle) => (
              <mesh key={angle} geometry={frondGeo} rotation={[-0.18, angle, 0]}>
                <meshStandardMaterial color="#2f6f4e" flatShading side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* Muelle principal de madera */}
      <group position={[-3.1, 0.95, 4.2]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2.4, 0.22, 11.5]} />
          <meshStandardMaterial color="#6b442a" flatShading roughness={0.85} />
        </mesh>

        {[-4.8, -1.6, 1.6, 4.8].map((pz) => (
          <group key={pz}>
            <mesh position={[-1.0, -0.8, pz]}>
              <cylinderGeometry args={[0.14, 0.16, 2.4, 6]} />
              <meshStandardMaterial color="#4a2e1b" flatShading />
            </mesh>
            <mesh position={[1.0, -0.8, pz]}>
              <cylinderGeometry args={[0.14, 0.16, 2.4, 6]} />
              <meshStandardMaterial color="#4a2e1b" flatShading />
            </mesh>
          </group>
        ))}

        {/* Pasarela hacia el barco */}
        <mesh position={[1.45, 0.08, -2.35]} rotation={[0, 0, 0.05]}>
          <boxGeometry args={[1.4, 0.12, 1.4]} />
          <meshStandardMaterial color="#845435" flatShading />
        </mesh>

        {/* Farol cálido del muelle */}
        <group position={[0.9, 0.12, -2.1]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 2.2, 6]} />
            <meshStandardMaterial color="#3d2817" flatShading />
          </mesh>
          <mesh position={[0, 2.25, 0]}>
            <octahedronGeometry args={[0.24, 0]} />
            <meshStandardMaterial
              color="#fef08a"
              emissive="#f59e0b"
              emissiveIntensity={2.5}
              flatShading
            />
          </mesh>
          <pointLight position={[0, 2.3, 0]} color="#ffaa33" intensity={5} distance={14} />
        </group>

        <group position={[-0.9, 0.12, 3.6]}>
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 2.0, 6]} />
            <meshStandardMaterial color="#3d2817" flatShading />
          </mesh>
          <mesh position={[0, 2.05, 0]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial
              color="#fef08a"
              emissive="#f59e0b"
              emissiveIntensity={2.2}
              flatShading
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
