'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { constellationScene } from './scenes/constellation';
import { rouletteScene } from './scenes/roulette';
import type { Scene } from './scenes/types';

type Kind = 'roulette' | 'constellation';

/** The poker page gets the suit constellation; everywhere else, the wheel. */
function kindFor(pathname: string): Kind {
  return pathname.startsWith('/poker') ? 'constellation' : 'roulette';
}

/**
 * The fixed layer behind the site: slow aurora glows (CSS, so the compositor
 * moves them) under a canvas scene. Most pages show a real roulette wheel
 * turning in the bottom-right corner; the poker page shows a constellation
 * drawing the four suits. Both lean a little with the cursor.
 *
 * Asked to stop moving, the scene is drawn once and stays still and the glows
 * hold; nothing loops. The loop also stops in a hidden tab rather than burning
 * a frame budget nobody is looking at.
 */
export function Ambient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kind = kindFor(usePathname() ?? '/');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    const scene: Scene = kind === 'constellation' ? constellationScene() : rouletteScene(font);

    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    let clock = 0;
    let mouse = { x: -1, y: -1 };
    // The lean eases toward the cursor rather than snapping to it.
    const tilt = { x: 0, y: 0 };

    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.resize(width, height);
    }

    function paint(dt: number) {
      ctx!.clearRect(0, 0, width, height);
      scene.draw(ctx!, clock, dt, tilt);
      ctx!.globalAlpha = 1;
    }

    function frame(now: number) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      clock += dt;
      const tx = mouse.x >= 0 ? mouse.x / width - 0.5 : 0;
      const ty = mouse.y >= 0 ? mouse.y / height - 0.5 : 0;
      const ease = Math.min(1, dt * 2.5);
      tilt.x += (tx - tilt.x) * ease;
      tilt.y += (ty - tilt.y) * ease;
      paint(dt);
      raf = requestAnimationFrame(frame);
    }

    function onResize() {
      size();
      if (reduced) paint(0);
    }

    function onMove(event: PointerEvent) {
      // A finger has no hover, so touch does not lean the scene.
      if (event.pointerType === 'mouse') mouse = { x: event.clientX, y: event.clientY };
    }

    function onVisibility() {
      cancelAnimationFrame(raf);
      last = 0;
      if (!document.hidden) raf = requestAnimationFrame(frame);
    }

    size();
    window.addEventListener('resize', onResize);

    if (reduced) {
      // A moment into the scene, so the still frame has its ball and stars placed.
      clock = 3;
      paint(0);
      return () => window.removeEventListener('resize', onResize);
    }

    window.addEventListener('pointermove', onMove);
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [kind]);

  return (
    <>
      <div className="bg-aurora" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <canvas ref={canvasRef} className="bgcanvas" aria-hidden />
    </>
  );
}
