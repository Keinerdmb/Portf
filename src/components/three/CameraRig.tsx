import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GamePhase, ShipTelemetry } from '../../types/portfolio';

interface CameraRigProps {
  phase: GamePhase;
  cameraModeRequest: { zoom: number; nonce: number } | null;
  onZoomModeChange: (isFirstPerson: boolean) => void;
  shipTelemetryRef: React.RefObject<ShipTelemetry>;
  boardingProgressRef: React.RefObject<number>;
  boardingCharPosRef: React.RefObject<THREE.Vector3>;
}

const TEMP_TARGET_POS = new THREE.Vector3();
const TEMP_LOOK_AT = new THREE.Vector3();
const SMOOTH_LOOK = new THREE.Vector3(0, 1.5, 0);

export function CameraRig({
  phase,
  cameraModeRequest,
  onZoomModeChange,
  shipTelemetryRef,
  boardingProgressRef,
  boardingCharPosRef,
}: CameraRigProps) {
  const { camera } = useThree();
  const zoomRef = useRef(0.95);
  const targetZoomRef = useRef(0.95);
  const lastModeRef = useRef(false);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (phase !== 'sailing') return;
      // Rueda hacia arriba (deltaY < 0) acerca hacia 1ra persona; abajo aleja a 3ra persona
      targetZoomRef.current = THREE.MathUtils.clamp(
        targetZoomRef.current + e.deltaY * 0.0011,
        0,
        1
      );
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [phase]);

  // Solo cambia el zoom objetivo cuando el usuario hace clic en el botón del HUD
  useEffect(() => {
    if (cameraModeRequest) {
      targetZoomRef.current = cameraModeRequest.zoom;
    }
  }, [cameraModeRequest]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);

    if (phase === 'title') {
      // Toma cinematográfica lateral-3/4 del muelle con el barco y el personaje al atardecer
      TEMP_TARGET_POS.set(-8.5, 4.0, 9.8);
      TEMP_LOOK_AT.set(-0.5, 1.9, 1.8);
      camera.position.lerp(TEMP_TARGET_POS, dt * 3);
      SMOOTH_LOOK.lerp(TEMP_LOOK_AT, dt * 3);
      camera.lookAt(SMOOTH_LOOK);
      return;
    }

    if (phase === 'boarding') {
      // Seguimiento suave mientras el personaje camina por el muelle y sube al timón
      const charPos = boardingCharPosRef.current;
      const p = boardingProgressRef.current;
      TEMP_TARGET_POS.set(
        THREE.MathUtils.lerp(-7.5, 0, p),
        THREE.MathUtils.lerp(3.8, 5.2, p),
        THREE.MathUtils.lerp(charPos.z + 4.5, 11.5, p)
      );
      TEMP_LOOK_AT.set(
        THREE.MathUtils.lerp(charPos.x, 0, p),
        1.8,
        THREE.MathUtils.lerp(charPos.z, -1.5, p)
      );
      camera.position.lerp(TEMP_TARGET_POS, dt * 4);
      SMOOTH_LOOK.lerp(TEMP_LOOK_AT, dt * 4);
      camera.lookAt(SMOOTH_LOOK);
      return;
    }

    // Modo navegación: interpolación fluida entre 1ra persona (zoom=0) y 3ra persona (zoom=1)
    zoomRef.current = THREE.MathUtils.lerp(zoomRef.current, targetZoomRef.current, dt * 8);
    const z = zoomRef.current;

    const isFp = z < 0.22;
    if (isFp !== lastModeRef.current) {
      lastModeRef.current = isFp;
      onZoomModeChange(isFp);
    }

    const ship = shipTelemetryRef.current;
    const sinH = Math.sin(ship.heading);
    const cosH = Math.cos(ship.heading);

    // Posición en 1ra persona (exactamente detrás del timón mirando por encima de la rueda y la cubierta)
    const fpPosX = ship.x + sinH * 1.9;
    const fpPosY = 2.48;
    const fpPosZ = ship.z + cosH * 1.9;

    const fpLookX = ship.x - sinH * 12;
    const fpLookY = 1.65;
    const fpLookZ = ship.z - cosH * 12;

    // Posición en 3ra persona (cámara alejada detrás del barco viendo todo el océano e islas)
    const tpPosX = ship.x + sinH * 15.5;
    const tpPosY = 7.2;
    const tpPosZ = ship.z + cosH * 15.5;

    const tpLookX = ship.x - sinH * 6;
    const tpLookY = 1.8;
    const tpLookZ = ship.z - cosH * 6;

    TEMP_TARGET_POS.set(
      THREE.MathUtils.lerp(fpPosX, tpPosX, z),
      THREE.MathUtils.lerp(fpPosY, tpPosY, z),
      THREE.MathUtils.lerp(fpPosZ, tpPosZ, z)
    );

    TEMP_LOOK_AT.set(
      THREE.MathUtils.lerp(fpLookX, tpLookX, z),
      THREE.MathUtils.lerp(fpLookY, tpLookY, z),
      THREE.MathUtils.lerp(fpLookZ, tpLookZ, z)
    );

    // En 1ra persona fijamos la cámara más directo para evitar mareo o lag respecto al timón
    const followSpeed = THREE.MathUtils.lerp(22, 7.5, z);
    camera.position.lerp(TEMP_TARGET_POS, 1 - Math.exp(-followSpeed * dt));
    SMOOTH_LOOK.lerp(TEMP_LOOK_AT, 1 - Math.exp(-followSpeed * dt));
    camera.lookAt(SMOOTH_LOOK);
  });

  return null;
}
