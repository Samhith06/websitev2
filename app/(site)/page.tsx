import Link from 'next/link';
import { currentStream } from '@/lib/store/stream';
import { currentPeriod, potOf, prizeForRank } from '@/lib/store/periods';
import { fetchRazedLeaderboard, toBoardRows } from '@/lib/razed';
import { publishedBigWins, publishedClips } from '@/lib/store/clips';
import { coinFlow } from '@/lib/store/coins';
import { listTiers, nextTier, progressTo } from '@/lib/store/milestones';
import { wagerStateFor } from '@/lib/store/wager';
import { currentUser } from '@/lib/player';
import { razed, socials, portraitUrl, aboutCopy, discordInvite } from '@/lib/mock';
import { coins, money } from '@/lib/format';
import { ClipCard } from '@/components/site/ClipCard';
import { FameRail } from '@/components/site/FameRail';
import { StreamHero } from '@/components/site/StreamHero';
import { CopyCode } from '@/components/ui/CopyCode';

/** Live status, the board and the clip strip all move, so nothing is cached. */
export const dynamic = 'force-dynamic';

/** Each platform's own colour behind its mark, the one place they appear. */
const PLATFORM_TILES: Record<string, { tile: string; icon: string }> = {
  Kick: { tile: '#53fc18', icon: '/brand/social/kick.svg' },
  Twitch: { tile: '#9146ff', icon: '/brand/social/twitch.svg' },
  YouTube: { tile: '#ff0000', icon: '/brand/social/youtube.svg' },
  Instagram: {
    tile: 'linear-gradient(45deg, #f58529, #dd2a7b 50%, #8134af)',
    icon: '/brand/social/instagram.svg',
  },
  X: { tile: '#000000', icon: '/brand/social/x.svg' },
  Telegram: { tile: '#26a5e4', icon: '/brand/social/telegram.svg' },
};

