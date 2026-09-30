import Link from 'next/link';
import { headers } from 'next/headers';
import { CopyButton } from '@/components/ui/CopyButton';
import { SlotArt } from '@/components/site/SlotArt';
import { BossCard, RaidDamageBoard } from '@/components/site/BossCard';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { damageOf, hp } from '@/lib/raid';
import { featuredRaid, raidEntriesFor, raidTurnsFor, summariseRaid } from '@/lib/store/raid';
import { coins, dateTime, money } from '@/lib/format';
import {
  DeleteRaidButton,
  DismissRaidEntryButton,
  RaidResultForm,
  RaidSwitches,
  StartRaidForm,
} from '@/components/admin/RaidControls';

export const metadata = { title: 'Boss raid' };
export const dynamic = 'force-dynamic';

export default async function AdminRaidPage() {
  const origin = await siteOrigin();
  const raid = await featuredRaid();
  const [turns, waiting] = raid
    ? await Promise.all([raidTurnsFor(raid.id), raidEntriesFor(raid.id, 'waiting')])
    : [[], []];
  const s = raid ? summariseRaid(raid, turns) : null;
  const running = raid?.status === 'running';
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
          <h1>Boss raid</h1>
          <div className="sh-sub">
            Chat joins with <b>!sr &lt;slot&gt;</b> — while a raid runs, !sr goes here instead of the{' '}
            <Link href="/admin/hunt">hunt</Link>. It can&apos;t run alongside a{' '}
            <Link href="/admin/bingo">slot bingo</Link> or <Link href="/admin/koth">king of the hill</Link>. The
            public page is <Link href="/raid">/raid</Link>.
          </div>
        </div>
      </div>

      {!running ? <StartRaidForm /> : null}

      <OverlayLinks origin={origin} />

      {!raid || !s ? (
        <div className="emptyq">No boss raid yet.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <b style={{ fontSize: 15, marginRight: 4 }}>{raid.boss}</b>
              <span className={`tag ${running ? 'blue' : ''}`}>
                {running ? (s.slain ? 'Running · slain' : 'Running') : raid.result === 'slain' ? 'Finished · slain' : 'Finished · stopped'}
              </span>
              <span className="tag">{hp(s.maxHp)} HP</span>
              {running ? <span className="tag">{raid.requestsOpen ? '!sr open' : '!sr closed'}</span> : null}
              {raid.prize ? <span className="tag gold">{coins(raid.prize)} MC for the killing blow</span> : null}
            </div>

            {running && s.slain && s.killer ? (
              <p className="bingo-banner">
                SLAIN — {s.killer.kickUsername} landed the killing blow. End the raid to pay out.
              </p>
            ) : null}

            {!running ? (
              <p className="small" style={{ marginBottom: 0 }}>
                {!s.killer ? (
                  <span className="muted">Ended with the boss on {hp(s.hpLeft)} HP, so nobody was paid.</span>
                ) : s.killer.paid ? (
                  <>
                    Paid <b style={{ color: 'var(--gold)' }}>{coins(s.killer.paid)} MC</b> to {s.killer.kickUsername}.
                  </>
                ) : raid.prize ? (
                  <span className="muted">{s.killer.kickUsername}&apos;s Kick account wasn&apos;t linked, so nothing was paid.</span>
                ) : null}
              </p>
            ) : (
              <RaidSwitches
                gameId={raid.id}
                requestsOpen={raid.requestsOpen}
                waiting={waiting.length}
                inPlay={s.playing != null}
                slain={s.slain}
                canUndo={last != null && last.status === 'played'}
              />
            )}

            {/* A raid that paid its killing blow is the record of that payment,
                so it has no delete button (the store refuses it too). */}
            {s.killer?.paid ? null : (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--edge)' }}>
                <DeleteRaidButton gameId={raid.id} boss={raid.boss} />
              </div>
            )}
          </div>

          <div className="kpis">
            <Kpi label="HP left" value={hp(s.hpLeft)} detail={`of ${hp(s.maxHp)}`} tone={s.slain ? 'g' : 'w'} />
            <Kpi label="Hits" value={String(s.bought)} detail={`${hp(s.dealt)} damage`} />
            <Kpi label="Spent" value={money(s.cost)} />
            <Kpi label="Profit" value={money(s.profit)} tone={s.profit >= 0 ? 'g' : 'w'} />
            {running ? <Kpi label="In the pool" value={String(waiting.length)} tone="b" /> : null}
          </div>

          <div className="raid-admin">
            <div style={{ minWidth: 0 }}>
              <BossCard raid={raid} s={s} />
              {s.raiders.length > 0 ? (
                <div className="card" style={{ marginTop: 14 }}>
                  <h3 style={{ fontSize: 15, marginBottom: 8 }}>Damage dealt</h3>
                  <RaidDamageBoard s={s} />
                </div>
              ) : null}
            </div>

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
                  <RaidResultForm key={s.playing.id} turnId={s.playing.id} />
                  <p className="small muted">
                    The hit deals its multiplier. A {hp(s.hpLeft)}× or better is the killing blow.
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
                    <div className="emptyq">{raid.requestsOpen ? 'Nobody has typed !sr yet.' : 'Empty.'}</div>
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
                        <DismissRaidEntryButton entryId={e.id} />
                      </div>
                    ))
                  )}
                </>
              ) : null}
            </div>
          </div>

          <div className="sec" style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>
              Hits <span className="muted small">({turns.length})</span>
            </h2>
            {turns.length === 0 ? (
              <div className="emptyq">No hits yet.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Viewer · slot</th>
                      <th>Cost</th>
                      <th>Paid</th>
                      <th>Damage</th>
                      <th>Result</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turns
                      .map((t, i) => [t, i + 1] as const)
                      .reverse()
                      .map(([t, n]) => {
                        const d = damageOf(t);
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
                            <td className="n">{d == null ? '—' : hp(d)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {t.status === 'playing' ? (
                                <span className="tag blue">In play</span>
                              ) : t.status === 'skipped' ? (
                                <span className="tag">Skipped</span>
                              ) : s.killer?.id === t.id ? (
                                <span className="tag gold">Killing blow</span>
                              ) : d ? (
                                <span className="tag">Hit</span>
                              ) : (
                                <span className="tag">Miss</span>
                              )}
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
              Only the killing blow is paid, when the raid ends and only with a verified Kick link; until then a
              mistyped result can be undone — even the killing blow, which stands the boss back up. Anyone who
              has played can !sr again, and goes back in once everyone waiting has had a go.
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
  ['Everything', '', '520 × 720'],
  ['The boss', '?panel=boss', '520 × 330'],
  ['Now playing', '?panel=now', '460 × 150'],
  ['Damage board', '?panel=board', '420 × 320'],
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
        first raid.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OVERLAYS.map(([label, query, size]) => {
          const url = `${origin}/overlay/raid${query}`;
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
