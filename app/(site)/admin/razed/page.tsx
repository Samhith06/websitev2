import { rows } from '@/lib/db';
import { LIFETIME_PERIOD, feedHealth, latestWagerRows } from '@/lib/store/razed-snapshots';
import { money, relativeTime } from '@/lib/format';
import { SyncRazedButton } from '@/components/admin/AdminButtons';

export const metadata = { title: 'Razed wagerers' };
export const dynamic = 'force-dynamic';

/**
 * Everyone wagering under the code, linked here or not.
 *
 * This is the one screen that shows full Razed usernames, because staff need
 * them to send tips by hand. Everywhere a member can see is masked.
 */
export default async function AdminRazedPage() {
  const [wagerers, health, links, snapshots] = await Promise.all([
    latestWagerRows(),
    feedHealth(),
    rows<{ username: string; discord_username: string; status: string }>(
      `SELECT rl.username, u.discord_username, rl.status
         FROM razed_links rl JOIN users u ON u.id = rl.user_id`,
    ),
    rows<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM razed_snapshots WHERE period = $1`,
      [LIFETIME_PERIOD],
    ),
  ]);

  const linkByName = new Map(links.map((l) => [l.username.toLowerCase(), l]));
  const linkedHere = wagerers.filter((w) => linkByName.has(w.username.toLowerCase())).length;

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Straight from the Razed API</span>
          <h1>Razed wagerers</h1>
          <div className="sh-sub">
            Every account wagering under code MATTYSPINS, whether or not they have linked here.
          </div>
        </div>
        <SyncRazedButton />
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kl">Last sync</div>
          <div className={`kv ${health.stale ? 'w' : 'b'}`}>
            {health.lastSyncAt ? relativeTime(health.lastSyncAt) : 'never'}
          </div>
          <div className="kd">{health.stale ? 'stale — over an hour old' : 'healthy'}</div>
        </div>
        <div className="kpi">
          <div className="kl">Wagerers</div>
          <div className="kv">{wagerers.length}</div>
          <div className="kd">in the newest snapshot</div>
        </div>
        <div className="kpi">
          <div className="kl">Linked here</div>
          <div className="kv">{linkedHere}</div>
          <div className="kd">of {wagerers.length}</div>
        </div>
        <div className="kpi">
          <div className="kl">Snapshots kept</div>
          <div className="kv">{Number(snapshots[0]?.n ?? 0)}</div>
          <div className="kd">append-only</div>
        </div>
      </div>

      {wagerers.length === 0 ? (
        <div className="emptyq">
          No snapshot yet. Press <b>Sync now</b> to pull the lifetime figures from Razed — the
          milestone ladder reads from this.
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Razed username</th>
                <th>Lifetime wagered</th>
                <th>Site account</th>
              </tr>
            </thead>
            <tbody>
              {wagerers.map((w) => {
                const link = linkByName.get(w.username.toLowerCase());
                return (
                  <tr key={w.username}>
                    <td className="n">{w.username}</td>
                    <td className="n">{money(w.wagered)}</td>
                    <td>
                      {link ? (
                        <span className={`tag ${link.status === 'approved' ? 'green' : 'warn'}`}>
                          {link.discord_username} · {link.status}
                        </span>
                      ) : (
                        <span className="tag">Not linked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Full usernames are shown here because staff need them to send tips. Only the public
        leaderboard masks them. Snapshots are appended rather than overwritten, so a bad sync leaves
        the previous figures intact instead of emptying the board.
      </p>
    </>
  );
}
