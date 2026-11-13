import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

interface StarfieldProps {
  /** Permite pausar el movimiento si el usuario apaga el monitor o baja los efectos */
  paused?: boolean;
}

export function Starfield({ paused = false }: StarfieldProps) {
  // useRef nos da acceso directo al elemento <canvas> del DOM sin causar re-renders
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId = 0;
    let width = 0;
    let height = 0;

    // Limitamos el pixel ratio a 1.5 para evitar dibujar en 4K innecesariamente en pantallas HiDPI
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    // Creamos 90 estrellas repartidas en 3 velocidades (efecto parallax)
    const stars: Star[] = Array.from({ length: 90 }, () => {
      const layer = Math.random();
      return {
        x: Math.random(),
        y: Math.random(),
        size: layer > 0.8 ? 2.5 : layer > 0.4 ? 1.8 : 1,
        speed: layer > 0.8 ? 0.0012 : layer > 0.4 ? 0.0006 : 0.00025,
        opacity: layer > 0.8 ? 0.95 : layer > 0.4 ? 0.65 : 0.35,
      };
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        if (!paused && !document.hidden) {
          star.y += star.speed;
          if (star.y > 1) {
            star.y = 0;
            star.x = Math.random();
          }
        }

        ctx.fillStyle = `rgba(224, 247, 255, ${star.opacity})`;
        ctx.fillRect(
          Math.floor(star.x * width),
          Math.floor(star.y * height),
          star.size,
          star.size
        );
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
