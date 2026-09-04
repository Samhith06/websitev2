import Link from 'next/link';
import { currentStream } from '@/lib/store/stream';
import { currentPeriod, potOf, prizeForRank } from '@/lib/store/periods';
import { fetchRazedLeaderboard, toBoardRows } from '@/lib/razed';
import { publishedClips } from '@/lib/store/clips';
import { coinFlow } from '@/lib/store/coins';
import { listTiers, nextTier, progressTo } from '@/lib/store/milestones';
import { wagerStateFor } from '@/lib/store/wager';
import { currentUser } from '@/lib/player';
import { razed, socials, portraitUrl, aboutCopy } from '@/lib/mock';
import { clipLength, coins, money, relativeTime } from '@/lib/format';
import { StreamStage } from '@/components/site/StreamStage';
import { CopyCode } from '@/components/ui/CopyCode';

/** Live status, the board and the clip strip all move, so nothing is cached. */
export const dynamic = 'force-dynamic';

const PLATFORM_MARKS: Record<string, string> = {
  Kick: 'K',
  Discord: 'D',
  Twitch: 'T',
  Instagram: 'IG',
  YouTube: 'YT',
  X: 'X',
  TikTok: 'TT',
};

export default async function HomePage() {
  const user = await currentUser();

  const [stream, period, clips, flow, tiers, wager] = await Promise.all([
    currentStream(),
    currentPeriod('monthly'),
    publishedClips(4),
    coinFlow(new Date(0)),
    listTiers(),
    wagerStateFor(user?.id ?? null),
  ]);

  // The board comes straight from Razed on every request. The key never
  // reaches the browser and the browser never talks to Razed.
  const feed = period
    ? await fetchRazedLeaderboard({
        from: period.startsAt.slice(0, 10),
        to: period.endsAt.slice(0, 10),
        top: 5,
      })
    : null;
  const board =
    feed?.ok ? toBoardRows(feed.rows, (rank) => prizeForRank(period!.tiers, rank)).slice(0, 5) : [];

  const pot = period ? potOf(period.tiers) : 0;
  const top = board[0] ?? null;

  const next = wager.lifetime == null ? null : nextTier(tiers, wager.lifetime);
  const pct = wager.lifetime == null ? 0 : progressTo(tiers, wager.lifetime);

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero: the stream, and the two things people check alongside it     */}
      {/* ---------------------------------------------------------------- */}
      <div className="hero">
        <StreamStage stream={stream} />

        <div className="herorail">
          <div className="railcard">
            <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Top wagerers
              <Link href="/leaderboard" className="eyebrow">
                This month →
              </Link>
            </h3>
            {board.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                {period
                  ? 'The board could not be read from Razed just now. It will fill in on the next sync.'
                  : 'No leaderboard period is open yet.'}
              </p>
            ) : (
              board.map((row, i) => (
                <div className="mini-row" key={row.rank}>
                  <div className={`rank ${i < 3 ? `r${i + 1}` : ''}`}>{i + 1}</div>
                  <div className="nm">{row.maskedUsername}</div>
                  <div className="vl">{money(row.wagered)}</div>
                </div>
              ))
            )}
          </div>

          <div className="railcard">
            <h3>Next milestone</h3>
            {!user ? (
              <>
                <div className="small muted">
                  Sign in to track your progress toward the wager milestones.
                </div>
                <Link
                  className="btn pri sm wide discord"
                  style={{ marginTop: 11 }}
                  href="/api/auth/signin?callbackUrl=/milestones"
                >
                  Sign in with Discord
                </Link>
              </>
            ) : wager.lifetime == null ? (
              <>
                <div className="small muted">
                  {wager.link
                    ? 'Your Razed username is waiting on the next sync before progress can be shown.'
                    : 'Link your Razed username to track the milestone ladder.'}
                </div>
                <Link className="btn sm wide" style={{ marginTop: 11 }} href="/profile">
                  Go to profile
                </Link>
              </>
            ) : next ? (
              <>
                <div className="small muted">Wagered under the code</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                  {money(wager.lifetime)}
                </div>
                <div className="railbar">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <div className="small muted" style={{ marginTop: 9 }}>
                  {money(next.threshold - wager.lifetime)} to go for{' '}
                  <b style={{ color: 'var(--gold)' }}>{money(next.reward)}</b>
                </div>
                <Link className="btn sm wide" style={{ marginTop: 11 }} href="/milestones">
                  View ladder
                </Link>
              </>
            ) : (
              <>
                <div className="small muted">Every tier unlocked.</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                  {money(wager.lifetime)}
                </div>
                <Link className="btn sm wide" style={{ marginTop: 11 }} href="/milestones">
                  View ladder
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Four figures, all of them real                                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="stats">
        <div className="stat">
          <div className="sl">Prize pool this month</div>
          <div className="sv g">{pot ? money(pot) : '—'}</div>
          <div className="sm">Paid out by Razed</div>
        </div>
        <div className="stat">
          <div className="sl">Top wagerer</div>
          <div className="sv">{top ? top.maskedUsername : '—'}</div>
          <div className="sm">{top ? `${money(top.wagered)} wagered` : 'No board yet'}</div>
        </div>
        <div className="stat">
          <div className="sl">Coins earned by chat</div>
          <div className="sv b">{coins(flow.minted)}</div>
          <div className="sm">All time</div>
        </div>
        <div className="stat">
          <div className="sl">Clips published</div>
          <div className="sv">{clips.length ? coins(clips.length) : '—'}</div>
          <div className="sm">
            <Link href="/community">Clips &amp; wall of fame →</Link>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* The partner band — the commercial heart of the site               */}
      {/* ---------------------------------------------------------------- */}
      <div className="razed">
        <div className="razed-in">
          <div>
            <span className="tag blue">Official partner</span>
            <h2>Play under the code, get paid every month</h2>
            <p>
              Sign up on Razed using the code below and every dollar you wager counts toward the
              monthly leaderboard, the lifetime milestone ladder and your badges. Rewards are tipped
              straight to your Razed account.
            </p>
            <div className="perks">
              <div className="perk">
                <span style={{ color: 'var(--blue)' }}>◆</span> <b>200%</b> welcome bonus
              </div>
              <div className="perk">
                <span style={{ color: 'var(--blue)' }}>◆</span>{' '}
                <b>{pot ? money(pot) : '$5,000'}</b> monthly leaderboard
              </div>
              <div className="perk">
                <span style={{ color: 'var(--blue)' }}>◆</span> <b>Weekly</b> rakeback
              </div>
            </div>
          </div>
          <div>
            <CopyCode code={razed.referralCode} />
            <a
              className="btn gold wide"
              style={{ marginTop: 10 }}
              href={razed.affiliateUrl}
              target="_blank"
              rel="noreferrer noopener sponsored"
            >
              Join Razed →
            </a>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Clips                                                             */}
      {/* ---------------------------------------------------------------- */}
      {clips.length > 0 ? (
        <div className="sec">
          <div className="sec-head">
            <div>
              <span className="eyebrow">Latest</span>
              <h2>Recent clips</h2>
            </div>
            <Link className="btn sm ghost" href="/community">
              See all
            </Link>
          </div>
          <div className="clips">
            {clips.map((clip) => (
              <a
                className="clip"
                key={clip.id}
                href={clip.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <div className="thumb">
                  {clip.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clip.thumbUrl} alt="" loading="lazy" />
                  ) : null}
                  <div className="pl" aria-hidden>
                    ▶
                  </div>
                  <span className="dur">{clipLength(clip.durationSeconds)}</span>
                </div>
                <div className="ci">
                  <div className="ct">{clip.title}</div>
                  <div className="cm">
                    {clip.source} · {relativeTime(clip.occurredAt)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Who is Matty                                                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="sec">
        <div className="sec-head">
          <div>
            <span className="eyebrow">About</span>
            <h2>Who is Matty?</h2>
          </div>
        </div>
        <div className="about">
          <div className="portrait">
            {portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portraitUrl} alt="Matty" />
            ) : (
              <div className="ph">PHOTO OF MATTY</div>
            )}
          </div>
          <div>
            {aboutCopy.map((para: string, i: number) => (
              <p
                key={i}
                className={i === 0 ? undefined : 'muted'}
                style={
                  i === 0
                    ? { fontSize: 16, lineHeight: 1.7, margin: '0 0 14px' }
                    : { margin: '0 0 20px' }
                }
              >
                {para}
              </p>
            ))}
            <div className="socials">
              {socials.map((s) => (
                <a
                  className="soc"
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <div className="ic">{PLATFORM_MARKS[s.platform] ?? s.platform.slice(0, 2)}</div>
                  <div>
                    <div className="sn">{s.platform}</div>
                    <div className="sh">{s.handle}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
