import Link from 'next/link';
import { pokerPlayers } from '@/lib/store/profile';
import { relativeTime } from '@/lib/format';

export const metadata = { title: 'Poker night' };
export const dynamic = 'force-dynamic';

/** The entry rule this list is read against: hours of Kick watch time this week. */
const WATCH_HOURS = 5;

/**
 * Who has given a PokerNow username, for seating poker night.
 *
 * Each row carries what the entry rules ask: a verified Kick account and this
 * week's watch time, counted from Monday 00:00 UK time. Players who meet both
 * are listed first and marked ready; the rest stay visible so a mod can see
 * who is close.
 */
export default async function AdminPokerPage() {
  const players = await pokerPlayers();
  const ready = (p: (typeof players)[number]) => Boolean(p.kickUsername) && p.weekMinutes >= WATCH_HOURS * 60;
  const sorted = [...players].sort((a, b) => Number(ready(b)) - Number(ready(a)));
  const readyCount = players.filter(ready).length;

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Stream games</span>
          <h1>Poker night</h1>
          <div className="sh-sub">
            PokerNow usernames entered on the site, with Kick and this week&rsquo;s watch time.
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kl">Usernames entered</div>
          <div className="kv b">{players.length}</div>
        </div>
        <div className="kpi">
          <div className="kl">Meet the entry rules</div>
          <div className="kv g">{readyCount}</div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="emptyq">
          Nobody has entered a PokerNow username yet. Players add theirs on the{' '}
          <Link href="/poker">Poker page</Link> or their profile.
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>PokerNow</th>
                <th>Discord</th>
                <th>Kick</th>
                <th>Watched this week</th>
                <th>Status</th>
                <th>Entered</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const hours = p.weekMinutes / 60;
                return (
                  <tr key={p.userId}>
                    <td className="n">
                      <b>{p.handle}</b>
                    </td>
                    <td>
                      <Link href={`/admin/users/${p.userId}`}>{p.discordUsername}</Link>
                    </td>
                    <td>{p.kickUsername ?? <span className="tag warn">Not linked</span>}</td>
                    <td className="n">{hours.toFixed(1)}h</td>
                    <td>
                      {ready(p) ? (
                        <span className="tag green">Ready</span>
                      ) : !p.kickUsername ? (
                        <span className="tag warn">Needs Kick</span>
                      ) : (
                        <span className="tag warn">{(WATCH_HOURS - hours).toFixed(1)}h short</span>
                      )}
                    </td>
                    <td className="small muted">{relativeTime(p.updatedAt.toISOString())}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
