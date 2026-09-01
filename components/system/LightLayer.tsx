"use client";

import { usePauseOnHidden } from '@/lib/useReducedMotion';

/**
 * The signature element (Late Night §3).
 *
 * One fixed light source behind the entire page, wired to the live state. The
 * page scrolls; the light does not, which is what makes the site read as one
 * room instead of stacked sections.
 *
 * Live  — magenta, full strength, drifting on a 90 second cycle.
 * Offline — cool, dim, and completely still. The countdown becomes the only
 *           lit thing on the page.
 *
 * The transition between the two is 1200ms. If a viewer is on the page when
 * Matty goes live, the room lighting up around them is the best moment this
 * site can produce, so it never snaps.
 *
 * Decorative in full: aria-hidden, pointer-events none, and it never receives
 * focus. Content sits above it on `.above-light`.
 */
export function LightLayer({ live }: { live: boolean }) {
  usePauseOnHidden();

  return (
    <div
      className={`light-layer ${live ? 'light-live' : 'light-off'}`}
      aria-hidden="true"
    >
      <div className="light-key" />
      <div className="light-fill" />
      <div className="light-grain" />
    </div>
  );
}
