"use client";

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Reduced motion, honoured LIVE and in BOTH directions.
 *
 * A one-shot read at mount is the usual half-fix: it handles someone who
 * arrives with the preference set and ignores someone who flips it while the
 * page is open. Flipping it on has to pin every scroll-driven element to its
 * finished state and stop the drives; flipping it back off has to remove those
 * pins and re-arm them. Re-arming the hero and leaving the rest of the page
 * pinned is the half-fix that looks done and is not.
 *
 * Returns false on the server and on the first client render so the markup
 * matches, then corrects itself in an effect.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Pause every animation on a hidden tab. animation-play-state is not an
 * inherited property, so setting it on a container silently never reaches
 * nested elements or pseudo-elements; the body-class pattern in globals.css is
 * the only one that cannot miss.
 */
export function usePauseOnHidden(): void {
  useEffect(() => {
    const sync = () => document.body.classList.toggle('paused', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      document.body.classList.remove('paused');
    };
  }, []);
}
