import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { ATARDECER_PALETTE } from '../../data/palette';

interface PirateCharacterProps {
  isWalking: boolean;
  hiddenInFirstPerson?: boolean;
}

/**
 * Capitán pirata estilizado con siluetas cónicas/orgánicas (sin bloques tipo Lego).
 */
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
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.4;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.4;
      if (bodyRef.current) bodyRef.current.position.y = Math.sin(t * 2.2) * 0.015;
    }
  });

  if (hiddenInFirstPerson) return null;

  return (
    <group ref={bodyRef}>
      {/* Piernas y botas con doblez */}
      <group ref={leftLegRef} position={[-0.13, 0.54, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.085, 0.07, 0.44, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.pantsPlum} flatShading />
        </mesh>
        <mesh position={[0, -0.46, 0.03]}>
          <cylinderGeometry args={[0.085, 0.095, 0.2, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.woodDark} flatShading />
        </mesh>
      </group>

      <group ref={rightLegRef} position={[0.13, 0.54, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.085, 0.07, 0.44, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.pantsPlum} flatShading />
        </mesh>
        <mesh position={[0, -0.46, 0.03]}>
          <cylinderGeometry args={[0.085, 0.095, 0.2, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.woodDark} flatShading />
        </mesh>
      </group>

      {/* Abrigo largo cónico con faldón fluido */}
      <mesh position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.2, 0.31, 0.72, 7]} />
        <meshStandardMaterial color={ATARDECER_PALETTE.coatDusk} flatShading />
      </mesh>

      {/* Capa / hombrera estilizada */}
      <mesh position={[0, 1.15, 0.02]}>
        <cylinderGeometry args={[0.18, 0.3, 0.18, 7]} />
        <meshStandardMaterial color={ATARDECER_PALETTE.coatLapel} flatShading />
      </mesh>

      {/* Faja coral + brújula brillante */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.245, 0.255, 0.11, 7]} />
        <meshStandardMaterial color={ATARDECER_PALETTE.sashCoral} flatShading />
      </mesh>
      <mesh position={[0.22, 0.69, -0.1]}>
        <octahedronGeometry args={[0.065, 0]} />
        <meshStandardMaterial
          color={ATARDECER_PALETTE.apricotAccent}
          emissive={ATARDECER_PALETTE.coralAccent}
          emissiveIntensity={1.6}
          flatShading
        />
      </mesh>

      {/* Brazos estilizados cónicos */}
      <group ref={leftArmRef} position={[-0.27, 1.12, 0]}>
        <mesh position={[0, -0.2, 0]} rotation={[0, 0, 0.08]}>
          <cylinderGeometry args={[0.07, 0.055, 0.44, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.coatLapel} flatShading />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <icosahedronGeometry args={[0.058, 0]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.skinWarm} flatShading />
        </mesh>
      </group>

      <group ref={rightArmRef} position={[0.27, 1.12, 0]}>
        <mesh position={[0, -0.2, 0]} rotation={[0, 0, -0.08]}>
          <cylinderGeometry args={[0.07, 0.055, 0.44, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.coatLapel} flatShading />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <icosahedronGeometry args={[0.058, 0]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.skinWarm} flatShading />
        </mesh>
      </group>

      {/* Cabeza facetada orgánica (no cuadrada) */}
      <mesh position={[0, 1.38, 0]} scale={[0.92, 1.05, 0.95]}>
        <dodecahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color={ATARDECER_PALETTE.skinWarm} flatShading />
      </mesh>

      {/* Sombrero tricornio curvado */}
      <group position={[0, 1.54, 0]}>
        <mesh position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
          <cylinderGeometry args={[0.36, 0.39, 0.06, 3]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.hatPlum} flatShading />
        </mesh>
        <mesh position={[0, 0.08, 0.02]}>
          <cylinderGeometry args={[0.16, 0.21, 0.17, 7]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.hatPlum} flatShading />
        </mesh>
        <mesh position={[0, 0.04, -0.18]}>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 6]} />
          <meshStandardMaterial color={ATARDECER_PALETTE.sandGold} flatShading />
        </mesh>
      </group>
    </group>
  );
}
