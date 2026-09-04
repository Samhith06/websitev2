'use client';

import { useEffect, useState } from 'react';

const KEY = 'ms.agegate.v1';

/**
 * An age gate on first visit, with the persistent notice living in the footer.
 *
 * The decision is kept in localStorage rather than a cookie because it is a
 * per-device acknowledgement, not something the server needs to act on. If
 * storage is blocked the gate simply reappears — annoying, but the honest
 * failure mode, since the alternative is letting it through unacknowledged.
 */
export function AgeGate() {
  const [decided, setDecided] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDecided(window.localStorage.getItem(KEY) === 'yes');
    } catch {
      setDecided(false);
    }
  }, []);

  // Nothing renders until we know, so the gate never flashes for a returning
  // visitor.
  if (decided === null || decided) return null;

  function accept() {
    try {
      window.localStorage.setItem(KEY, 'yes');
    } catch {
      /* nothing to do — the gate simply reappears next visit */
    }
    setDecided(true);
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="agegate-title">
      <div className="mbox">
        <div
          className="age"
          style={{ margin: '0 auto 16px', width: 46, height: 46, fontSize: 16 }}
          aria-hidden
        >
          18+
        </div>
        <h2 id="agegate-title">Are you over 18?</h2>
        <p>
          This site promotes real-money gambling on Razed and is for adults only. By continuing you
          confirm you are of legal gambling age in your country.
        </p>
        <p style={{ marginTop: -8 }}>
          Matty Coins are earned by watching. They cannot be bought, hold no cash value, and are not
          a wager.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn pri wide" onClick={accept}>
            I am 18 or over
          </button>
          <a className="btn ghost wide" href="https://www.begambleaware.org">
            Leave
          </a>
        </div>
      </div>
    </div>
  );
}
