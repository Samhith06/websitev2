/** Where the cursor sits, eased, from -0.5 to 0.5 on each axis (0 when there is none). */
export type Tilt = { x: number; y: number };

/**
 * One animated backdrop. Ambient owns the canvas, the loop, resizing and the
 * reduced-motion switch; a scene only knows how to lay itself out and draw.
 */
export type Scene = {
  resize(width: number, height: number): void;
  /** `t` is seconds since the scene started, `dt` the seconds since the last frame. */
  draw(ctx: CanvasRenderingContext2D, t: number, dt: number, tilt: Tilt): void;
};
