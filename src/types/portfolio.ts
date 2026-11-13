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
  /** Impulso activo por ráfaga atrapada en las velas (0 .. 1) */
  gustBoost: number;
  /** Si las velas principales están izadas o recogidas */
  sailDeployed: boolean;
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

export interface DynamicWindState {
  /** Velocidad instantánea del viento en nudos (base + variabilidad + ráfaga) */
  speed: number;
  /** Dirección dinámica actual del viento en radianes (convención de oleaje) */
  direction: number;
  /** Vector unitario XZ del viento global */
  dirX: number;
  dirZ: number;
  /** Intensidad normalizada de la ráfaga periódica (0 .. 1) */
  gustIntensity: number;
  /** Tiempo de fase oceánica integrado continuamente (evita retrocesos en ráfagas) */
  waveTime: number;
  /** Estado objetivo/actual de despliegue de velas (0.28 = recogidas, 1 = izadas) */
  sailDeploy: number;
  /** Parámetros oceánicos efectivos sincronizados con viento y ráfagas */
  liveOcean: OceanParams;
}
