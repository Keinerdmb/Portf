import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

interface PirateCharacterProps {
  /** Posición y rotación controladas durante la caminata o al timón */
  isWalking: boolean;
  hiddenInFirstPerson?: boolean;
}

export function PirateCharacter({
  isWalking,
  hiddenInFirstPerson = false,
}: PirateCharacterProps) {
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (isWalking) {
      const swing = Math.sin(t * 9) * 0.55;
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.7;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.7;
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.sin(t * 9)) * 0.05;
    } else {
      // Respiración sutil cuando está quieto / al timón
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.35;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.35;
      if (bodyRef.current) bodyRef.current.position.y = Math.sin(t * 2.2) * 0.015;
    }
  });

  if (hiddenInFirstPerson) return null;

  return (
    <group ref={bodyRef}>
      {/* Pierna izquierda */}
      <group ref={leftLegRef} position={[-0.14, 0.55, 0]}>
        <mesh position={[0, -0.25, 0]}>
          <boxGeometry args={[0.16, 0.5, 0.16]} />
          <meshStandardMaterial color="#1e293b" flatShading />
        </mesh>
        <mesh position={[0, -0.5, 0.03]}>
          <boxGeometry args={[0.18, 0.14, 0.24]} />
          <meshStandardMaterial color="#2b1d14" flatShading />
        </mesh>
      </group>

      {/* Pierna derecha */}
      <group ref={rightLegRef} position={[0.14, 0.55, 0]}>
        <mesh position={[0, -0.25, 0]}>
          <boxGeometry args={[0.16, 0.5, 0.16]} />
          <meshStandardMaterial color="#1e293b" flatShading />
        </mesh>
        <mesh position={[0, -0.5, 0.03]}>
          <boxGeometry args={[0.18, 0.14, 0.24]} />
          <meshStandardMaterial color="#2b1d14" flatShading />
        </mesh>
      </group>

      {/* Torso / Abrigo pirata */}
      <mesh position={[0, 0.88, 0]}>
        <boxGeometry args={[0.48, 0.62, 0.28]} />
        <meshStandardMaterial color="#1b263b" flatShading />
      </mesh>

      {/* Faja / Cinturón carmesí + brújula turquesa */}
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.51, 0.14, 0.31]} />
        <meshStandardMaterial color="#9e2a2b" flatShading />
      </mesh>
      <mesh position={[0.24, 0.66, -0.1]}>
        <octahedronGeometry args={[0.07, 0]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0ea5e9"
          emissiveIntensity={1.6}
          flatShading
        />
      </mesh>

      {/* Brazo izquierdo */}
      <group ref={leftArmRef} position={[-0.31, 1.12, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.14, 0.48, 0.14]} />
          <meshStandardMaterial color="#22304a" flatShading />
        </mesh>
      </group>

      {/* Brazo derecho */}
      <group ref={rightArmRef} position={[0.31, 1.12, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.14, 0.48, 0.14]} />
          <meshStandardMaterial color="#22304a" flatShading />
        </mesh>
      </group>

      {/* Cabeza */}
      <mesh position={[0, 1.38, 0]}>
        <boxGeometry args={[0.32, 0.32, 0.3]} />
        <meshStandardMaterial color="#e6b89c" flatShading />
      </mesh>

      {/* Sombrero tricornio estilizado */}
      <group position={[0, 1.56, 0]}>
        <mesh position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
          <cylinderGeometry args={[0.36, 0.38, 0.07, 3]} />
          <meshStandardMaterial color="#111827" flatShading />
        </mesh>
        <mesh position={[0, 0.08, 0.02]}>
          <cylinderGeometry args={[0.17, 0.21, 0.18, 6]} />
          <meshStandardMaterial color="#111827" flatShading />
        </mesh>
        {/* Detalle dorado del sombrero */}
        <mesh position={[0, 0.04, -0.2]}>
          <boxGeometry args={[0.14, 0.06, 0.05]} />
          <meshStandardMaterial color="#fbbf24" flatShading />
        </mesh>
      </group>
    </group>
  );
}
