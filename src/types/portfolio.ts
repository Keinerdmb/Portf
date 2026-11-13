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
  z: number;
  /** Ángulo de dirección en radianes (0 = mirando hacia -Z / Norte) */
  heading: number;
  speed: number;
  steerAngle: number;
  /** Factor de impulso de viento actual (-1 contra viento, +1 a favor) */
  windAlignment: number;
}

export interface WindState {
  /** Dirección hacia donde sopla el viento en radianes (0 = hacia -Z) */
  angle: number;
  /** Velocidad del viento en nudos (ej. 8..16) */
  knots: number;
}
