import Link from 'next/link';
import { headers } from 'next/headers';
import { CopyButton } from '@/components/ui/CopyButton';
import { SlotArt } from '@/components/site/SlotArt';
import { KothThrone } from '@/components/site/KothThrone';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { score } from '@/lib/koth';
import { featuredGame, kothEntriesFor, kothTurnsFor, summariseKoth } from '@/lib/store/koth';
import { coins, dateTime, money, mult } from '@/lib/format';
import {
  ChallengeResultForm,
  DeleteKothButton,
  DismissKothEntryButton,
  KothSwitches,
  StartKothForm,
} from '@/components/admin/KothControls';

export const metadata = { title: 'King of the hill' };
export const dynamic = 'force-dynamic';

export default async function AdminKothPage() {
  const origin = await siteOrigin();
  const game = await featuredGame();
  const [turns, waiting] = game
    ? await Promise.all([kothTurnsFor(game.id), kothEntriesFor(game.id, 'waiting')])
    : [[], []];
  const s = summariseKoth(turns);
  const running = game?.status === 'running';
  const last = turns[turns.length - 1];
  // Who the next draw picks from: the waiting viewers with the fewest goes.
  const fewestGoes = waiting.length ? Math.min(...waiting.map((e) => e.turns)) : 0;
  const roundSize = waiting.filter((e) => e.turns === fewestGoes).length;

  return (
    <>
      {/* The pool fills from chat on its own; keep it current without a reload. */}
      {running ? <AutoRefresh seconds={5} /> : null}
      <div className="sec-head">
        <div>
          <span className="eyebrow">Stream games</span>
          <h1>King of the hill</h1>
          <div className="sh-sub">
            Chat joins with <b>!sr &lt;slot&gt;</b> — while a game runs, !sr goes here instead of the{' '}
            <Link href="/admin/hunt">hunt</Link>. It can&apos;t run alongside a{' '}
            <Link href="/admin/bingo">slot bingo</Link>. The public page is <Link href="/koth">/koth</Link>.
          </div>
        </div>
      </div>

      {!running ? <StartKothForm /> : null}

      <OverlayLinks origin={origin} />

      {!game ? (
        <div className="emptyq">No king of the hill yet.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <b style={{ fontSize: 15, marginRight: 4 }}>{game.title}</b>
              <span className={`tag ${running ? 'blue' : ''}`}>{running ? 'Running' : 'Finished'}</span>
              {running ? <span className="tag">{game.requestsOpen ? '!sr open' : '!sr closed'}</span> : null}
              {game.prize ? <span className="tag gold">{coins(game.prize)} MC to the king</span> : null}
            </div>

            {!running ? (
              <p className="small" style={{ marginBottom: 0 }}>
                {!s.king ? (
                  <span className="muted">Ended with nobody on the hill, so nobody was paid.</span>
                ) : s.king.paid ? (
                  <>
                    Paid <b style={{ color: 'var(--gold)' }}>{coins(s.king.paid)} MC</b> to {s.king.kickUsername}.
                  </>
                ) : game.prize ? (
                  <span className="muted">{s.king.kickUsername}&apos;s Kick account wasn&apos;t linked, so nothing was paid.</span>
                ) : null}
              </p>
            ) : (
              <KothSwitches
                gameId={game.id}
                requestsOpen={game.requestsOpen}
                waiting={waiting.length}
                inPlay={s.playing != null}
                hasKing={s.king != null}
                canUndo={last != null && last.status === 'played'}
              />
            )}

            {/* A game that paid its king is the record of that payment, so it
                has no delete button (the store refuses it too). */}
            {s.king?.paid ? null : (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--edge)' }}>
                <DeleteKothButton gameId={game.id} title={game.title} />
              </div>
            )}
          </div>

          <div className="kpis">
            <Kpi label="To beat" value={s.toBeat == null ? '—' : mult(s.toBeat)} tone="g" />
            <Kpi label="Challengers" value={String(s.bought)} detail={`${s.dethroned} dethroned`} />
            <Kpi label="Spent" value={money(s.cost)} />
            <Kpi label="Profit" value={money(s.profit)} tone={s.profit >= 0 ? 'g' : 'w'} />
            {running ? <Kpi label="In the pool" value={String(waiting.length)} tone="b" /> : null}
          </div>

          <div className="koth-admin">
            <KothThrone s={s} />

            <div style={{ minWidth: 0 }}>
              {s.playing ? (
                <div className="card" style={{ marginBottom: 14 }}>
                  <span className="eyebrow">Now playing</span>
                  <div className="slotcell" style={{ margin: '8px 0 14px' }}>
                    <SlotArt src={s.playing.imageUrl} name={s.playing.slotName} fallbackClassName="ph" />
                    <span>
                      <b style={{ fontSize: 16 }}>{s.playing.slotName}</b>
                      <small>
                        {s.playing.provider ? `${s.playing.provider} · ` : ''}for {s.playing.kickUsername}
                      </small>
                    </span>
                  </div>
                  <ChallengeResultForm key={s.playing.id} turnId={s.playing.id} />
                  <p className="small muted">
                    {s.toBeat == null
                      ? 'The hill is empty: this buy takes it, whatever it pays.'
                      : `Takes the hill if it beats ${mult(s.toBeat)}. A tie leaves the king.`}
                  </p>
                </div>
              ) : null}

              {running ? (
                <>
                  <h2 style={{ fontSize: 15, marginBottom: 10 }}>
                    The pool <span className="muted small">({waiting.length} waiting)</span>
                  </h2>
                  {roundSize < waiting.length ? (
                    <p className="small muted" style={{ marginBottom: 10 }}>
                      The next draw is between the <b>{roundSize}</b> who have had the fewest goes; the rest
                      are back in once everyone has had one.
                    </p>
                  ) : null}
                  {waiting.length === 0 ? (
                    <div className="emptyq">{game.requestsOpen ? 'Nobody has typed !sr yet.' : 'Empty.'}</div>
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
                        <DismissKothEntryButton entryId={e.id} />
                      </div>
                    ))
                  )}
                </>
              ) : null}
            </div>
          </div>

          <div className="sec" style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>
              Challengers <span className="muted small">({turns.length})</span>
            </h2>
            {turns.length === 0 ? (
              <div className="emptyq">No challengers yet.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Viewer · slot</th>
                      <th>Cost</th>
                      <th>Paid</th>
                      <th>Multi</th>
                      <th>Result</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turns
                      .map((t, i) => [t, i + 1] as const)
                      .reverse()
                      .map(([t, n]) => {
                        const x = score(t);
                        return (
                          <tr key={t.id}>
                            <td className="n" style={{ color: 'var(--muted)' }}>{n}</td>
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
                            <td className="n">{x == null ? '—' : mult(x)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <TurnTag turn={t} crowned={s.crowned.has(t.id)} tied={s.tied.has(t.id)} king={s.king?.id === t.id} />
                              {t.paid ? <span className="tag gold" style={{ marginLeft: 6 }}>paid {coins(t.paid)} MC</span> : null}
                            </td>
                            <td className="n" style={{ color: 'var(--muted)' }}>{dateTime(t.drawnAt)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="small muted" style={{ marginTop: 10, maxWidth: '72ch' }}>
              Only the king when the game ends is paid, and only with a verified Kick link; until then a
              mistyped result can be undone. Anyone who has played — the king too — can !sr again, and goes
              back in once everyone waiting has had a go.
            </p>
          </div>
        </>
      )}
    </>
  );
}

function TurnTag({
  turn,
  crowned,
  tied,
  king,
}: {
  turn: { status: string };
  crowned: boolean;
  tied: boolean;
  king: boolean;
}) {
  if (turn.status === 'playing') return <span className="tag blue">In play</span>;
  if (turn.status === 'skipped') return <span className="tag">Skipped</span>;
  if (king) return <span className="tag gold">♛ King</span>;
  if (crowned) return <span className="tag green">Took the hill</span>;
  if (tied) return <span className="tag">Tied — king holds</span>;
  return <span className="tag">Fell short</span>;
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
  ['Everything', '', '520 × 760'],
  ['The hill', '?panel=hill', '520 × 420'],
  ['Now playing', '?panel=now', '460 × 150'],
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
        first game.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OVERLAYS.map(([label, query, size]) => {
          const url = `${origin}/overlay/koth${query}`;
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
