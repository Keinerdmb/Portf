import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GamePhase, ShipTelemetry } from '../../types/portfolio';
import { getWaveHeight } from '../../utils/oceanMath';

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
      // Rueda arriba acerca hacia 1ra persona; abajo aleja a 3ra persona
      targetZoomRef.current = THREE.MathUtils.clamp(
        targetZoomRef.current + e.deltaY * 0.0011,
        0,
        1
      );
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [phase]);

  useEffect(() => {
    if (cameraModeRequest) {
      targetZoomRef.current = cameraModeRequest.zoom;
    }
  }, [cameraModeRequest]);

  useFrame(({ clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = clock.getElapsedTime();

    if (phase === 'title') {
      // Toma cinematográfica lateral del muelle, barco y atardecer dorado
      TEMP_TARGET_POS.set(-9.0, 4.1, 10.2);
      TEMP_LOOK_AT.set(-0.5, 2.0, 1.4);
      camera.position.lerp(TEMP_TARGET_POS, dt * 3);
      SMOOTH_LOOK.lerp(TEMP_LOOK_AT, dt * 3);
      camera.lookAt(SMOOTH_LOOK);
      return;
    }

    if (phase === 'boarding') {
      const charPos = boardingCharPosRef.current;
      const p = boardingProgressRef.current;
      TEMP_TARGET_POS.set(
        THREE.MathUtils.lerp(-8.0, 0, p),
        THREE.MathUtils.lerp(3.9, 5.8, p),
        THREE.MathUtils.lerp(charPos.z + 4.8, 12.5, p)
      );
      TEMP_LOOK_AT.set(
        THREE.MathUtils.lerp(charPos.x, 0, p),
        1.9,
        THREE.MathUtils.lerp(charPos.z, -2.0, p)
      );
      camera.position.lerp(TEMP_TARGET_POS, dt * 4);
      SMOOTH_LOOK.lerp(TEMP_LOOK_AT, dt * 4);
      camera.lookAt(SMOOTH_LOOK);
      return;
    }

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
    const waveOffset = getWaveHeight(ship.x, ship.z, t) * 0.7;

    // 1ra persona POV fiel a la imagen: justo detrás del timón viendo rueda, cubierta, farol y vela
    const fpPosX = ship.x + sinH * 2.05;
    const fpPosY = 2.42 + waveOffset;
    const fpPosZ = ship.z + cosH * 2.05;

    const fpLookX = ship.x - sinH * 12;
    const fpLookY = 1.65 + waveOffset * 0.7;
    const fpLookZ = ship.z - cosH * 12;

    // 3ra persona: cámara alejada atrás y arriba mostrando el barco completo
    const tpPosX = ship.x + sinH * 15.5;
    const tpPosY = 7.4;
    const tpPosZ = ship.z + cosH * 15.5;

    const tpLookX = ship.x - sinH * 6;
    const tpLookY = 1.9;
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

    const followSpeed = THREE.MathUtils.lerp(24, 7.5, z);
    camera.position.lerp(TEMP_TARGET_POS, 1 - Math.exp(-followSpeed * dt));
    SMOOTH_LOOK.lerp(TEMP_LOOK_AT, 1 - Math.exp(-followSpeed * dt));
    camera.lookAt(SMOOTH_LOOK);
  });

  return null;
}
