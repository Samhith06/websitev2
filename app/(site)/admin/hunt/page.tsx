import Link from 'next/link';
import { SlotArt } from '@/components/site/SlotArt';
import { headers } from 'next/headers';
import { CopyButton } from '@/components/ui/CopyButton';
import {
  bonusesFor,
  featuredHunt,
  guessesFor,
  huntStats,
  requestsFor,
} from '@/lib/store/hunts';
import { coins, dateTime, money, mult } from '@/lib/format';
import {
  AddBonusForm,
  HuntSettings,
  HuntSwitches,
  PayoutInput,
  RemoveBonusButton,
  RequestActions,
  StartHuntForm,
} from '@/components/admin/HuntControls';

export const metadata = { title: 'Bonus hunt' };
export const dynamic = 'force-dynamic';

const STATUS_LABEL = { collecting: 'Collecting', opening: 'Opening', finished: 'Finished' } as const;
const GTB_LABEL = {
  closed: 'Guessing not open',
  open: 'Guessing open',
  locked: 'Guessing locked',
  settled: 'Guesses settled',
} as const;

export default async function AdminHuntPage() {
  const origin = await siteOrigin();
  const hunt = await featuredHunt();
  const [bonuses, requests, guesses] = hunt
    ? await Promise.all([bonusesFor(hunt.id), requestsFor(hunt.id, 'pending'), guessesFor(hunt.id)])
    : [[], [], []];
  const stats = hunt ? huntStats(hunt, bonuses) : null;

  // Once finished, guesses read closest-first against the real total; before
  // that, in the order they arrived.
  const total = hunt?.finalBalance ?? stats?.won ?? 0;
  const ordered =
    hunt?.status === 'finished'
      ? [...guesses].sort((a, b) => Math.abs(a.guess - total) - Math.abs(b.guess - total))
      : guesses;

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Stream tools</span>
          <h1>Bonus hunt</h1>
          <div className="sh-sub">
            Chat suggests with <b>!sr &lt;slot&gt;</b> and guesses with <b>!gtb &lt;amount&gt;</b>. The
            public page is <Link href="/hunt">/hunt</Link>; slots come from the{' '}
            <Link href="/admin/slots">catalog</Link>.
          </div>
        </div>
      </div>

      {!hunt || (hunt.status === 'finished' && (hunt.gtbStatus === 'closed' || hunt.gtbStatus === 'settled')) ? (
        <StartHuntForm />
      ) : null}

      <OverlayLinks origin={origin} />

      {!hunt ? (
        <div className="emptyq">No hunt yet.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span className={`tag ${hunt.status === 'finished' ? '' : 'blue'}`}>
                {STATUS_LABEL[hunt.status]}
              </span>
              <span className="tag">{GTB_LABEL[hunt.gtbStatus]}</span>
              {hunt.status === 'collecting' ? (
                <span className="tag">{hunt.requestsOpen ? '!sr open' : '!sr closed'}</span>
              ) : null}
              {hunt.gtbPrize ? <span className="tag gold">{coins(hunt.gtbPrize)} MC prize</span> : null}
            </div>

            {hunt.settledAt ? null : (
              <div style={{ marginBottom: 14 }}>
                <HuntSettings huntId={hunt.id} title={hunt.title} startCost={hunt.startCost} />
              </div>
            )}

            <HuntSwitches
              huntId={hunt.id}
              status={hunt.status}
              requestsOpen={hunt.requestsOpen}
              gtbStatus={hunt.gtbStatus}
              gtbPrize={hunt.gtbPrize}
              unopened={stats!.bonuses - stats!.opened}
            />

            {hunt.gtbStatus === 'settled' ? (
              <p className="small" style={{ marginTop: 12 }}>
                Final balance <b>{money(hunt.finalBalance ?? 0)}</b> ·{' '}
                {hunt.gtbWinner ? (
                  <>
                    winner <b>{hunt.gtbWinner.name}</b>
                    {hunt.gtbPrize ? `, paid ${coins(hunt.gtbPrize)} MC` : ''}
                  </>
                ) : (
                  'no linked account guessed'
                )}
              </p>
            ) : null}
          </div>

          <div className="kpis">
            <Kpi label="Start" value={money(hunt.startCost)} />
            <Kpi label="Bonuses" value={`${stats!.opened}/${stats!.bonuses}`} detail={`${money(stats!.totalBet)} in bets`} />
            <Kpi label="Won" value={money(stats!.won)} tone="g" />
            <Kpi
              label="Profit"
              value={money(stats!.profit)}
              tone={stats!.profit >= 0 ? 'g' : 'w'}
            />
            <Kpi label="Average" value={stats!.averageX == null ? '—' : mult(stats!.averageX)} />
            <Kpi label="Break-even" value={stats!.breakEvenX == null ? '—' : mult(stats!.breakEvenX)} detail="needed per $ left" />
          </div>

          {hunt.status !== 'finished' ? <AddBonusForm huntId={hunt.id} /> : null}

          <div className="sec">
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>Bonuses</h2>
            {bonuses.length === 0 ? (
              <div className="emptyq">No bonuses yet. Add them above, or from chat requests below.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Slot</th>
                      <th>Bet</th>
                      <th>Payout</th>
                      <th>Multi</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map((b, i) => (
                      <tr key={b.id}>
                        <td className="n" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                        <td>
                          <div className="slotcell">
                            <SlotArt src={b.imageUrl} name={b.slotName} fallbackClassName="ph" />
                            <span>
                              <b>{b.slotName}</b>
                              <small>
                                {b.provider || '—'}
                                {b.requestedBy ? ` · !sr ${b.requestedBy}` : ''}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td className="n">{money(b.bet)}</td>
                        <td className="n">
                          {hunt.status === 'opening' ? (
                            <PayoutInput bonusId={b.id} payout={b.payout} />
                          ) : b.payout == null ? (
                            '—'
                          ) : (
                            money(b.payout)
                          )}
                        </td>
                        <td className="n">{b.payout == null ? '—' : mult(b.payout / b.bet)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {hunt.status === 'collecting' ? <RemoveBonusButton bonusId={b.id} /> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {hunt.status === 'collecting' ? (
            <div className="sec" style={{ marginTop: 26 }}>
              <h2 style={{ fontSize: 15, marginBottom: 12 }}>
                Chat requests <span className="muted small">({requests.length} waiting)</span>
              </h2>
              {requests.length === 0 ? (
                <div className="emptyq">
                  {hunt.requestsOpen ? 'Nobody has typed !sr yet.' : '!sr is closed.'}
                </div>
              ) : (
                requests.map((r) => (
                  <div className="qrow" key={r.id}>
                    <div className="slotcell">
                      <SlotArt src={r.imageUrl} name={r.slotName ?? r.query} fallbackClassName="ph" />
                      <span>
                        <b>{r.slotName ?? r.query}</b>
                        <small>
                          {r.slotName ? `${r.provider || '—'} · ` : 'not in catalog · '}
                          {r.kickUsername} typed “{r.query}” · {dateTime(r.createdAt)}
                        </small>
                      </span>
                    </div>
                    <RequestActions huntId={hunt.id} requestId={r.id} />
                  </div>
                ))
              )}
            </div>
          ) : null}

          <div className="sec" style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>
              Guesses <span className="muted small">({guesses.length})</span>
            </h2>
            {guesses.length === 0 ? (
              <div className="emptyq">No guesses.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Chatter</th>
                      <th>Guess</th>
                      {hunt.status === 'finished' ? <th>Off by</th> : null}
                      <th>Linked</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordered.map((g) => (
                      <tr key={g.kickUserId}>
                        <td>
                          {g.kickUsername}
                          {hunt.gtbWinner?.kickUserId === g.kickUserId ? (
                            <span className="tag gold" style={{ marginLeft: 8 }}>Winner</span>
                          ) : null}
                        </td>
                        <td className="n">{money(g.guess)}</td>
                        {hunt.status === 'finished' ? (
                          <td className="n">{money(Math.abs(g.guess - total))}</td>
                        ) : null}
                        <td className="n" style={{ color: g.linked ? 'var(--green)' : 'var(--muted)' }}>
                          {g.linked ? 'yes' : 'no'}
                        </td>
                        <td className="n" style={{ color: 'var(--muted)' }}>{dateTime(g.guessedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="small muted" style={{ marginTop: 10, maxWidth: '72ch' }}>
              Only chatters with a verified Kick link can be paid, so the prize goes to the closest
              linked guess. A tie goes to whoever guessed first.
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
  ['Everything', '', '420 × 1080'],
  ['Stats strip', '?panel=stats', '1200 × 90, or 420 × 170'],
  ['Now opening', '?panel=now', '460 × 150'],
  ['Bonus list', '?panel=bonuses&rows=10', '420 × 560'],
  ['Guess the balance', '?panel=gtb', '420 × 130'],
];

/**
 * The URLs to paste into OBS. Collapsed, because it is set-up-once
 * information on a screen that is otherwise used live.
 */
function OverlayLinks({ origin }: { origin: string }) {
  return (
    <details className="card" style={{ marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>OBS overlays</summary>
      <p className="small muted" style={{ margin: '10px 0 12px' }}>
        Add each as a <b>Browser</b> source in OBS at the size shown (it can be resized after). The
        background is transparent, it updates itself every few seconds, and it shows nothing
        between hunts.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OVERLAYS.map(([label, query, size]) => {
          const url = `${origin}/overlay/hunt${query}`;
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

function Kpi({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'g' | 'b' | 'w';
}) {
  return (
    <div className="kpi">
      <div className="kl">{label}</div>
      <div className={`kv ${tone ?? ''}`}>{value}</div>
      {detail ? <div className="kd">{detail}</div> : null}
    </div>
  );
}
