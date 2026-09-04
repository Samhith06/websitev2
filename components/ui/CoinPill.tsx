'use client';

import { useEffect, useState } from 'react';
import { coins } from '@/lib/format';
import { onBalance } from '@/lib/balance-bus';

/**
 * A coin balance that keeps up with play.
 *
 * Takes the server's figure and then follows the balance bus, so a round
 * settling updates it without a reload. The server value still wins on every
 * navigation — this only covers the gap between renders.
 */
export function CoinPill({ balance }: { balance: number }) {
  const [live, setLive] = useState(balance);

  useEffect(() => setLive(balance), [balance]);
  useEffect(() => onBalance(setLive), []);

  return (
    <div className="coinpill">
      <div className="coin" aria-hidden>
        M
      </div>
      <span className="cv">{coins(live)}</span>
    </div>
  );
}
