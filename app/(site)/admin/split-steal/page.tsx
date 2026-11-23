import Link from 'next/link';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import {
  EntrySwitches,
  OpenSplitStealForm,
  PaidButton,
  RevealPairButton,
  RevealSwitches,
} from '@/components/admin/SplitStealControls';
import { staffRole } from '@/lib/admin-gate';
import { dateShort, money, relativeTime } from '@/lib/format';
import {
  SPLIT_STEAL_WAGER_MIN,
  entriesOf,
  featuredEvent,
  pairsOf,
  recentEvents,
  type Choice,
  type SsSide,
} from '@/lib/store/split-steal';

export const metadata = { title: 'Split or Steal' };
export const dynamic = 'force-dynamic';

const STATUS_LABEL = {
  open: 'Entries open',
  choosing: 'Choosing',
  finished: 'Finished',
  cancelled: 'Cancelled',
} as const;

/**
 * Running a Split or Steal: open it, draw the pairs, reveal them on stream,
 * and pay the winners. Choices are hidden here as well until a pair is
 * revealed, so the reveal is a surprise to the mod pressing the button too.
 */
export default async function AdminSplitStealPage() {
  // The layout's sign-in screen hides this page but would not stop its data being sent.
  const role = await staffRole();
  if (!role) return null;
  const isOwner = role === 'owner';

  const [event, history] = await Promise.all([featuredEvent(), recentEvents(10)]);
  const live = event != null && (event.status === 'open' || event.status === 'choosing');
  const [entries, pairs] = event
    ? await Promise.all([entriesOf(event.id), event.status === 'open' ? Promise.resolve([]) : pairsOf(event, null)])
    : [[], []];

  const hidden = pairs.filter((p) => !p.revealed).length;
  const lockedIn = pairs.reduce((n, p) => n + Number(p.a.locked) + Number(p.b.locked), 0);
  const winners = pairs.flatMap((p) =>
    p.revealed ? [p.a, p.b].filter((s) => (s.payout ?? 0) > 0).map((s) => ({ side: s, pair: p })) : [],
  );
  const owed = winners.filter((w) => !w.pair.paidAt).reduce((sum, w) => sum + (w.side.payout ?? 0), 0);

  return (
    <>
      {live ? <AutoRefresh seconds={5} /> : null}
      <div className="sec-head">
        <div>
          <span className="eyebrow">Stream games</span>
          <h1>Split or Steal</h1>
          <div className="sh-sub">
            Played on the site, not in chat. Entry needs {money(SPLIT_STEAL_WAGER_MIN)} wagered under the code this
            leaderboard period. The public page is <Link href="/split-or-steal">/split-or-steal</Link>.
          </div>
        </div>
      </div>

      {!live ? (
        isOwner ? (
          <OpenSplitStealForm />
        ) : (
          <div className="emptyq" style={{ marginBottom: 18 }}>
            Only the owner can open a Split or Steal, since it sets a cash prize.
          </div>
        )
      ) : null}

      {!event ? (
        <div className="emptyq">No Split or Steal yet.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <b style={{ fontSize: 15, marginRight: 4 }}>{event.title}</b>
              <span className={`tag ${live ? 'blue' : ''}`}>{STATUS_LABEL[event.status]}</span>
              <span className="tag gold">{money(event.prize)} per pair</span>
              <span className="tag">up to {event.pairs} pairs</span>
            </div>

            <div className="kpis" style={{ marginBottom: 14 }}>
              <div className="kpi">
                <div className="kl">Entered</div>
                <div className="kv b">{entries.length}</div>
              </div>
              {event.status !== 'open' ? (
                <>
                  <div className="kpi">
                    <div className="kl">Locked in</div>
                    <div className="kv g">
                      {lockedIn} / {pairs.length * 2}
                    </div>
                  </div>
                  <div className="kpi">
                    <div className="kl">Still to pay</div>
                    <div className="kv w">{money(owed)}</div>
                  </div>
                </>
              ) : null}
            </div>

            {event.status === 'open' ? (
              <EntrySwitches eventId={event.id} entries={entries.length} pairs={event.pairs} isOwner={isOwner} />
            ) : event.status === 'choosing' ? (
              <RevealSwitches eventId={event.id} hidden={hidden} isOwner={isOwner} />
            ) : null}
          </div>

          {pairs.length > 0 ? (
            <div className="tw" style={{ marginBottom: 18 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player A</th>
                    <th>Player B</th>
                    <th>Result</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p) => {
                    const pairWinnings = (p.a.payout ?? 0) + (p.b.payout ?? 0);
                    return (
                      <tr key={p.id}>
                        <td className="n">{p.position}</td>
                        <td>
                          <Side side={p.a} revealed={p.revealed} />
                        </td>
                        <td>
                          <Side side={p.b} revealed={p.revealed} />
                        </td>
                        <td className="small">{p.revealed ? resultText(p.a, p.b) : <span className="muted">Hidden</span>}</td>
                        <td>
                          {!p.revealed && event.status === 'choosing' ? (
                            <RevealPairButton
                              eventId={event.id}
                              pairId={p.id}
                              missing={Number(!p.a.locked) + Number(!p.b.locked)}
                            />
                          ) : p.revealed && pairWinnings > 0 ? (
                            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                              {p.paidAt ? <span className="tag green">Paid</span> : null}
                              <PaidButton pairId={p.id} paid={Boolean(p.paidAt)} />
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {event.status === 'open' ? (
            entries.length === 0 ? (
              <div className="emptyq">Nobody has entered yet.</div>
            ) : (
              <div className="tw" style={{ marginBottom: 18 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Wagered at entry</th>
                      <th>Entered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.userId}>
                        <td>
                          <Link href={`/admin/users/${e.userId}`}>{e.username}</Link>
                        </td>
                        <td className="n">{money(e.wagered)}</td>
                        <td className="small muted">{relativeTime(e.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </>
      )}

      {history.length > 1 ? (
        <div className="sec" style={{ marginTop: 26 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Recent events</h2>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Prize per pair</th>
                  <th>Entered</th>
                  <th>Status</th>
                  <th>Opened</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.title}</td>
                    <td className="n">{money(h.prize)}</td>
                    <td className="n">{h.entryCount}</td>
                    <td>{STATUS_LABEL[h.status]}</td>
                    <td className="small muted">{dateShort(h.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}

function word(choice: Choice | null): string {
  return choice === 'split' ? 'Split' : choice === 'steal' ? 'Steal' : 'No choice';
}

function Side({ side, revealed }: { side: SsSide; revealed: boolean }) {
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Link href={`/admin/users/${side.userId}`}>{side.username}</Link>
      {revealed ? (
        <span className={`tag ${side.choice === 'split' ? 'green' : side.choice === 'steal' ? 'red' : ''}`}>
          {word(side.choice)}
          {side.payout ? ` · ${money(side.payout)}` : ''}
        </span>
      ) : side.locked ? (
        <span className="tag green">Locked in</span>
      ) : (
        <span className="tag warn">Not chosen</span>
      )}
    </span>
  );
}

function resultText(a: SsSide, b: SsSide): string {
  if (!a.choice && !b.choice) return 'Neither chose: nobody wins';
  if (!a.choice || !b.choice) return `${(a.choice ? a : b).username} wins by forfeit`;
  if (a.choice === 'split' && b.choice === 'split') return 'Both split';
  if (a.choice === 'steal' && b.choice === 'steal') return 'Both stole: nobody wins';
  return `${(a.choice === 'steal' ? a : b).username} stole it`;
}
