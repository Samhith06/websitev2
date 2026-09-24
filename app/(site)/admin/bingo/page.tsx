import Link from 'next/link';
import { headers } from 'next/headers';
import { CopyButton } from '@/components/ui/CopyButton';
import { SlotArt } from '@/components/site/SlotArt';
import { BingoGrid } from '@/components/site/BingoGrid';
import { cellLabel, completedLines, lineLabel } from '@/lib/bingo';
import { entriesFor, featuredCard, summarise, turnsFor } from '@/lib/store/bingo';
import { coins, dateTime, money, mult } from '@/lib/format';
import {
  BingoSwitches,
  DismissEntryButton,
  StartBingoForm,
  TurnResultForm,
} from '@/components/admin/BingoControls';

export const metadata = { title: 'Slot bingo' };
export const dynamic = 'force-dynamic';

const TURN_LABEL = { playing: 'In play', won: 'Green', lost: 'No profit', skipped: 'Skipped' } as const;

export default async function AdminBingoPage() {
  const origin = await siteOrigin();
  const card = await featuredCard();
  const [turns, waiting] = card ? await Promise.all([turnsFor(card.id), entriesFor(card.id, 'waiting')]) : [[], []];
  const s = summarise(turns);
  const lines = card ? completedLines(card.size, s.green.keys()) : [];
  const running = card?.status === 'running';
  const last = turns[turns.length - 1];
  const paidTurns = [...s.green.values()].filter((t) => t.paid > 0);
  const unpaidTurns = [...s.green.values()].filter((t) => t.paid === 0);
  const lastResolved = [...turns].reverse().find((t) => t.status === 'won' || t.status === 'lost');

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Stream tools</span>
          <h1>Slot bingo</h1>
          <div className="sh-sub">
            Chat joins with <b>!sr &lt;slot&gt;</b> — while a bingo runs, !sr goes here instead of the{' '}
            <Link href="/admin/hunt">hunt</Link>. The public page is <Link href="/bingo">/bingo</Link>.
          </div>
        </div>
      </div>

      {!running ? <StartBingoForm /> : null}

      <OverlayLinks origin={origin} />

      {!card ? (
        <div className="emptyq">No bingo yet.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <b style={{ fontSize: 15, marginRight: 4 }}>{card.title}</b>
              <span className={`tag ${running ? 'blue' : ''}`}>
                {running ? 'Running' : card.result === 'bingo' ? 'Finished · BINGO' : 'Finished · stopped'}
              </span>
              <span className="tag">{card.size} × {card.size}</span>
              {running ? <span className="tag">{card.requestsOpen ? '!sr open' : '!sr closed'}</span> : null}
              {card.squarePrize ? <span className="tag gold">{coins(card.squarePrize)} MC per green square</span> : null}
            </div>

            {lines.length > 0 ? (
              <p className="bingo-banner">BINGO — {lines.map((l) => lineLabel(l, card.size)).join(' and ')}</p>
            ) : null}

            {lastResolved && lastResolved.payout != null && lastResolved.buyCost ? (
              <p className="small" style={{ marginBottom: 12 }}>
                Last result: <b>{lastResolved.kickUsername}</b> on {cellLabel(lastResolved.position, card.size)} —{' '}
                {money(lastResolved.payout)} from a {money(lastResolved.buyCost)} buy (
                {mult(lastResolved.payout / lastResolved.buyCost)}),{' '}
                {lastResolved.status === 'won' ? (
                  <b style={{ color: 'var(--green)' }}>square green</b>
                ) : (
                  <span className="muted">no profit, square stays open</span>
                )}
                .
              </p>
            ) : null}

            {!running && s.green.size > 0 ? (
              <p className="small" style={{ marginBottom: 0 }}>
                {paidTurns.length > 0 ? (
                  <>
                    Paid <b style={{ color: 'var(--gold)' }}>{coins(paidTurns.reduce((sum, t) => sum + t.paid, 0))} MC</b> to{' '}
                    {paidTurns.map((t) => t.kickUsername).join(', ')}.{' '}
                  </>
                ) : null}
                {unpaidTurns.length > 0 && card.squarePrize ? (
                  <span className="muted">Not linked, so not paid: {unpaidTurns.map((t) => t.kickUsername).join(', ')}.</span>
                ) : null}
              </p>
            ) : null}

            {running ? (
              <BingoSwitches
                cardId={card.id}
                requestsOpen={card.requestsOpen}
                waiting={waiting.length}
                inPlay={s.playing != null}
                bingo={lines.length > 0}
                canUndo={last != null && (last.status === 'won' || last.status === 'lost')}
              />
            ) : null}
          </div>

          <div className="kpis">
            <Kpi label="Green" value={`${s.green.size}/${card.size * card.size}`} tone="g" />
            <Kpi label="Buys" value={String(s.bought)} detail={`${money(s.cost)} spent`} />
            <Kpi label="Paid back" value={money(s.won)} tone="g" />
            <Kpi label="Profit" value={money(s.profit)} tone={s.profit >= 0 ? 'g' : 'w'} />
            {running ? <Kpi label="In the pool" value={String(waiting.length)} tone="b" /> : null}
          </div>

          <div className="bingo-admin">
            <BingoGrid
              size={card.size}
              green={s.green}
              playing={s.playing}
              onLine={new Set(lines.flatMap((l) => l.positions))}
            />

            <div style={{ minWidth: 0 }}>
              {s.playing ? (
                <div className="card" style={{ marginBottom: 14 }}>
                  <span className="eyebrow">Now playing · square {cellLabel(s.playing.position, card.size)}</span>
                  <div className="slotcell" style={{ margin: '8px 0 14px' }}>
                    <SlotArt src={s.playing.imageUrl} name={s.playing.slotName} fallbackClassName="ph" />
                    <span>
                      <b style={{ fontSize: 16 }}>{s.playing.slotName}</b>
                      <small>
                        {s.playing.provider ? `${s.playing.provider} · ` : ''}for {s.playing.kickUsername}
                      </small>
                    </span>
                  </div>
                  <TurnResultForm key={s.playing.id} turnId={s.playing.id} />
                  <p className="small muted">Green if it pays back more than the buy cost.</p>
                </div>
              ) : null}

              {running ? (
                <>
                  <h2 style={{ fontSize: 15, marginBottom: 10 }}>
                    The pool <span className="muted small">({waiting.length} waiting)</span>
                  </h2>
                  {waiting.length === 0 ? (
                    <div className="emptyq">{card.requestsOpen ? 'Nobody has typed !sr yet.' : 'Empty.'}</div>
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
                            </small>
                          </span>
                        </div>
                        <DismissEntryButton entryId={e.id} />
                      </div>
                    ))
                  )}
                </>
              ) : null}
            </div>
          </div>

          <div className="sec" style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>
              Draws <span className="muted small">({turns.length})</span>
            </h2>
            {turns.length === 0 ? (
              <div className="emptyq">No draws yet.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Sq</th>
                      <th>Viewer · slot</th>
                      <th>Cost</th>
                      <th>Paid</th>
                      <th>Multi</th>
                      <th>Result</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...turns].reverse().map((t) => (
                      <tr key={t.id}>
                        <td className="n" style={{ color: 'var(--muted)' }}>{cellLabel(t.position, card.size)}</td>
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
                        <td className="n">{t.payout == null || !t.buyCost ? '—' : mult(t.payout / t.buyCost)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className={`tag ${t.status === 'won' ? 'green' : t.status === 'playing' ? 'blue' : ''}`}>
                            {TURN_LABEL[t.status]}
                          </span>
                          {t.paid ? <span className="tag gold" style={{ marginLeft: 6 }}>paid {coins(t.paid)} MC</span> : null}
                        </td>
                        <td className="n" style={{ color: 'var(--muted)' }}>{dateTime(t.drawnAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="small muted" style={{ marginTop: 10, maxWidth: '72ch' }}>
              Prizes are paid when the bingo ends, to viewers with a verified Kick link; until then a mistyped
              result can be undone. A viewer who lost can !sr again; one who won a square is done for this card.
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
  ['Everything', '', '520 × 1000'],
  ['Card only', '?panel=card', '520 × 700, any card size'],
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
        first bingo.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OVERLAYS.map(([label, query, size]) => {
          const url = `${origin}/overlay/bingo${query}`;
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
