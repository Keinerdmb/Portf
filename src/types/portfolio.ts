export type GamePhase = 'title' | 'boarding' | 'sailing';

export type QualityMode = 'canaima' | 'high';

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
  subtitle: string;
  code: string;
  /** Posición en el mundo 3D [x, z] */
  position: [number, number];
  /** Radio en el cual aparece el botón de desembarcar */
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
}
