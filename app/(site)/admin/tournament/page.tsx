import Link from 'next/link';
import { headers } from 'next/headers';
import { CopyButton } from '@/components/ui/CopyButton';
import { SlotArt } from '@/components/site/SlotArt';
import { TourneyBracket, TourneyVersus } from '@/components/site/TourneyBracket';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { roundName, scoreOf, x } from '@/lib/tourney';
import {
  featuredTourney,
  summariseTourney,
  tourneyEntriesFor,
  tourneyMatchesFor,
  tourneyTurnsFor,
} from '@/lib/store/tourney';
import { coins, dateTime, money } from '@/lib/format';
import {
  DeleteTourneyButton,
  RemoveSignupButton,
  SignupSwitches,
  StartTourneyForm,
  TourneyResultForm,
  TourneySwitches,
} from '@/components/admin/TourneyControls';

export const metadata = { title: 'Slot tournament' };
export const dynamic = 'force-dynamic';

export default async function AdminTourneyPage() {
  const origin = await siteOrigin();
  const t = await featuredTourney();
  const [entries, matches, turns] = t
    ? await Promise.all([tourneyEntriesFor(t.id), tourneyMatchesFor(t.id), tourneyTurnsFor(t.id)])
    : [[], [], []];
  const s = t ? summariseTourney(t, entries, matches, turns) : null;
  const live = t != null && t.status !== 'finished';
  const last = turns[turns.length - 1];
  const nextSide = s?.current?.state.next ?? null;
  const nextPlayer = s?.current && nextSide ? s.current[nextSide] : null;
  const roundLabel = s?.current ? roundName(s.current.round, s.rounds) : null;
  const champEntry = s?.champion ? entries.find((e) => e.id === s.champion?.entryId) : undefined;

  return (
    <>
      {/* Sign-ups fill from chat on their own; keep it current without a reload. */}
      {live ? <AutoRefresh seconds={5} /> : null}
      <div className="sec-head">
        <div>
          <span className="eyebrow">Stream games</span>
          <h1>Slot tournament</h1>
          <div className="sh-sub">
            Chat signs up with <b>!sr &lt;slot&gt;</b> — while a tournament is live, !sr goes here instead of the{' '}
            <Link href="/admin/hunt">hunt</Link>. It can&apos;t run alongside another !sr game. The public page is{' '}
            <Link href="/tournament">/tournament</Link>.
          </div>
        </div>
      </div>

      {!live ? <StartTourneyForm /> : null}

      <OverlayLinks origin={origin} />

      {!t || !s ? (
        <div className="emptyq">No tournament yet.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <b style={{ fontSize: 15, marginRight: 4 }}>{t.title}</b>
              <span className={`tag ${live ? 'blue' : ''}`}>
                {t.status === 'signup' ? 'Sign-ups' : t.status === 'running' ? (s.champion ? 'Final decided' : 'Playing') : 'Finished'}
              </span>
              <span className="tag">{t.size}-player bracket</span>
              {live ? <span className="tag">{t.requestsOpen ? '!sr open' : '!sr closed'}</span> : null}
              {t.prize ? <span className="tag gold">{coins(t.prize)} MC to the champion</span> : null}
            </div>

            {t.status === 'running' && s.champion ? (
              <p className="bingo-banner">♜ {s.champion.kickUsername} wins the final. End the tournament to crown them.</p>
            ) : null}

            {t.status === 'signup' ? (
              <SignupSwitches gameId={t.id} requestsOpen={t.requestsOpen} signups={entries.length} size={t.size} />
            ) : t.status === 'running' ? (
              <TourneySwitches
                gameId={t.id}
                requestsOpen={t.requestsOpen}
                nextLabel={nextPlayer ? `${nextPlayer.kickUsername}'s buy (${roundLabel})` : null}
                inPlay={s.playing != null}
                decided={s.champion != null}
                canUndo={last != null && last.status === 'played'}
                current={s.current?.a && s.current.b ? { a: s.current.a.kickUsername, b: s.current.b.kickUsername } : null}
              />
            ) : (
              <p className="small" style={{ marginBottom: 0 }}>
                {!s.champion || !t.startedAt ? (
                  <span className="muted">Ended before the final was decided, so nobody was paid.</span>
                ) : champEntry?.paid ? (
                  <>
                    Paid <b style={{ color: 'var(--gold)' }}>{coins(champEntry.paid)} MC</b> to champion {s.champion.kickUsername}.
                  </>
                ) : t.prize ? (
                  <span className="muted">{s.champion.kickUsername}&apos;s Kick account wasn&apos;t linked, so nothing was paid.</span>
                ) : (
                  <>Champion: {s.champion.kickUsername}.</>
                )}
              </p>
            )}

            {/* A tournament that paid its champion is the record of that
                payment, so it has no delete button (the store refuses it too). */}
            {champEntry?.paid ? null : (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--edge)' }}>
                <DeleteTourneyButton gameId={t.id} title={t.title} />
              </div>
            )}
          </div>

          {t.status === 'signup' ? (
            <div className="sec">
              <h2 style={{ fontSize: 15, marginBottom: 10 }}>
                Signed up <span className="muted small">({entries.length} for {t.size} places)</span>
              </h2>
              {entries.length === 0 ? (
                <div className="emptyq">{t.requestsOpen ? 'Nobody has typed !sr yet.' : 'Empty.'}</div>
              ) : (
                entries.map((e) => (
                  <div className="qrow" key={e.id}>
                    <div className="slotcell">
                      <SlotArt src={e.imageUrl} name={e.slotName ?? e.query} fallbackClassName="ph" />
                      <span>
                        <b>{e.kickUsername}</b>
                        <small>
                          {e.slotName ?? `“${e.query}” (not in catalog)`}
                          {e.linked ? '' : ' · not linked'}
                        </small>
                      </span>
                    </div>
                    <RemoveSignupButton entryId={e.id} />
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="kpis">
                <Kpi label="Players" value={String(entries.filter((e) => e.seeded).length)} detail={`${s.alive.size} still in`} tone="b" />
                <Kpi label="Buys" value={String(s.bought)} detail={`${money(s.cost)} spent`} />
                <Kpi label="Paid back" value={money(s.won)} tone="g" />
                <Kpi label="Profit" value={money(s.profit)} tone={s.profit >= 0 ? 'g' : 'w'} />
              </div>

              {t.status === 'running' && s.current ? (
                <div className="raid-admin" style={{ marginBottom: 18 }}>
                  <div style={{ minWidth: 0 }}>
                    <TourneyVersus s={s} round={roundLabel ?? undefined} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {s.playing ? (
                      <div className="card">
                        <span className="eyebrow">Now playing · {roundLabel}</span>
                        <div className="slotcell" style={{ margin: '8px 0 14px' }}>
                          <SlotArt src={s.playing.imageUrl} name={s.playing.slotName} fallbackClassName="ph" />
                          <span>
                            <b style={{ fontSize: 16 }}>{s.playing.slotName}</b>
                            <small>
                              {s.playing.provider ? `${s.playing.provider} · ` : ''}for {s.playing.kickUsername}
                            </small>
                          </span>
                        </div>
                        <TourneyResultForm key={s.playing.id} turnId={s.playing.id} />
                        <p className="small muted">The higher multiplier goes through; level means both buy again.</p>
                      </div>
                    ) : (
                      <div className="card">
                        <p className="small muted" style={{ margin: 0 }}>
                          Press <b>Start</b> for the next buy. Players still in can !sr a new slot before their turn.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="card" style={{ overflowX: 'auto' }}>
                <TourneyBracket s={s} />
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
                          <th>Round</th>
                          <th>Viewer · slot</th>
                          <th>Cost</th>
                          <th>Paid</th>
                          <th>Score</th>
                          <th>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {turns
                          .map((u, i) => [u, i + 1] as const)
                          .reverse()
                          .map(([u, n]) => {
                            const m = matches.find((mm) => mm.id === u.matchId);
                            const sc = scoreOf(u);
                            return (
                              <tr key={u.id}>
                                <td className="n" style={{ color: 'var(--muted)' }}>{n}</td>
                                <td className="small">{m ? roundName(m.round, s.rounds) : '—'}</td>
                                <td>
                                  <div className="slotcell">
                                    <SlotArt src={u.imageUrl} name={u.slotName} fallbackClassName="ph" />
                                    <span>
                                      <b>{u.kickUsername}</b>
                                      <small>{u.slotName}</small>
                                    </span>
                                  </div>
                                </td>
                                <td className="n">{u.buyCost == null ? '—' : money(u.buyCost)}</td>
                                <td className="n">{u.payout == null ? '—' : money(u.payout)}</td>
                                <td className="n">
                                  {u.status === 'playing' ? (
                                    <span className="tag blue">In play</span>
                                  ) : u.status === 'skipped' ? (
                                    <span className="tag">Skipped</span>
                                  ) : sc == null ? (
                                    '—'
                                  ) : (
                                    x(sc)
                                  )}
                                </td>
                                <td className="n" style={{ color: 'var(--muted)' }}>{dateTime(u.drawnAt)}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="small muted" style={{ marginTop: 10, maxWidth: '72ch' }}>
                  Only the champion is paid, when the tournament ends and only with a verified Kick link; until then
                  a mistyped result can be undone — even one that decided a match. A player who can&apos;t be played
                  can be forfeited, and their opponent goes through.
                </p>
              </div>
            </>
          )}
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
  ['Everything', '', '1100 × 760'],
  ['Bracket', '?panel=bracket', '1100 × 520 (16 players: 1280 × 720)'],
  ['Match (head to head)', '?panel=match', '620 × 200'],
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
        first tournament. During sign-ups the match panel shows how to enter.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OVERLAYS.map(([label, query, size]) => {
          const url = `${origin}/overlay/tournament${query}`;
          return (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ width: 160, fontSize: 13.5 }}>{label}</b>
              <code className="small" style={{ flex: '1 1 260px', wordBreak: 'break-all', color: 'var(--blue)' }}>
                {url}
              </code>
              <span className="small muted" style={{ width: 200 }}>{size}</span>
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
