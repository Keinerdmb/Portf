import type { QualityMode } from '../../types/portfolio';

interface HomeDockProps {
  quality: QualityMode;
}

export function HomeDock({ quality }: HomeDockProps) {
  return (
    <group position={[0, 0, 0]}>
      {/* Pequeña isla / costa de partida detrás del muelle */}
      <group position={[-7.5, 0, 12]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[8.5, 11, 2.2, 7]} />
          <meshStandardMaterial color="#d4a373" flatShading roughness={0.9} />
        </mesh>
        <mesh position={[-1.5, 1.8, 1]}>
          <dodecahedronGeometry args={[4.2, 0]} />
          <meshStandardMaterial color="#3a5a40" flatShading roughness={0.85} />
        </mesh>
        <mesh position={[2.8, 1.2, -1]}>
          <dodecahedronGeometry args={[2.3, 0]} />
          <meshStandardMaterial color="#4a4e69" flatShading roughness={0.9} />
        </mesh>

        {/* Palmera estilizada del puerto */}
        <group position={[-2.2, 3.2, -1]}>
          <mesh position={[0, 1.6, 0]} rotation={[0.1, 0, -0.15]}>
            <cylinderGeometry args={[0.18, 0.3, 3.6, 5]} />
            <meshStandardMaterial color="#6f4e37" flatShading />
          </mesh>
          {[0, 1.3, 2.6, 3.9, 5.2].map((angle) => (
            <mesh
              key={angle}
              position={[0.35, 3.3, 0]}
              rotation={[0.4, angle, 0.7]}
            >
              <coneGeometry args={[0.55, 2.1, 4]} />
              <meshStandardMaterial color="#2d6a4f" flatShading />
            </mesh>
          ))}
        </group>
      </group>

      {/* Muelle principal de madera (donde aparece el personaje) */}
      <group position={[-3.1, 0.95, 4.2]}>
        {/* Plataforma del muelle */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2.4, 0.25, 11.5]} />
          <meshStandardMaterial color="#6b442a" flatShading roughness={0.85} />
        </mesh>

        {/* Pilotes clavados en el agua */}
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

        {/* Pasarela/rampa hacia la cubierta del barco */}
        <mesh position={[1.6, 0.08, -2.35]} rotation={[0, 0, 0.05]}>
          <boxGeometry args={[1.6, 0.12, 1.4]} />
          <meshStandardMaterial color="#845435" flatShading />
        </mesh>

        {/* Farol cálido del muelle */}
        <group position={[0.9, 0.12, -2.1]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 2.2, 5]} />
            <meshStandardMaterial color="#3d2817" flatShading />
          </mesh>
          <mesh position={[0, 2.25, 0]}>
            <octahedronGeometry args={[0.24, 0]} />
            <meshStandardMaterial
              color="#ffd166"
              emissive="#ff9f1c"
              emissiveIntensity={2.2}
              flatShading
            />
          </mesh>
          {quality === 'high' && (
            <pointLight position={[0, 2.3, 0]} color="#ffaa33" intensity={5} distance={12} />
          )}
        </group>

        {/* Segundo farol al inicio del muelle */}
        <group position={[-0.9, 0.12, 3.6]}>
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 2.0, 5]} />
            <meshStandardMaterial color="#3d2817" flatShading />
          </mesh>
          <mesh position={[0, 2.05, 0]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial
              color="#ffd166"
              emissive="#ff9f1c"
              emissiveIntensity={2}
              flatShading
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
