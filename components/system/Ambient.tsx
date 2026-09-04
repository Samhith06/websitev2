'use client';

import { useEffect, useRef } from 'react';

/**
 * The three fixed layers behind the site: a drifting particle field, coloured
 * glows that breathe, and a masked grid.
 *
 * The canvas is the only one that costs anything, so it is the only one that
 * is conditional: nothing is drawn under `prefers-reduced-motion`, and the
 * loop is cancelled whenever the tab is hidden rather than burning a frame
 * budget in a background tab.
 */
export function Ambient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let points: { x: number; y: number; z: number; vx: number; vy: number }[] = [];

    function size() {
      width = canvas!.width = window.innerWidth;
      height = canvas!.height = window.innerHeight;
    }

    // Density scales with viewport width so a phone is not drawing a desktop's
    // worth of particles.
    function seed() {
      const count = Math.min(64, Math.round(window.innerWidth / 22));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0.3 + Math.random() * 0.9,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
      }));
    }

    function loop() {
      ctx!.clearRect(0, 0, width, height);
      for (const p of points) {
        p.x += p.vx * p.z;
        p.y += p.vy * p.z;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.z * 1.5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(34,211,255,${0.05 + p.z * 0.13})`;
        ctx!.fill();
      }
      raf = requestAnimationFrame(loop);
    }

    function onResize() {
      size();
      seed();
    }

    function onVisibility() {
      cancelAnimationFrame(raf);
      if (!document.hidden) loop();
    }

    size();
    seed();
    loop();

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="bgcanvas" aria-hidden />
      <div className="glows" aria-hidden />
      <div className="mesh" aria-hidden />
    </>
  );
}
