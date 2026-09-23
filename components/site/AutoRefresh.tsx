'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Re-renders the server page every few seconds while it is being looked at.
 *
 * `router.refresh()` re-runs the server components and swaps in the result
 * without losing scroll or client state, so a page open on a second monitor
 * during the hunt keeps up with chat and the payouts. A hidden tab does not
 * poll — it refreshes once when it comes back instead.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const timer = setInterval(tick, seconds * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router, seconds]);

  return null;
}
