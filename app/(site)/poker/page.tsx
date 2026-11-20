import type { Metadata } from 'next';
import Link from 'next/link';
import { discordInvite } from '@/lib/mock';
import { currentUser } from '@/lib/player';
import { pokerHandleFor } from '@/lib/store/profile';
import { kickLinkFor } from '@/lib/store/accounts';
import { PokerHandleForm } from '@/components/site/PokerHandleForm';

export const metadata: Metadata = {
  title: 'Poker',
  description:
    'MattySpins poker night: a free-to-enter tournament with a $50 prize pool for viewers with 5 hours of Kick watch time that week.',
};

/**
 * The poker night page. One event at a time, written here by hand: when the
 * next one is set, change EVENT. Once the day is over (UK time) the page says
 * so and points to Discord rather than advertising a game that has been played.
 *
 * The layout keeps to the left so the suit constellation behind it has the
 * right of the screen to itself.
 */
const EVENT = {
  date: 'Saturday 21 November',
  endsAt: Date.parse('2026-11-22T00:00:00Z'),
  pool: '$50',
  watchHours: 5,
  fullPayoutWager: '$200',
};

export const dynamic = 'force-dynamic';

export default async function PokerPage() {
  const over = Date.now() >= EVENT.endsAt;
  const user = over ? null : await currentUser().catch(() => null);
  const [handle, kick] = user
    ? await Promise.all([pokerHandleFor(user.id).catch(() => null), kickLinkFor(user.id).catch(() => null)])
    : [null, null];

  return (
    <div className="poker">
      <div className="sec-head">
        <div>
          <span className="eyebrow">{over ? 'Poker night' : `♠ Poker is back · ${EVENT.date}`}</span>
          <h1>
            {over ? (
              'Poker night'
            ) : (
              <>
                <span className="gold">{EVENT.pool}</span> poker tournament
              </>
            )}
          </h1>
          <div className="sh-sub">
            {over
              ? 'The last tournament has been played. The next one is announced in Discord first.'
              : 'Free to enter. Watch time is tracked automatically through the site.'}
          </div>
        </div>
      </div>

      {over ? (
        <a className="btn discord" href={discordInvite} target="_blank" rel="noreferrer">
          Join the Discord
        </a>
      ) : (
        <>
          <div className="card poker-card">
            <span className="tag blue">To enter</span>
            <ul className="poker-list">
              <li>
                <b>No wagering requirement</b>
                <span>Anyone can play.</span>
              </li>
              <li>
                <b>{EVENT.watchHours} hours of Kick watch time this week</b>
                <span>Counted for you while you watch the stream.</span>
              </li>
              <li>
                <b>Kick account linked and verified</b>
                <span>On mattyspins.com, before {EVENT.date.split(' ')[0]}.</span>
              </li>
              <li>
                <b>Your PokerNow username entered</b>
                <span>Below, so you can be seated at the table.</span>
              </li>
            </ul>
            {user && !kick ? (
              <Link className="btn pri" href="/profile">
                Link your Kick account
              </Link>
            ) : null}
          </div>

          <div className="card poker-card" id="pokernow">
            <span className="tag green">Your seat</span>
            {user ? (
              <>
                {kick ? (
                  <p className="small muted poker-kick">
                    Kick: <b style={{ color: 'var(--green)' }}>{kick.kickUsername}</b> · verified
                  </p>
                ) : null}
                <PokerHandleForm handle={handle ?? ''} />
              </>
            ) : (
              <div className="poker-signin">
                <p className="small muted">
                  Sign in to enter your PokerNow username and check your Kick account is linked.
                </p>
                <Link className="btn pri" href="/api/auth/signin?callbackUrl=/poker%23pokernow">
                  Sign in with Discord
                </Link>
              </div>
            )}
          </div>

          <div className="card poker-card">
            <span className="tag gold">Prize payouts</span>
            <div className="poker-pay">
              <div>
                <b className="gold">100%</b>
                <span>
                  of your prize with at least {EVENT.fullPayoutWager} wagered under code <code>MATTYSPINS</code> this
                  month
                </span>
              </div>
              <div>
                <b>50%</b>
                <span>of your prize with less than {EVENT.fullPayoutWager} wagered</span>
              </div>
            </div>
          </div>

          <p className="small muted poker-foot">
            Table details and the start time go out on stream and in{' '}
            <a href={discordInvite} target="_blank" rel="noreferrer">
              Discord
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
