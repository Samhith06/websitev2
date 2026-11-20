import type { Scene, Tilt } from './types';

/** The single-zero wheel, clockwise from zero. */
const ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
  29, 7, 28, 12, 35, 3, 26,
];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SLOT = (Math.PI * 2) / ORDER.length;

/** Sprite size in pixels; the wheel is drawn from it at any scale. */
const SPRITE = 1100;
const R = SPRITE / 2;

/** Radii as a share of the wheel's radius, outside in. */
const RIM = 1;
const TRACK_OUT = 0.9;
const TRACK_IN = 0.79;
const NUM_OUT = 0.785;
const NUM_IN = 0.69;
const POCKET_IN = 0.57;
const CONE_IN = 0.17;
const BALL_TRACK = 0.845;
const BALL_POCKET = 0.63;

/** How flat the wheel looks: 1 is straight down, lower leans it back. */
const LEAN = 0.6;

type Ball =
  | { phase: 'track'; angle: number; speed: number }
  | { phase: 'drop'; angle: number; speed: number; r: number; vr: number; since: number }
  | { phase: 'rest'; slot: number; since: number };

function sprite(draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const g = c.getContext('2d')!;
  g.translate(R, R);
  draw(g);
  return c;
}

function ring(g: CanvasRenderingContext2D, outer: number, inner: number) {
  g.beginPath();
  g.arc(0, 0, outer * R, 0, Math.PI * 2);
  g.arc(0, 0, inner * R, 0, Math.PI * 2, true);
}

