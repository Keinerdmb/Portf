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
  const { camera, gl } = useThree();
  const zoomRef = useRef(0.95);
  const targetZoomRef = useRef(0.95);
  const lastModeRef = useRef(false);

  // Ángulos libres de cámara controlados al arrastrar el mouse mientras manejas
  const yawOffsetRef = useRef(0);
  const targetYawRef = useRef(0);
  const pitchOffsetRef = useRef(0);
  const targetPitchRef = useRef(0);
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const dom = gl.domElement;

    const onWheel = (e: WheelEvent) => {
      if (phase !== 'sailing') return;
      targetZoomRef.current = THREE.MathUtils.clamp(
        targetZoomRef.current + e.deltaY * 0.0011,
        0,
        1
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (phase !== 'sailing') return;
      draggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current || phase !== 'sailing') return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      targetYawRef.current -= dx * 0.0055;
      targetPitchRef.current = THREE.MathUtils.clamp(
        targetPitchRef.current + dy * 0.004,
        -0.38,
        0.52
      );
    };

    const onPointerUp = () => {
      draggingRef.current = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyC' && phase === 'sailing') {
        targetYawRef.current = 0;
        targetPitchRef.current = 0;
      }
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [phase, gl.domElement]);

  useEffect(() => {
    if (cameraModeRequest) {
      targetZoomRef.current = cameraModeRequest.zoom;
    }
  }, [cameraModeRequest]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);

    if (phase === 'title') {
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

    // Limitamos el ángulo horizontal solo ligeramente si estamos en 1ra persona; en 3ra es 360°
    if (isFp) {
      targetYawRef.current = THREE.MathUtils.clamp(targetYawRef.current, -2.1, 2.1);
    }

    yawOffsetRef.current = THREE.MathUtils.lerp(yawOffsetRef.current, targetYawRef.current, dt * 10);
    pitchOffsetRef.current = THREE.MathUtils.lerp(
      pitchOffsetRef.current,
      targetPitchRef.current,
      dt * 10
    );

    const ship = shipTelemetryRef.current;
    const sinH = Math.sin(ship.heading);
    const cosH = Math.cos(ship.heading);
    const totalCamYaw = ship.heading + yawOffsetRef.current;
    const sinCam = Math.sin(totalCamYaw);
    const cosCam = Math.cos(totalCamYaw);
    const waveOffset = ship.y * 0.7;

    // 1ra persona: posición fija detrás del timón, pero puedes girar la cabeza para mirar alrededor
    const fpPosX = ship.x + sinH * 2.15;
    const fpPosY = 2.38 + waveOffset;
    const fpPosZ = ship.z + cosH * 2.15;

    const fpLookX = fpPosX - sinCam * 14;
    const fpLookY = fpPosY - 0.65 - pitchOffsetRef.current * 8.5;
    const fpLookZ = fpPosZ - cosCam * 14;

    // 3ra persona: órbita libre 360° alrededor del barco mientras manejas
    const orbitDist = 15.5;
    const tpPosX = ship.x + sinCam * orbitDist;
    const tpPosY = THREE.MathUtils.clamp(7.2 + pitchOffsetRef.current * 8.5, 2.2, 14.5);
    const tpPosZ = ship.z + cosCam * orbitDist;

    const tpLookX = ship.x - sinCam * 3.5;
    const tpLookY = 1.9;
    const tpLookZ = ship.z - cosCam * 3.5;

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

    const followSpeed = THREE.MathUtils.lerp(24, 9, z);
    camera.position.lerp(TEMP_TARGET_POS, 1 - Math.exp(-followSpeed * dt));
    SMOOTH_LOOK.lerp(TEMP_LOOK_AT, 1 - Math.exp(-followSpeed * dt));
    camera.lookAt(SMOOTH_LOOK);
  });

  return null;
}
