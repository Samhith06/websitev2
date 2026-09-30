import Link from 'next/link';
import { headers } from 'next/headers';
import { CopyButton } from '@/components/ui/CopyButton';
import { SlotArt } from '@/components/site/SlotArt';
import { BattleBoard, BattleRosters, pointsChip } from '@/components/site/BattleBoard';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { pts, TEAMS } from '@/lib/battle';
import { battleEntriesFor, battleTurnsFor, featuredBattle, summariseBattle } from '@/lib/store/battle';
import { coins, dateTime, money } from '@/lib/format';
import {
  BattleResultForm,
  BattleSwitches,
  DeleteBattleButton,
  DismissBattleEntryButton,
  StartBattleForm,
} from '@/components/admin/BattleControls';

export const metadata = { title: 'Team battle' };
export const dynamic = 'force-dynamic';

export default async function AdminBattlePage() {
  const origin = await siteOrigin();
  const battle = await featuredBattle();
  const [turns, entries] = battle
    ? await Promise.all([battleTurnsFor(battle.id), battleEntriesFor(battle.id)])
    : [[], []];
  const s = battle ? summariseBattle(battle, turns, entries) : null;
  const running = battle?.status === 'running';
  const last = turns[turns.length - 1];
  const paidEntries = entries.filter((e) => e.paid > 0);

  return (
    <>
      {/* The pool fills from chat on its own; keep it current without a reload. */}
      {running ? <AutoRefresh seconds={5} /> : null}
      <div className="sec-head">
        <div>
          <span className="eyebrow">Stream games</span>
          <h1>Team battle</h1>
          <div className="sh-sub">
            Chat joins with <b>!sr &lt;team&gt; &lt;slot&gt;</b> — while a battle runs, !sr goes here instead of
            the <Link href="/admin/hunt">hunt</Link>. It can&apos;t run alongside another !sr game. The public
            page is <Link href="/battle">/battle</Link>.
          </div>
        </div>
      </div>

      {!running ? <StartBattleForm /> : null}

      <OverlayLinks origin={origin} />

      {!battle || !s ? (
        <div className="emptyq">No team battle yet.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <b style={{ fontSize: 15, marginRight: 4 }}>{battle.title}</b>
              <span className={`tag ${running ? 'blue' : ''}`}>
                {running ? (s.winner ? 'Running · decided' : 'Running') : battle.winner ? 'Finished' : 'Finished · stopped'}
              </span>
              <span className="tag">
                {battle.names.a} vs {battle.names.b}
              </span>
              <span className="tag">{battle.rounds} buys per team</span>
              {running ? <span className="tag">{battle.requestsOpen ? '!sr open' : '!sr closed'}</span> : null}
              {battle.prize ? <span className="tag gold">{coins(battle.prize)} MC pot</span> : null}
            </div>

            {running && s.winner ? (
              <p className="bingo-banner">
                {battle.names[s.winner]} win {pts(s.total.a)}–{pts(s.total.b)}. End the battle to pay the team
                {s.share ? ` (${coins(s.share)} MC each to ${s.sides[s.winner].linked} linked)` : ''}.
              </p>
            ) : null}
            {running && s.tiebreak ? (
              <p className="bingo-banner">Level at {pts(s.total.a)} each — draw a tiebreaker: one more buy each.</p>
            ) : null}

            {!running ? (
              <p className="small" style={{ marginBottom: 0 }}>
                {!battle.winner ? (
                  <span className="muted">Ended before it was decided, so nobody was paid.</span>
                ) : paidEntries.length ? (
                  <>
                    Paid <b style={{ color: 'var(--gold)' }}>{coins(paidEntries[0].paid)} MC</b> each to{' '}
                    {paidEntries.map((e) => e.kickUsername).join(', ')}.
                  </>
                ) : battle.prize ? (
                  <span className="muted">No winning member had a linked Kick account, so nothing was paid.</span>
                ) : null}
              </p>
            ) : (
              <BattleSwitches
                gameId={battle.id}
                requestsOpen={battle.requestsOpen}
                nextTeam={s.next ? battle.names[s.next] : null}
                waiting={s.next ? s.sides[s.next].waiting : 0}
                inPlay={s.playing != null}
                decided={s.winner != null}
                canUndo={last != null && last.status === 'played'}
              />
            )}

            {/* A battle that paid its winners is the record of that payment, so
                it has no delete button (the store refuses it too). */}
            {paidEntries.length ? null : (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--edge)' }}>
                <DeleteBattleButton gameId={battle.id} title={battle.title} />
              </div>
            )}
          </div>

          <div className="kpis">
            <Kpi label={battle.names.a} value={pts(s.total.a)} detail={`${s.sides.a.members} members`} tone="b" />
            <Kpi label={battle.names.b} value={pts(s.total.b)} detail={`${s.sides.b.members} members`} tone="w" />
            <Kpi label="Buys" value={String(s.bought)} detail={`${money(s.cost)} spent`} />
            <Kpi label="Profit" value={money(s.profit)} tone={s.profit >= 0 ? 'g' : 'w'} />
          </div>

          <div className="raid-admin">
            <div style={{ minWidth: 0 }}>
              <BattleBoard battle={battle} s={s} />
              <div className="card" style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Points by member</h3>
                <BattleRosters battle={battle} s={s} limit={12} />
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              {s.playing ? (
                <div className="card" style={{ marginBottom: 14 }}>
                  <span className="eyebrow">Now playing · for {battle.names[s.playing.team]}</span>
                  <div className="slotcell" style={{ margin: '8px 0 14px' }}>
                    <SlotArt src={s.playing.imageUrl} name={s.playing.slotName} fallbackClassName="ph" />
                    <span>
                      <b style={{ fontSize: 16 }}>{s.playing.slotName}</b>
                      <small>
                        {s.playing.provider ? `${s.playing.provider} · ` : ''}for {s.playing.kickUsername}
                      </small>
                    </span>
                  </div>
                  <BattleResultForm key={s.playing.id} turnId={s.playing.id} />
                  <p className="small muted">The buy&apos;s multiplier is added to {battle.names[s.playing.team]}&apos;s total.</p>
                </div>
              ) : null}

              {running
                ? TEAMS.map((t) => {
                    const waiting = entries.filter((e) => e.team === t && e.status === 'waiting');
                    return (
                      <div key={t} style={{ marginBottom: 16 }}>
                        <h2 style={{ fontSize: 15, marginBottom: 10 }}>
                          <span className={`bt-c-${t}`}>{battle.names[t]}</span>{' '}
                          <span className="muted small">
                            ({waiting.length} waiting of {s.sides[t].members}){s.next === t ? ' · next to play' : ''}
                          </span>
                        </h2>
                        {waiting.length === 0 ? (
                          <div className="emptyq">
                            {battle.requestsOpen ? (
                              <>
                                Nobody waiting. Chat joins with <code>!sr {battle.names[t].toLowerCase()} &lt;slot&gt;</code>.
                              </>
                            ) : (
                              'Empty.'
                            )}
                          </div>
                        ) : (
                          waiting.map((e) => (
                            <div className="qrow" key={e.id}>
                              <div className="slotcell">
                                <SlotArt src={e.imageUrl} name={e.slotName ?? e.query} fallbackClassName="ph" />
                                <span>
                                  <b>{e.kickUsername}</b>
                                  <small>
                                    {e.slotName ?? `“${e.query}” (not in catalog)`}
                                    {e.linked ? '' : ' · not linked'}
                                    {e.turns > 0 ? ` · ${e.turns} go${e.turns === 1 ? '' : 'es'} so far` : ''}
                                  </small>
                                </span>
                              </div>
                              <DismissBattleEntryButton entryId={e.id} />
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })
                : null}
            </div>
          </div>

          <div className="sec" style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>
              Buys <span className="muted small">({turns.length})</span>
            </h2>
            {turns.length === 0 ? (
              <div className="emptyq">No buys yet.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>Viewer · slot</th>
                      <th>Cost</th>
                      <th>Paid</th>
                      <th>Points</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turns
                      .map((t, i) => [t, i + 1] as const)
                      .reverse()
                      .map(([t, n]) => (
                        <tr key={t.id}>
                          <td className="n" style={{ color: 'var(--muted)' }}>{n}</td>
                          <td>
                            <b className={`bt-c-${t.team}`}>{battle.names[t.team]}</b>
                          </td>
                          <td>
                            <div className="slotcell">
                              <SlotArt src={t.imageUrl} name={t.slotName} fallbackClassName="ph" />
                              <span>
                                <b>{t.kickUsername}</b>
                                <small>{t.slotName}</small>
                              </span>
                            </div>
                          </td>
                          <td className="n">{t.buyCost == null ? '—' : money(t.buyCost)}</td>
                          <td className="n">{t.payout == null ? '—' : money(t.payout)}</td>
                          <td className="n" style={{ whiteSpace: 'nowrap' }}>
                            {t.status === 'playing' ? (
                              <span className="tag blue">In play</span>
                            ) : t.status === 'skipped' ? (
                              <span className="tag">Skipped</span>
                            ) : (
                              pointsChip(t)
                            )}
                          </td>
                          <td className="n" style={{ color: 'var(--muted)' }}>{dateTime(t.drawnAt)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="small muted" style={{ marginTop: 10, maxWidth: '72ch' }}>
              When the battle ends, the pot is split evenly — rounded down to whole coins — across every member of
              the winning team with a verified Kick link, whether or not their own slot was played. Until then a
              mistyped result can be undone. A member can !sr again after playing, and stays on their team.
            </p>
          </div>
        </>
      )}
    </>
  );
}

/** AUTH_URL is the deployed origin; locally, whatever host served this page. */
async function siteOrigin(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/+$/, '');
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

const OVERLAYS: Array<[string, string, string]> = [
  ['Everything', '', '520 × 700'],
  ['Scoreboard', '?panel=score', '520 × 330'],
  ['Now playing', '?panel=now', '460 × 150'],
  ['Team rosters', '?panel=teams', '460 × 260'],
  ['Stats strip', '?panel=stats', '520 × 90'],
];

/** The URLs to paste into OBS, collapsed because they are set up once. */
function OverlayLinks({ origin }: { origin: string }) {
  return (
    <details className="card" style={{ marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>OBS overlays</summary>
      <p className="small muted" style={{ margin: '10px 0 12px' }}>
        Add each as a <b>Browser</b> source in OBS at the size shown (it can be resized after). The
        background is transparent, it updates itself every few seconds, and it shows nothing before the
        first battle.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OVERLAYS.map(([label, query, size]) => {
          const url = `${origin}/overlay/battle${query}`;
          return (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ width: 140, fontSize: 13.5 }}>{label}</b>
              <code className="small" style={{ flex: '1 1 260px', wordBreak: 'break-all', color: 'var(--blue)' }}>
                {url}
              </code>
              <span className="small muted" style={{ width: 170 }}>{size}</span>
              <CopyButton value={url} compact />
            </div>
          );
        })}
      </div>
    </details>
  );
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: 'g' | 'b' | 'w' }) {
  return (
    <div className="kpi">
      <div className="kl">{label}</div>
      <div className={`kv ${tone ?? ''}`}>{value}</div>
      {detail ? <div className="kd">{detail}</div> : null}
    </div>
  );
}
