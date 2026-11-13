export type GamePhase = 'title' | 'boarding' | 'sailing';

export type IslandId = 'about' | 'projects' | 'skills' | 'minigame';

export interface ProjectItem {
  title: string;
  description: string;
  tech: string[];
  role: string;
  repoUrl?: string;
  demoUrl?: string;
}

export interface IslandData {
  id: IslandId;
  name: string;
  signLabel: string;
  subtitle: string;
  code: string;
  /** Posición en el mundo 3D [x, z] */
  position: [number, number];
  /** Radio físico sólido (colisión del casco con la isla) */
  collisionRadius: number;
  /** Radio exterior donde puedes desembarcar */
  dockRadius: number;
  accentColor: string;
  landmark: 'lighthouse' | 'treasure' | 'observatory' | 'skull';
}

export interface ShipTelemetry {
  x: number;
  y: number;
  velY: number;
  z: number;
  /** Ángulo de dirección en radianes (0 = mirando hacia -Z / Norte) */
  heading: number;
  pitch: number;
  pitchVel: number;
  roll: number;
  rollVel: number;
  speed: number;
  steerAngle: number;
  /** Factor de impulso de viento actual (-1 contra viento, +1 a favor) */
  windAlignment: number;
}

export interface OceanParams {
  /** Velocidad del viento en nudos (2 .. 25) */
  windSpeed: number;
  /** Dirección de la corriente y oleaje principal en radianes (0 .. 2π) */
  currentAngle: number;
  /** Altura mínima variable de las olas en metros */
  minWaveHeight: number;
  /** Altura máxima variable de las olas en metros */
  maxWaveHeight: number;
  /** Multiplicador de frecuencia de oleaje (0.5 = muy suave, 1.5 = picado) */
  waveFrequency: number;
}
