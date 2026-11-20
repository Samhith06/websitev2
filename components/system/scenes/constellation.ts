import type { Scene, Tilt } from './types';

/** Shapes are drawn on a 200-unit square, then traced. */
const BOX = 200;
/** Stars on each outline, evenly spaced, so every suit maps onto every other one point for point. */
const EDGE = 72;
/** Stars filling each shape: enough that the suit reads as a dense web of light. */
const INNER = 150;
/** Stars closer than this (in shape units) are joined by a line. */
const LINK = 19;
/** Seconds each suit holds, then seconds to change into the next. */
const HOLD = 4.2;
const MORPH = 1.8;

type Suit = { name: string; warm: boolean; draw: (p: Path2D) => void };
type Pt = [number, number];

const SUITS: Suit[] = [
  {
    name: 'spade',
    warm: false,
    draw: (p) => {
      p.moveTo(100, 14);
      p.bezierCurveTo(80, 50, 24, 74, 24, 116);
      p.bezierCurveTo(24, 144, 50, 158, 72, 152);
      p.bezierCurveTo(84, 149, 92, 141, 96, 133);
      p.bezierCurveTo(95, 154, 88, 170, 72, 186);
      p.lineTo(128, 186);
      p.bezierCurveTo(112, 170, 105, 154, 104, 133);
      p.bezierCurveTo(108, 141, 116, 149, 128, 152);
      p.bezierCurveTo(150, 158, 176, 144, 176, 116);
      p.bezierCurveTo(176, 74, 120, 50, 100, 14);
      p.closePath();
    },
  },
  {
    name: 'heart',
    warm: true,
    draw: (p) => {
      p.moveTo(100, 180);
      p.bezierCurveTo(62, 150, 16, 120, 16, 74);
      p.bezierCurveTo(16, 44, 38, 24, 63, 24);
      p.bezierCurveTo(81, 24, 94, 34, 100, 50);
      p.bezierCurveTo(106, 34, 119, 24, 137, 24);
      p.bezierCurveTo(162, 24, 184, 44, 184, 74);
      p.bezierCurveTo(184, 120, 138, 150, 100, 180);
      p.closePath();
    },
  },
  {
    name: 'club',
    warm: false,
    draw: (p) => {
      p.arc(100, 56, 35, 0, Math.PI * 2);
      p.moveTo(94, 114);
      p.arc(58, 114, 35, 0, Math.PI * 2);
      p.moveTo(177, 114);
      p.arc(142, 114, 35, 0, Math.PI * 2);
      p.moveTo(120, 100);
      p.arc(100, 100, 20, 0, Math.PI * 2);
      p.moveTo(93, 118);
      p.bezierCurveTo(93, 150, 86, 170, 70, 186);
      p.lineTo(130, 186);
      p.bezierCurveTo(114, 170, 107, 150, 107, 118);
      p.closePath();
    },
  },
  {
    name: 'diamond',
    warm: true,
    draw: (p) => {
      p.moveTo(100, 8);
      p.bezierCurveTo(118, 44, 142, 74, 172, 100);
      p.bezierCurveTo(142, 126, 118, 156, 100, 192);
      p.bezierCurveTo(82, 156, 58, 126, 28, 100);
      p.bezierCurveTo(58, 74, 82, 44, 100, 8);
      p.closePath();
    },
  },
];

/**
 * Rasterise a suit and walk its outer edge (Moore-neighbour tracing), so any
 * shape — the club is three circles and a stem — gives one ordered outline.
 */
