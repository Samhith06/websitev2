import { rows } from '@/lib/db';
import { disabledGames, gamesAreKilled } from '@/lib/store/settings';
import { LIMITS } from '@/lib/games';
import { gameConfigs } from '@/lib/mock';
import { coins } from '@/lib/format';

export const metadata = { title: 'Coin settings' };
export const dynamic = 'force-dynamic';

/**
 * The operational switches.
 *
 * Everything here is read on every request rather than cached — a kill switch
 * you reach for in an emergency must not wait out a cache. Changing a rate
 * affects future awards only; nothing already in the ledger moves, because the
 * ledger is append-only and rewriting it would destroy the one record that can
 * answer "where did my coins go".
 */
export default async function AdminSettingsPage() {
  const [killed, disabled, stored] = await Promise.all([
    gamesAreKilled(),
    disabledGames(),
    rows<{ key: string; value: unknown }>('SELECT key, value FROM settings ORDER BY key'),
  ]);

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Owner only</span>
          <h1>Coin settings</h1>
          <div className="sh-sub">
            Changing these affects future awards only — nothing already in the ledger moves.
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Games</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>
          The kill switch is checked inside the play route, not just the lobby — a switch that
          leaves the API accepting bets is not a switch.
        </p>

        <div className="linkrow" style={{ borderTop: 0 }}>
          <span>Games available site-wide</span>
          <span className={`tag ${killed ? 'red' : 'green'}`}>{killed ? 'Killed' : 'On'}</span>
        </div>
        {gameConfigs
          .filter((g) => !g.comingSoon)
          .map((game) => (
            <div className="linkrow" key={game.slug}>
              <span>{game.name}</span>
              <span className={`tag ${disabled.includes(game.slug) ? 'red' : 'green'}`}>
                {disabled.includes(game.slug) ? 'Off' : 'On'}
              </span>
            </div>
          ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Limits</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>
          A maximum bet and a maximum win per round mean a mistake in a paytable cannot mint a
          million coins before anyone notices.
        </p>
        <div className="linkrow" style={{ borderTop: 0 }}>
          <span>Minimum bet</span>
          <span className="lv">{coins(LIMITS.minBet)}</span>
        </div>
        <div className="linkrow">
          <span>Maximum bet</span>
          <span className="lv">{coins(LIMITS.maxBet)}</span>
        </div>
        <div className="linkrow">
          <span>Maximum win per round</span>
          <span className="lv">{coins(LIMITS.maxWinPerRound)}</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Stored settings</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>
          Every row the site reads at runtime. Anything absent falls back to the value in code.
        </p>
        {stored.length === 0 ? (
          <div className="small muted">Nothing stored — every switch is at its default.</div>
        ) : (
          <div className="tw" style={{ border: 0 }}>
            <table style={{ minWidth: 380 }}>
              <tbody>
                {stored.map((row) => (
                  <tr key={row.key}>
                    <td className="n">{row.key}</td>
                    <td className="n" style={{ textAlign: 'right', color: 'var(--muted)' }}>
                      {JSON.stringify(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        The earn rates — one coin per 180-second block, ×2 for subs, ×2.5 for VIPs, ×3 for both, a
        +10 bonus every unbroken hour and a 500-coin cap per stream — live with the points engine.
        Moving them to editable rows is the next piece of work on this screen.
      </p>
    </>
  );
}