/** The part that never turns: the wooden rim, the ball track and its deflectors. */
function drawBowl(g: CanvasRenderingContext2D) {
  const wood = g.createRadialGradient(0, 0, TRACK_OUT * R, 0, 0, RIM * R);
  wood.addColorStop(0, '#2a1a10');
  wood.addColorStop(0.35, '#5a3620');
  wood.addColorStop(0.7, '#3b2314');
  wood.addColorStop(1, '#160d07');
  ring(g, RIM, TRACK_OUT);
  g.fillStyle = wood;
  g.fill();

  // Grain: faint rings in the rim.
  g.globalAlpha = 0.18;
  g.strokeStyle = '#000';
  for (let k = 0; k < 9; k++) {
    g.lineWidth = 1 + (k % 3);
    g.beginPath();
    g.arc(0, 0, (TRACK_OUT + 0.012 + k * 0.01) * R, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;

  // A brass lip where the rim meets the track.
  g.lineWidth = 5;
  g.strokeStyle = '#b8913f';
  g.beginPath();
  g.arc(0, 0, TRACK_OUT * R, 0, Math.PI * 2);
  g.stroke();

  // The ball track: dark polished lacquer.
  const track = g.createRadialGradient(0, 0, TRACK_IN * R, 0, 0, TRACK_OUT * R);
  track.addColorStop(0, '#05070c');
  track.addColorStop(0.55, '#141a26');
  track.addColorStop(1, '#0a0d14');
  ring(g, TRACK_OUT, TRACK_IN);
  g.fillStyle = track;
  g.fill();

  // Eight chrome deflectors set into the track.
  for (let k = 0; k < 8; k++) {
    g.save();
    g.rotate((k / 8) * Math.PI * 2 + 0.2);
    g.translate(0, -0.822 * R);
    const chrome = g.createLinearGradient(-14, 0, 14, 0);
    chrome.addColorStop(0, '#6f7682');
    chrome.addColorStop(0.5, '#f1f4f8');
    chrome.addColorStop(1, '#5c626c');
    g.fillStyle = chrome;
    g.beginPath();
    if (k % 2) {
      g.moveTo(0, -22);
      g.lineTo(11, 0);
      g.lineTo(0, 22);
      g.lineTo(-11, 0);
    } else {
      g.rect(-7, -20, 14, 40);
    }
    g.closePath();
    g.fill();
    g.restore();
  }
}

/** The part that turns: numbers, pockets, frets, the cone and the turret. */
function drawRotor(g: CanvasRenderingContext2D, font: string) {
  ORDER.forEach((n, i) => {
    const a0 = -Math.PI / 2 + i * SLOT - SLOT / 2;
    const a1 = a0 + SLOT;
    const base = n === 0 ? '#0f6b43' : RED.has(n) ? '#8f1d2c' : '#111318';
    const deep = n === 0 ? '#0a4a2f' : RED.has(n) ? '#5e111c' : '#08090c';

    g.beginPath();
    g.arc(0, 0, NUM_OUT * R, a0, a1);
    g.arc(0, 0, NUM_IN * R, a1, a0, true);
    g.closePath();
    g.fillStyle = base;
    g.fill();

    const pocket = g.createRadialGradient(0, 0, POCKET_IN * R, 0, 0, NUM_IN * R);
    pocket.addColorStop(0, deep);
    pocket.addColorStop(1, base);
    g.beginPath();
    g.arc(0, 0, NUM_IN * R, a0, a1);
    g.arc(0, 0, POCKET_IN * R, a1, a0, true);
    g.closePath();
    g.fillStyle = pocket;
    g.fill();

    // The number, upright to someone standing at the rim.
    g.save();
    g.rotate(a0 + SLOT / 2 + Math.PI / 2);
    g.fillStyle = '#f3ead6';
    g.font = `700 ${Math.round(R * 0.05)}px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 0, -((NUM_OUT + NUM_IN) / 2) * R);
    g.restore();
  });

  // Frets between the pockets, and the brass rings either side of them.
  g.strokeStyle = '#c9a24a';
  g.lineWidth = 3;
  for (let i = 0; i < ORDER.length; i++) {
    const a = -Math.PI / 2 + i * SLOT - SLOT / 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * POCKET_IN * R, Math.sin(a) * POCKET_IN * R);
    g.lineTo(Math.cos(a) * NUM_OUT * R, Math.sin(a) * NUM_OUT * R);
    g.stroke();
  }
  for (const r of [NUM_OUT, NUM_IN, POCKET_IN]) {
    g.lineWidth = r === NUM_IN ? 2 : 4;
    g.beginPath();
    g.arc(0, 0, r * R, 0, Math.PI * 2);
    g.stroke();
  }

  // The cone: polished wood rising to the turret.
  const cone = g.createRadialGradient(-0.12 * R, -0.12 * R, CONE_IN * R, 0, 0, POCKET_IN * R);
  cone.addColorStop(0, '#6b4126');
  cone.addColorStop(0.6, '#3e2415');
  cone.addColorStop(1, '#1d110a');
  ring(g, POCKET_IN, CONE_IN);
  g.fillStyle = cone;
  g.fill();

  // Inlaid brass spokes on the cone.
  g.strokeStyle = 'rgba(201,162,74,0.55)';
  g.lineWidth = 3;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * CONE_IN * R, Math.sin(a) * CONE_IN * R);
    g.lineTo(Math.cos(a) * (POCKET_IN - 0.02) * R, Math.sin(a) * (POCKET_IN - 0.02) * R);
    g.stroke();
  }

  // The turret: a chrome hub with four arms ending in knobs.
  const chrome = (x0: number, y0: number, r: number) => {
    const c = g.createRadialGradient(x0 - r * 0.35, y0 - r * 0.35, r * 0.1, x0, y0, r);
    c.addColorStop(0, '#ffffff');
    c.addColorStop(0.45, '#b9c0ca');
    c.addColorStop(1, '#4b515a');
    return c;
  };
  g.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 0.3 * R;
    const y = Math.sin(a) * 0.3 * R;
    g.strokeStyle = '#9aa1ab';
    g.lineWidth = 0.035 * R;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(x, y);
    g.stroke();
    g.fillStyle = chrome(x, y, 0.045 * R);
    g.beginPath();
    g.arc(x, y, 0.045 * R, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = chrome(0, 0, 0.1 * R);
  g.beginPath();
  g.arc(0, 0, 0.1 * R, 0, Math.PI * 2);
  g.fill();
}

/**
 * A real single-zero roulette wheel, leaning back in the bottom-right corner:
 * walnut rim, lacquered track with chrome deflectors, red, black and green
 * pockets behind brass frets, a wooden cone and a chrome turret. The rotor
 * turns steadily; every so often a ball is launched round the track, slows,
 * drops, rattles across the frets and settles in a pocket, then rides the
 * rotor until the next spin.
 */
export function rouletteScene(font: string): Scene {
  const bowl = sprite(drawBowl);
  const rotor = sprite((g) => drawRotor(g, font));
  let cx = 0;
  let cy = 0;
  let radius = 0;
  let alpha = 0.5;
  let rotorAngle = 0;
  const ROTOR_SPEED = 0.32;
  let ball: Ball = { phase: 'track', angle: 0, speed: -6.5 };

  function launch() {
    ball = { phase: 'track', angle: Math.random() * Math.PI * 2, speed: -(6 + Math.random() * 1.8) };
  }

  function stepBall(dt: number, t: number) {
    if (ball.phase === 'track') {
      ball.angle += ball.speed * dt;
      ball.speed *= Math.pow(0.82, dt); // the track's drag
      if (Math.abs(ball.speed) < 1.9) ball = { phase: 'drop', angle: ball.angle, speed: ball.speed, r: BALL_TRACK, vr: 0, since: t };
    } else if (ball.phase === 'drop') {
      ball.angle += ball.speed * dt;
      // Pulled toward the rotor's turning frame, bouncing off frets on the way.
      ball.speed += (ROTOR_SPEED - ball.speed) * Math.min(1, dt * 1.6);
      ball.vr -= 0.9 * dt;
      ball.r += ball.vr * dt;
      if (ball.r < BALL_POCKET) {
        ball.r = BALL_POCKET;
        ball.vr = Math.abs(ball.vr) * 0.45;
        ball.speed += (Math.random() - 0.5) * 1.6;
      }
      if (t - ball.since > 2.4 && Math.abs(ball.vr) < 0.05) {
        const rel = ((ball.angle - rotorAngle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        ball = { phase: 'rest', slot: Math.round(rel / SLOT) % ORDER.length, since: t };
      }
    } else if (t - ball.since > 6) {
      launch();
    }
  }

  function ballPos(): { a: number; r: number } {
    if (ball.phase === 'rest') return { a: rotorAngle - Math.PI / 2 + ball.slot * SLOT, r: BALL_POCKET };
    if (ball.phase === 'drop') return { a: ball.angle, r: ball.r };
    return { a: ball.angle, r: BALL_TRACK };
  }

  return {
    resize(w, h) {
      const mobile = w < 768;
      radius = mobile ? Math.max(w, h) * 0.42 : Math.max(w * 0.36, h * 0.58);
      cx = w - radius * (mobile ? 0.45 : 0.62);
      cy = h - radius * LEAN * (mobile ? 0.35 : 0.5);
      alpha = mobile ? 0.3 : 0.5;
    },

    draw(ctx, t, dt, tilt: Tilt) {
      rotorAngle += ROTOR_SPEED * dt;
      stepBall(dt, t);
      const x0 = cx - tilt.x * 18;
      const y0 = cy - tilt.y * 12;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Shadow on the table under the wheel.
      ctx.save();
      ctx.translate(x0 + radius * 0.04, y0 + radius * LEAN * 0.1);
      ctx.scale(1, LEAN);
      const shade = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, radius * 1.12);
      shade.addColorStop(0, 'rgba(0,0,0,0.6)');
      shade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // The wheel, leaning back.
      ctx.save();
      ctx.translate(x0, y0);
      ctx.scale(1, LEAN);
      ctx.drawImage(bowl, -radius, -radius, radius * 2, radius * 2);
      ctx.save();
      ctx.rotate(rotorAngle);
      ctx.drawImage(rotor, -radius, -radius, radius * 2, radius * 2);
      ctx.restore();

      // Light from the top left: a soft sheen across the whole wheel.
      const sheen = ctx.createRadialGradient(-radius * 0.45, -radius * 0.55, 0, -radius * 0.2, -radius * 0.2, radius * 1.1);
      sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.03)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // The ball is a sphere, so it is placed through the lean but not squashed by it.
      const { a, r } = ballPos();
      const bx = x0 + Math.cos(a) * r * radius;
      const by = y0 + Math.sin(a) * r * radius * LEAN;
      const br = Math.max(4, radius * 0.022);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(bx + br * 0.35, by + br * 0.55, br, br * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      const glossy = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.45, br * 0.1, bx, by, br);
      glossy.addColorStop(0, '#ffffff');
      glossy.addColorStop(0.55, '#e6e9ee');
      glossy.addColorStop(1, '#8d939c');
      ctx.globalAlpha = Math.min(1, alpha * 1.6);
      ctx.fillStyle = glossy;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
  };
}