function trace(suit: Suit): { edge: Pt[]; inner: Pt[] } {
  const c = document.createElement('canvas');
  c.width = c.height = BOX;
  const g = c.getContext('2d')!;
  const path = new Path2D();
  suit.draw(path);
  g.fillStyle = '#fff';
  g.fill(path, 'nonzero');
  const data = g.getImageData(0, 0, BOX, BOX).data;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < BOX && y < BOX && data[(y * BOX + x) * 4 + 3] > 127;

  let start: Pt = [0, 0];
  find: for (let y = 0; y < BOX; y++)
    for (let x = 0; x < BOX; x++)
      if (on(x, y)) {
        start = [x, y];
        break find;
      }

  // Clockwise neighbours, starting west.
  const dirs: Pt[] = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const raw: Pt[] = [start];
  let cur = start;
  let back = 0;
  for (let guard = 0; guard < BOX * BOX; guard++) {
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const d = (back + k) % 8;
      const nx = cur[0] + dirs[d][0];
      const ny = cur[1] + dirs[d][1];
      if (on(nx, ny)) {
        cur = [nx, ny];
        back = (d + 5) % 8;
        moved = true;
        break;
      }
    }
    if (!moved || (cur[0] === start[0] && cur[1] === start[1])) break;
    raw.push(cur);
  }

  // Resample by arc length to EDGE evenly spaced stars.
  const lens = [0];
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i % raw.length];
    lens.push(lens[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lens[lens.length - 1];
  const edge: Pt[] = [];
  let j = 0;
  for (let k = 0; k < EDGE; k++) {
    const want = (k / EDGE) * total;
    while (lens[j + 1] < want) j++;
    const a = raw[j];
    const b = raw[(j + 1) % raw.length];
    const f = (want - lens[j]) / (lens[j + 1] - lens[j] || 1);
    edge.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  // Start every outline at its top centre so the morph does not twist.
  let top = 0;
  edge.forEach((p, i) => {
    const score = p[1] + Math.abs(p[0] - BOX / 2) * 0.6;
    const best = edge[top][1] + Math.abs(edge[top][0] - BOX / 2) * 0.6;
    if (score < best) top = i;
  });
  const ordered = edge.slice(top).concat(edge.slice(0, top));

  // Inner stars: a jittered grid over the inside of the shape, kept a little
  // clear of the outline, then thinned evenly to exactly INNER so every suit
  // maps onto every other one star for star.
  const inside = (x: number, y: number) => on(x, y) && on(x - 4, y) && on(x + 4, y) && on(x, y - 4) && on(x, y + 4);
  let seed = suit.name.length * 9301 + 17;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const found: Pt[] = [];
  for (let gy = 6; gy < BOX; gy += 8)
    for (let gx = 6; gx < BOX; gx += 8) {
      const x = Math.round(gx + (rnd() - 0.5) * 6);
      const y = Math.round(gy + (rnd() - 0.5) * 6);
      if (inside(x, y)) found.push([x, y]);
    }
  found.sort((a, b) => Math.atan2(a[1] - 100, a[0] - 100) - Math.atan2(b[1] - 100, b[0] - 100));
  const inner: Pt[] = Array.from({ length: INNER }, (_, k) => found[Math.floor((k * found.length) / INNER)] ?? [100, 100]);
  return { edge: ordered, inner };
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function glowSprite(rgb: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.55)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c;
}

/**
 * The poker page's backdrop: a constellation that draws the four suits in turn.
 * The outline is a chain of bright stars joined edge to edge, so each suit
 * reads clearly; inside, a dense web of smaller stars, each joined to its near
 * neighbours by lines that fade with distance. Hearts and diamonds burn warm
 * gold where spades and clubs stay cold blue.
 * Behind it, a field of faint stars twinkles and the odd shooting star crosses.
 */
export function constellationScene(): Scene {
  const shapes = SUITS.map(trace);
  const cold = glowSprite('170, 205, 255');
  const warm = glowSprite('255, 214, 120');
  let width = 0;
  let height = 0;
  let ox = 0;
  let oy = 0;
  let scale = 1;
  let field: { x: number; y: number; r: number; p: number; s: number }[] = [];
  let shot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  let nextShot = 5;

  function mix(a: Pt, b: Pt, f: number): Pt {
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  return {
    resize(w, h) {
      width = w;
      height = h;
      const mobile = w < 768;
      const size = mobile ? Math.min(w * 0.86, h * 0.5) : Math.min(h * 0.72, w * 0.42);
      scale = size / BOX;
      ox = (mobile ? w * 0.5 : w * 0.72) - size / 2;
      oy = h * (mobile ? 0.56 : 0.52) - size / 2;
      const n = Math.round((w * h) / 6000);
      field = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.1,
        p: Math.random() * Math.PI * 2,
        s: 0.5 + Math.random() * 1.5,
      }));
    },

    draw(ctx, t, _dt, tilt: Tilt) {
      // Far stars barely move with the cursor; the suit moves a little more.
      for (const s of field) {
        const tw = Math.sin(t * s.s + s.p);
        ctx.globalAlpha = 0.12 + 0.3 * tw * tw;
        ctx.fillStyle = '#cfe0ff';
        ctx.beginPath();
        ctx.arc(s.x - tilt.x * 6, s.y - tilt.y * 4, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t > nextShot && !shot) {
        shot = { x: Math.random() * width * 0.8, y: Math.random() * height * 0.3, vx: 520, vy: 190, life: 0 };
        nextShot = t + 7 + Math.random() * 6;
      }
      if (shot) {
        shot.life += _dt;
        shot.x += shot.vx * _dt;
        shot.y += shot.vy * _dt;
        const fade = Math.max(0, 1 - shot.life / 0.9);
        const tail = ctx.createLinearGradient(shot.x, shot.y, shot.x - shot.vx * 0.18, shot.y - shot.vy * 0.18);
        tail.addColorStop(0, `rgba(230,240,255,${0.8 * fade})`);
        tail.addColorStop(1, 'rgba(230,240,255,0)');
        ctx.globalAlpha = 1;
        ctx.strokeStyle = tail;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y);
        ctx.lineTo(shot.x - shot.vx * 0.18, shot.y - shot.vy * 0.18);
        ctx.stroke();
        if (fade <= 0) shot = null;
      }

      const cycle = HOLD + MORPH;
      const k = Math.floor(t / cycle);
      const into = t - k * cycle;
      const from = shapes[k % shapes.length];
      const to = shapes[(k + 1) % shapes.length];
      const f = into < HOLD ? 0 : ease((into - HOLD) / MORPH);
      const warmFrom = SUITS[k % SUITS.length].warm ? 1 : 0;
      const warmTo = SUITS[(k + 1) % SUITS.length].warm ? 1 : 0;
      const heat = warmFrom + (warmTo - warmFrom) * f;
      // Mid-morph the lines thin out, so the change reads as a dissolve, not a tangle.
      const clarity = 1 - Math.sin(f * Math.PI) * 0.6;

      const px = ox - tilt.x * 16;
      const py = oy - tilt.y * 10;
      const at = (p: Pt): Pt => [px + p[0] * scale + Math.sin(t * 0.7 + p[1]) * 1.2, py + p[1] * scale + Math.cos(t * 0.6 + p[0]) * 1.2];
      const edge = from.edge.map((p, i) => at(mix(p, to.edge[i], f)));
      const inner = from.inner.map((p, i) => at(mix(p, to.inner[i], f)));

      const r = Math.round(150 + 105 * heat);
      const g = Math.round(195 + 19 * heat);
      const b = Math.round(255 - 135 * heat);
      const line = `rgb(${r},${g},${b})`;

      // The outline: the chain that makes the suit legible.
      ctx.strokeStyle = line;
      ctx.lineWidth = 1.1;
      ctx.globalAlpha = 0.42 * clarity;
      ctx.beginPath();
      edge.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.stroke();

      // The web: every pair of stars close enough is joined, fading with distance.
      const all = edge.concat(inner);
      const reach = LINK * scale;
      const reach2 = reach * reach;
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = line;
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          const dx = all[i][0] - all[j][0];
          const dy = all[i][1] - all[j][1];
          const d2 = dx * dx + dy * dy;
          if (d2 > reach2) continue;
          ctx.globalAlpha = 0.26 * (1 - d2 / reach2) * clarity;
          ctx.beginPath();
          ctx.moveTo(all[i][0], all[i][1]);
          ctx.lineTo(all[j][0], all[j][1]);
          ctx.stroke();
        }

      // The stars themselves: every third outline star is a bright one.
      const glow = heat > 0.5 ? warm : cold;
      const star = Math.min(1.6, Math.max(0.8, scale / 2));
      edge.forEach((p, i) => {
        const big = i % 3 === 0;
        const tw = 0.75 + 0.25 * Math.sin(t * 2.2 + i * 1.7);
        const s = (big ? 14 : 8) * tw * star;
        ctx.globalAlpha = (big ? 0.95 : 0.7) * tw;
        ctx.drawImage(glow, p[0] - s / 2, p[1] - s / 2, s, s);
      });
      inner.forEach((p, i) => {
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 2.3);
        const bright = i % 9 === 0;
        const s = (bright ? 10 : 5.5) * (0.7 + 0.3 * tw) * star;
        ctx.globalAlpha = (bright ? 0.9 : 0.45 + 0.4 * tw);
        ctx.drawImage(glow, p[0] - s / 2, p[1] - s / 2, s, s);
      });
      ctx.globalAlpha = 1;
    },
  };
}
