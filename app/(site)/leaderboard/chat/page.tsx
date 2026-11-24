import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Coins, Crown, MessageSquare, Users, X } from 'lucide-react';
import { CHAT_MIN_POINTS, CHAT_POOL, CHAT_PRIZES, CHAT_RULES } from '@/lib/chat-score';
import { coins } from '@/lib/format';
import { offlineStream } from '@/lib/mock';
import { currentUser } from '@/lib/player';
import { kickLinkFor } from '@/lib/store/accounts';
import {
  chatBoard,
  chatStandingFor,
  chatWeekTotals,
  currentChatWeek,
  pastChatWeeks,
  settleFinishedChatWeeks,
  weekLabel,
  type ChatRow,
  type ChatStanding,
} from '@/lib/store/chat-board';
import { currentStream } from '@/lib/store/stream';
import { Countdown } from '@/components/ui/Countdown';
import { LeaderboardTabs } from '@/components/site/LeaderboardTabs';

export const metadata: Metadata = {
  title: 'Chat leaderboard',
  description: `The weekly MattySpins chat race: chat during the stream on Kick and the top ten split ${coins(CHAT_POOL)} Matty Coins every week.`,
};

export const dynamic = 'force-dynamic';

const kickUrl = `https://kick.com/${offlineStream.channel}`;