export default async function HomePage() {
  const user = await currentUser();

  const [stream, period, clips, wins, flow, tiers, wager] = await Promise.all([
    currentStream(),
    currentPeriod('monthly'),
    publishedClips(4),
    // Enough to fill the rail and keep it moving; the whole wall is a click
    // away on /community.
    publishedBigWins(12),
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

  const wagered = wager.milestone.wagered;
  const next = wagered == null ? null : nextTier(tiers, wagered);
  const pct = wagered == null ? 0 : progressTo(tiers, wagered);
  // The rung the progress bar starts from: the same one `progressTo` measures
  // against, so the labels under the bar describe the bar.
  const previous = next ? tiers.filter((t) => t.threshold < next.threshold).pop() : undefined;

  return (
    <div className="home">
      <div className="wrap">
        {/* ------------------------------------------------------------ */}
        {/* Hero: the stream's status, and the things people check beside it */}
        {/* ------------------------------------------------------------ */}
        <section className="h-hero">
          <StreamHero stream={stream} code={razed.referralCode} />

          <aside className="h-rail">
            <div className="h-block">
              <div className="h-boardhead">
                <h4>Top wagerers</h4>
                <Link href="/leaderboard">This month →</Link>
              </div>
              {board.length === 0 ? (
                <p>
                  {period
                    ? 'The board could not be read from Razed just now. It will fill in on the next sync.'
                    : 'No leaderboard period is open yet.'}
                </p>
              ) : (
                board.map((row, i) => (
                  <div className={i < 3 ? 'h-row top' : 'h-row'} key={row.rank}>
                    <span className="pos">{i + 1}</span>
                    <span className="who">{row.maskedUsername}</span>
                    <span className="amt">{money(row.wagered)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="h-block">
              <h4>Next milestone</h4>
              {!user ? (
                <>
                  <p>Sign in to track your progress toward the wager milestones.</p>
                  <Link
                    className="btn wide split"
                    href="/api/auth/signin?callbackUrl=/milestones"
                  >
                    Sign in with Discord<span aria-hidden>→</span>
                  </Link>
                </>
              ) : wagered == null ? (
                <>
                  <p>
                    {wager.link
                      ? 'Your Razed username is waiting on the next sync before progress can be shown.'
                      : 'Link your Razed username to track the milestone ladder.'}
                  </p>
                  <Link className="btn wide split" href="/profile">
                    Go to profile<span aria-hidden>→</span>
                  </Link>
                </>
              ) : next ? (
                <>
                  <div className="h-note">
                    {wager.milestone.mode === 'monthly'
                      ? 'Wagered this month'
                      : 'Wagered under the code'}
                  </div>
                  <div className="h-sum">{money(wagered)}</div>
                  <div className="h-bar">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <div className="h-barlabels">
                    <span>{previous ? `${previous.name} · ${money(previous.threshold)}` : money(0)}</span>
                    <span>
                      {next.name} · {money(next.threshold)}
                    </span>
                  </div>
                  <p className="h-togo">
                    {money(next.threshold - wagered)} to go for <b>{next.name}</b> ·{' '}
                    <b className="g">{money(next.reward)}</b>
                  </p>
                  <Link className="btn wide split" href="/milestones">
                    View ladder<span aria-hidden>→</span>
                  </Link>
                </>
              ) : (
                <>
                  <div className="h-note">Every tier unlocked.</div>
                  <div className="h-sum">{money(wagered)}</div>
                  <Link className="btn wide split" href="/milestones">
                    View ladder<span aria-hidden>→</span>
                  </Link>
                </>
              )}
            </div>

            {/* The invite lives in the rail rather than down beside the socials
                because it is the one call to action on this page that asks
                nothing of a visitor and is not a casino — someone who will never
                sign up under the code can still take it. It should not need the
                whole page scrolled to find. */}
            <div className="h-block">
              <h4>Discord</h4>
              <p>
                Giveaway pings, clip drops and the people you already recognise from chat. Free, and
                you do not need a Razed account to be in it.
              </p>
              <a
                className="btn pri wide split"
                href={discordInvite}
                target="_blank"
                rel="noreferrer noopener"
              >
                Join the server<span aria-hidden>→</span>
              </a>
            </div>
          </aside>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Four figures, all of them real                                */}
        {/* ------------------------------------------------------------ */}
        <section className="h-stats">
          <div className="h-stat">
            <div className="l">Prize pool this month</div>
            <div className="v g">{pot ? money(pot) : '—'}</div>
            <div className="m">Paid out by Razed</div>
          </div>
          <div className="h-stat">
            <div className="l">Top wagerer</div>
            <div className="v">{top ? top.maskedUsername : '—'}</div>
            <div className="m">{top ? `${money(top.wagered)} wagered` : 'No board yet'}</div>
          </div>
          <div className="h-stat">
            <div className="l">Coins earned by chat</div>
            <div className="v">{coins(flow.minted)}</div>
            <div className="m">All time</div>
          </div>
          <div className="h-stat">
            <div className="l">Clips published</div>
            <div className="v">{clips.length ? coins(clips.length) : '—'}</div>
            <div className="m">
              <Link href="/community">Clips &amp; wall of fame →</Link>
            </div>
          </div>
        </section>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* The partner band — the commercial heart of the site             */}
      {/* -------------------------------------------------------------- */}
      <section id="razed" className="h-razed">
        <div className="wrap h-razed-in">
          <div className="h-razed-copy">
            <div className="h-partner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/razed.png" alt="Razed" width={150} height={52} />
              <span>Official partner</span>
            </div>
            <h2>Play under the code, get paid every month</h2>
            <p>
              Sign up on Razed using the code below and every dollar you wager counts toward the
              monthly leaderboard, the monthly milestone ladder and your badges. Rewards are tipped
              straight to your Razed account.
            </p>
            <div className="h-perks">
              <div>
                <b>200%</b>
                welcome bonus
              </div>
              <div>
                <b className="g">{pot ? money(pot) : '$5,000'}</b>
                monthly leaderboard
              </div>
              <div>
                <b>Weekly</b>
                rakeback
              </div>
            </div>
          </div>
          <div className="h-code">
            <div className="l">Referral code</div>
            <CopyCode code={razed.referralCode} />
            <a
              className="h-join"
              href={razed.affiliateUrl}
              target="_blank"
              rel="noreferrer noopener sponsored"
            >
              Join Razed<span aria-hidden>→</span>
            </a>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* Wall of fame                                                    */}
      {/* -------------------------------------------------------------- */}
      {/* Above the recent clips on purpose: the big wins are the best thing
          on the site and used to be reachable only from a tab on /community,
          which is two clicks past the page most people ever see. */}
      {wins.length > 0 ? (
        <>
          <section className="wrap h-sec">
            <div className="sec-head">
              <div>
                <span className="eyebrow">Wall of fame</span>
                <h2>Biggest wins</h2>
              </div>
              <Link className="btn ghost" href="/community?view=fame">
                See the wall →
              </Link>
            </div>
          </section>
          <div className="h-fame">
            <FameRail wins={wins} />
          </div>
        </>
      ) : null}

      {/* -------------------------------------------------------------- */}
      {/* Clips                                                           */}
      {/* -------------------------------------------------------------- */}
      {clips.length > 0 ? (
        <section className="wrap h-sec">
          <div className="sec-head">
            <div>
              <span className="eyebrow">Latest</span>
              <h2>Recent clips</h2>
            </div>
            <Link className="btn ghost" href="/community">
              See all →
            </Link>
          </div>
          <div className="clips">
            {clips.map((clip) => (
              <ClipCard clip={clip} key={clip.id} />
            ))}
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------------- */}
      {/* Who is Matty                                                    */}
      {/* -------------------------------------------------------------- */}
      <section className="wrap h-sec" style={{ paddingBottom: 64 }}>
        <div className="sec-head">
          <div>
            <span className="eyebrow">About</span>
            <h2>Who is Matty?</h2>
          </div>
        </div>
        <div className="h-about">
          <div className="h-portrait">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portraitUrl} alt="Matty" />
            </div>
          </div>
          <div className="h-bio">
            {aboutCopy.map((para: string, i: number) => (
              <p key={i} className={i === 0 ? 'lead' : undefined}>
                {para}
              </p>
            ))}
            <div className="h-socials">
              {socials.map((s) => {
                const mark = PLATFORM_TILES[s.platform];
                return (
                  <a key={s.platform} href={s.url} target="_blank" rel="noreferrer noopener">
                    <span className="tile" style={mark ? { background: mark.tile } : undefined}>
                      {mark ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mark.icon} alt="" width={22} height={22} />
                      ) : (
                        s.platform.slice(0, 2)
                      )}
                    </span>
                    <span className="txt">
                      <b>{s.platform}</b>
                      <small>{s.handle}</small>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
