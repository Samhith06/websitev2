'use client';

import { useEffect, useRef } from 'react';

/** One square of the grid, in CSS pixels. */
const CELL = 80;

type Lit = { i: number; j: number; life: number; max: number; color: string; peak: number };
type Runner = { horizontal: boolean; dir: 1 | -1; length: number; pos: number; line: number; speed: number };

/**
 * The fixed layer behind the site: a faint ruled grid that drifts slowly against
 * the scroll, with squares lighting and fading in it, the occasional runner
 * travelling along a line, and the square under the cursor outlined.
 *
 * Asked to stop moving, the grid is drawn once and stays still — it is the page's
 * texture, not an animation, so it survives; everything that moves does not, and
 * there is no loop left running. The loop also stops in a hidden tab rather than
 * burning a frame budget nobody is looking at.
 */
export function Ambient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const ink = styles.getPropertyValue('--text').trim();
    const blue = styles.getPropertyValue('--blue').trim();
    const gold = styles.getPropertyValue('--gold').trim();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let lit: Lit[] = [];
    let runners: Runner[] = [];
    let mouse = { x: -1, y: -1 };

    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      lit = [];
      runners = [];
    }

    function drawGrid(scroll: number) {
      ctx!.globalAlpha = 0.09;
      ctx!.strokeStyle = ink;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (let i = 0; i <= cols; i++) {
        ctx!.moveTo(i * CELL + 0.5, 0);
        ctx!.lineTo(i * CELL + 0.5, height);
      }
      for (let j = 0; j <= rows; j++) {
        const y = j * CELL - scroll + 0.5;
        ctx!.moveTo(0, y);
        ctx!.lineTo(width, y);
      }
      ctx!.stroke();
    }

    function spawnSquare() {
      const roll = Math.random();
      const isGold = roll < 0.12;
      const isBlue = !isGold && Math.random() < 0.6;
      lit.push({
        i: Math.floor(Math.random() * cols),
        j: Math.floor(Math.random() * rows),
        life: 0,
        max: 140 + Math.random() * 160,
        color: isGold ? gold : isBlue ? blue : ink,
        peak: isGold ? 0.1 : isBlue ? 0.16 : 0.05,
      });
    }

    function spawnRunner() {
      const horizontal = Math.random() < 0.6;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const length = 80 + Math.random() * 200;
      const span = horizontal ? width : height;
      runners.push({
        horizontal,
        dir,
        length,
        pos: dir > 0 ? -length : span + length,
        line: Math.floor(Math.random() * (horizontal ? rows : cols)) * CELL,
        speed: 1.2 + Math.random() * 2.2,
      });
    }

    function frame() {
      const scroll = (window.scrollY * 0.15) % CELL;
      ctx!.clearRect(0, 0, width, height);
      drawGrid(scroll);

      if (Math.random() < 0.06) spawnSquare();
      lit = lit.filter((square) => square.life < square.max);
      for (const square of lit) {
        square.life++;
        ctx!.globalAlpha = Math.sin((square.life / square.max) * Math.PI) * square.peak;
        ctx!.fillStyle = square.color;
        ctx!.fillRect(square.i * CELL + 1, square.j * CELL - scroll + 1, CELL - 1, CELL - 1);
      }

      if (mouse.x >= 0) {
        const i = Math.floor(mouse.x / CELL);
        const j = Math.floor((mouse.y + scroll) / CELL);
        ctx!.globalAlpha = 0.9;
        ctx!.strokeStyle = blue;
        ctx!.lineWidth = 2;
        ctx!.strokeRect(i * CELL + 1, j * CELL - scroll + 1, CELL - 2, CELL - 2);
      }

      if (runners.length < 5 && Math.random() < 0.025) spawnRunner();
      runners = runners.filter((runner) => {
        const span = runner.horizontal ? width : height;
        return runner.pos > -runner.length - 10 && runner.pos < span + runner.length + 10;
      });
      ctx!.globalAlpha = 0.85;
      for (const runner of runners) {
        runner.pos += runner.speed * runner.dir;
        const tail = runner.pos - runner.length * runner.dir;
        const from = Math.min(runner.pos, tail);
        const to = Math.max(runner.pos, tail);
        const fade = runner.horizontal
          ? ctx!.createLinearGradient(tail, 0, runner.pos, 0)
          : ctx!.createLinearGradient(0, tail, 0, runner.pos);
        fade.addColorStop(0, 'rgba(0,0,0,0)');
        fade.addColorStop(1, blue);
        ctx!.fillStyle = fade;
        if (runner.horizontal) ctx!.fillRect(from, runner.line - scroll - 1, to - from, 2);
        else ctx!.fillRect(runner.line - 1, from, 2, to - from);
      }

      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    function drawStill() {
      ctx!.clearRect(0, 0, width, height);
      drawGrid((window.scrollY * 0.15) % CELL);
      ctx!.globalAlpha = 1;
    }

    function onResize() {
      size();
      if (reduced) drawStill();
    }

    function onMove(event: PointerEvent) {
      // A finger has no hover: outlining wherever it last touched just leaves
      // a stray square on the page.
      if (event.pointerType === 'mouse') mouse = { x: event.clientX, y: event.clientY };
    }

    function onVisibility() {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    }

    size();
    window.addEventListener('resize', onResize);

    if (reduced) {
      drawStill();
      window.addEventListener('scroll', drawStill, { passive: true });
      return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', drawStill);
      };
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
  }, []);

  return <canvas ref={canvasRef} className="bgcanvas" aria-hidden />;
}