export default async function ChatLeaderboardPage() {
  // The scheduled tick pays a finished week, but the first visit after Monday
  // does too, so winners are never waiting on a quiet scheduler. Paying twice
  // is impossible: the week row is claimed inside the payout.
  await settleFinishedChatWeeks().catch((error) => console.error('[chat-board] payout failed', error));

  const week = await currentChatWeek();
  const [board, totals, history, stream, user] = await Promise.all([
    chatBoard(week.weekStart, 50),
    chatWeekTotals(week.weekStart),
    pastChatWeeks(6),
    currentStream(),
    currentUser().catch(() => null),
  ]);
  const link = user ? await kickLinkFor(user.id) : null;
  const standing = user && link ? await chatStandingFor(user.id, week.weekStart) : null;

  const startsMs = new Date(week.startsAt).getTime();
  const endsMs = new Date(week.endsAt).getTime();
  const elapsedPct = Math.min(100, Math.max(0, ((Date.now() - startsMs) / (endsMs - startsMs)) * 100));
  const day = Math.min(7, Math.floor((Date.now() - startsMs) / 86_400_000) + 1);

  return (
    <div className="lbx">
      <LeaderboardTabs on="chat" />

      <section className="lb-hero">
        <div className="lb-copy">
          <h1>Weekly chat race · week of {weekLabel(week.weekStart)}</h1>
          <div className="lb-pot">{coins(CHAT_POOL)} MC</div>
          <p className="lb-blurb">
            Chat in Matty&apos;s Kick stream with your linked account and every real message is a point. The top ten
            at the end of the week split {coins(CHAT_POOL)} Matty Coins, paid straight into their balance. Spam
            doesn&apos;t count.
          </p>

          <div className="lb-clockhead">
            <span>Week ends in</span>
            <span>Day {day} of 7</span>
          </div>
          <Countdown to={week.endsAt} />
          <div className="lb-bar">
            <i style={{ width: `${elapsedPct}%` }} />
          </div>

          <a className="btn pri" href={kickUrl} target="_blank" rel="noreferrer noopener">
            {stream.live ? 'Chat on Kick now' : 'Follow on Kick'}
            <ArrowRight size={18} aria-hidden />
          </a>
        </div>

        {board.length === 0 ? (
          <div className="emptyq lb-empty">
            Nobody has scored yet this week. Points start with the first chat message while Matty is live.
          </div>
        ) : (
          <ChatPodium rows={board} />
        )}
      </section>

      <section className="lb-stats">
        <div className="lb-stat">
          <span className="ring">
            <Coins size={18} aria-hidden />
          </span>
          <div className="v g">{coins(CHAT_POOL)}</div>
          <div className="l">Prize pool (MC)</div>
        </div>
        <div className="lb-stat">
          <span className="ring">
            <Users size={18} aria-hidden />
          </span>
          <div className="v">{totals.chatters.toLocaleString('en-GB')}</div>
          <div className="l">Chatters this week</div>
        </div>
        <div className="lb-stat">
          <span className="ring">
            <MessageSquare size={18} aria-hidden />
          </span>
          <div className="v b">{coins(totals.points)}</div>
          <div className="l">Messages counted</div>
        </div>
        <div className="lb-stat">
          <span className={stream.live ? 'ring' : 'ring off'}>
            <i aria-hidden />
          </span>
          <div className={stream.live ? 'v b' : 'v w'}>{stream.live ? 'Counting' : 'Off air'}</div>
          <div className="l">Status</div>
          <div className="m">{stream.live ? 'Matty is live — chat away' : 'Points count during live streams'}</div>
        </div>
      </section>

      <YourWeek signedIn={Boolean(user)} linked={Boolean(link)} standing={standing} />

      {board.length > 3 ? (
        <div className="tw lb-table">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Chatter</th>
                <th>Points</th>
                <th>Prize</th>
              </tr>
            </thead>
            <tbody>
              {board.slice(3).map((row) => (
                <tr key={row.userId}>
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    {row.rank}
                  </td>
                  <td className="n">{row.name}</td>
                  <td className="n">{coins(row.points)}</td>
                  <td className="g">
                    {row.prize ? `${coins(row.prize)} MC` : <span style={{ color: 'var(--muted-2)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="chat-rules">
        <div className="card">
          <h3>What counts</h3>
          <ul className="chat-list">
            <li>
              <Check size={15} aria-hidden className="ok" />
              One point per message while Matty is live on Kick
            </li>
            <li>
              <Check size={15} aria-hidden className="ok" />
              Your Kick account must be linked on your profile
            </li>
            <li>
              <X size={15} aria-hidden className="no" />
              More than one message every {CHAT_RULES.cooldownSeconds} seconds — the extras don&apos;t count
            </li>
            <li>
              <X size={15} aria-hidden className="no" />
              Repeating any of your last {CHAT_RULES.recentMemory} messages, even with different caps, punctuation or
              numbers
            </li>
            <li>
              <X size={15} aria-hidden className="no" />
              Emote-only messages, one- or two-letter messages, the same word over and over, and !commands
            </li>
            <li>
              <X size={15} aria-hidden className="no" />
              More than {CHAT_RULES.hourlyCap} points in an hour
            </li>
          </ul>
          <p className="small muted">
            A chat ban takes you off the board for its duration. Message text is never stored.
          </p>
        </div>
        <div className="card">
          <h3>Weekly prizes</h3>
          <ol className="chat-prizes">
            {CHAT_PRIZES.map((prize, i) => (
              <li key={i}>
                <span>#{i + 1}</span>
                <b>{coins(prize)} MC</b>
              </li>
            ))}
          </ol>
          <p className="small muted">
            Weeks run Monday to Sunday, UK time, and pay out automatically once Sunday ends. A place needs at
            least {CHAT_MIN_POINTS} points to be paid.
          </p>
        </div>
      </div>

      {history.length > 0 ? (
        <div className="sec" style={{ marginTop: 38 }}>
          <div className="sec-head">
            <div>
              <span className="eyebrow">Archive</span>
              <h2>Past weeks</h2>
            </div>
          </div>
          {history.map((w) => (
            <div className="acc" key={w.weekStart}>
              <span className="ah">
                <div>
                  <div className="am">Week of {weekLabel(w.weekStart)}</div>
                  <div className="ap">
                    {w.standings.length
                      ? w.standings
                          .slice(0, 3)
                          .map((s) => `#${s.rank} ${s.name}`)
                          .join(' · ')
                      : 'Nobody reached the minimum'}
                  </div>
                </div>
                <span className="tag gold">{coins(w.paid)} MC paid</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function YourWeek({
  signedIn,
  linked,
  standing,
}: {
  signedIn: boolean;
  linked: boolean;
  standing: ChatStanding | null;
}) {
  if (!signedIn) {
    return (
      <div className="card chat-you">
        <span className="tag blue">You</span>
        <div className="small muted">Sign in and link your Kick account to get on the board.</div>
      </div>
    );
  }
  if (!linked || !standing) {
    return (
      <div className="card chat-you">
        <span className="tag blue">You</span>
        <div className="small muted">
          Your Kick account isn&apos;t linked yet, so your messages aren&apos;t counted.{' '}
          <Link href="/profile">Link it on your profile</Link>.
        </div>
      </div>
    );
  }
  const filtered = standing.messages - standing.points;
  return (
    <div className="card chat-you">
      <span className="tag blue">You</span>
      <div className="chat-you-figs">
        <div>
          <b>{standing.rank ? `#${standing.rank}` : '—'}</b>
          <span>Rank</span>
        </div>
        <div>
          <b>{coins(standing.points)}</b>
          <span>Points</span>
        </div>
        <div>
          <b>
            {standing.hourPoints}/{CHAT_RULES.hourlyCap}
          </b>
          <span>This hour</span>
        </div>
        <div>
          <b>{coins(filtered)}</b>
          <span>Not counted</span>
        </div>
      </div>
    </div>
  );
}

/** Second, first, third — the same podium as the wager race, in coins. */
function ChatPodium({ rows }: { rows: ChatRow[] }) {
  const [first, second, third] = rows;
  return (
    <div className="lbp" role="group" aria-label="Top three">
      {second ? <Spot row={second} place={2} /> : <div />}
      {first ? <Spot row={first} place={1} /> : <div />}
      {third ? <Spot row={third} place={3} /> : <div />}
    </div>
  );
}

function Spot({ row, place }: { row: ChatRow; place: 1 | 2 | 3 }) {
  return (
    <div className={`lbp-spot r${place}`}>
      {place === 1 ? <Crown className="lbp-crown" size={24} fill="currentColor" aria-hidden /> : null}
      <div className="lbp-face" aria-hidden>
        {row.name.charAt(0).toUpperCase()}
        <i>{place}</i>
      </div>
      <div className="lbp-name">
        <span className="sr-only">Place {place}: </span>
        {row.name}
      </div>
      <div className="lbp-sum">{coins(row.points)}</div>
      <div className="lbp-cap">Points</div>
      <div className="lbp-prize">
        <span>Prize</span>
        <b>{row.prize ? `${coins(row.prize)} MC` : '—'}</b>
      </div>
      <div className="lbp-plinth" aria-hidden>
        {place}
      </div>
    </div>
  );
}

