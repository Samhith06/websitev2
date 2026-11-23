import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { ChooseSplitSteal, EnterSplitSteal } from '@/components/site/SplitStealControls';
import { currentUser } from '@/lib/player';
import { discordInvite } from '@/lib/mock';
import { money, maskUsername } from '@/lib/format';
import { periodWagerGate, type WagerGate } from '@/lib/store/wager-gate';
import {
  SPLIT_STEAL_WAGER_MIN,
  entryRefusal,
  featuredEvent,
  hasEntered,
  pairsOf,
  type Choice,
  type SsPair,
  type SsSide,
} from '@/lib/store/split-steal';

export const metadata: Metadata = {
  title: 'Split or Steal',
  description: `MattySpins Split or Steal: enter on the site with $${SPLIT_STEAL_WAGER_MIN} wagered this leaderboard period, get paired, and choose to split the prize or steal it.`,
};

export const dynamic = 'force-dynamic';

/**
 * Split or Steal, played here rather than in Kick chat. Entry, the pairing,
 * each player's choice and the results all live on this page, which keeps
 * itself current while an event runs.
 */
export default async function SplitStealPage() {
  const [event, user] = await Promise.all([featuredEvent(), currentUser().catch(() => null)]);
  const live = event != null && (event.status === 'open' || event.status === 'choosing');

  const [pairs, entered] = event
    ? await Promise.all([
        event.status === 'open' ? Promise.resolve([] as SsPair[]) : pairsOf(event, user?.id ?? null),
        user ? hasEntered(event.id, user.id) : Promise.resolve(false),
      ])
    : [[] as SsPair[], false];

  // The wager check, up front, so nobody has to press a button to learn they are short.
  let gate: WagerGate | null = null;
  if (event?.status === 'open' && user && !entered) {
    gate = await periodWagerGate(user.id, SPLIT_STEAL_WAGER_MIN).catch(
      (): WagerGate => ({ ok: false, reason: 'unavailable', wagered: null, min: SPLIT_STEAL_WAGER_MIN }),
    );
  }

  const mine = user ? pairs.find((p) => p.a.userId === user.id || p.b.userId === user.id) : undefined;
  const totalPot = event ? event.prize * event.pairs : 0;

  return (
    <div className="ss">
      {live ? <AutoRefresh seconds={8} /> : null}

      <div className="sec-head">
        <div>
          <span className="eyebrow">
            {!event
              ? 'Split or Steal'
              : event.status === 'open'
                ? 'Entries open'
                : event.status === 'choosing'
                  ? 'Pairs drawn · choices open'
                  : 'Results'}
          </span>
          <h1>
            {event ? (
              <>
                Split or Steal · <span className="gold">{money(event.prize)}</span> per pair
              </>
            ) : (
              'Split or Steal'
            )}
          </h1>
          <div className="sh-sub">
            {!event
              ? 'No Split or Steal is running right now. The next one is announced on stream and in Discord.'
              : live
                ? 'Played right here on the site, not in chat. This page updates itself.'
                : `${event.title} has finished. The next one is announced on stream and in Discord.`}
          </div>
        </div>
      </div>

      {event ? (
        <div className="ss-stats">
          <div>
            <span>Prize per pair</span>
            <b className="gold">{money(event.prize)}</b>
          </div>
          <div>
            <span>{event.status === 'open' ? 'Pairs' : 'Pairs drawn'}</span>
            <b>{event.status === 'open' ? event.pairs : pairs.length}</b>
          </div>
          <div>
            <span>Entered</span>
            <b>{event.entryCount}</b>
          </div>
          <div>
            <span>To enter</span>
            <b>{money(SPLIT_STEAL_WAGER_MIN)}</b>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Your part in it                                                  */}
      {/* ---------------------------------------------------------------- */}
      {event?.status === 'open' ? (
        <div className="card ss-card">
          <span className="tag blue">Your entry</span>
          {!user ? (
            <div className="ss-signin">
              <p>Sign in to check your wager and enter.</p>
              <Link className="btn pri discord" href="/api/auth/signin?callbackUrl=/split-or-steal">
                Sign in with Discord
              </Link>
            </div>
          ) : entered ? (
            <p className="ss-in">
              <b>You&apos;re in.</b> Pairs are drawn when entries close. Come back to this page to see who you are
              up against and make your choice.
            </p>
          ) : gate?.ok ? (
            <>
              <p className="ss-ok">
                You&apos;ve wagered <b>{money(gate.wagered)}</b> this leaderboard period, so you qualify.
              </p>
              <EnterSplitSteal />
            </>
          ) : gate ? (
            <>
              <p className="ss-refusal" role="alert">
                {entryRefusal(gate)}
              </p>
              {gate.reason === 'short' && gate.wagered != null ? (
                <div className="ss-bar" aria-hidden>
                  <i style={{ width: `${Math.min(100, (gate.wagered / gate.min) * 100)}%` }} />
                </div>
              ) : null}
              {gate.reason === 'no-link' ? (
                <Link className="btn pri" href="/profile">
                  Link Razed on your profile
                </Link>
              ) : gate.reason === 'unavailable' ? (
                <EnterSplitSteal />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {event?.status === 'choosing' && user && entered && !mine ? (
        <div className="card ss-card">
          <span className="tag">Your entry</span>
          <p className="ss-in">You weren&apos;t drawn this time. Good luck in the next one.</p>
        </div>
      ) : null}

      {mine && user && event ? <YourMatch pair={mine} userId={user.id} prize={event.prize} /> : null}

      {/* ---------------------------------------------------------------- */}
      {/* Everyone's pairs                                                  */}
      {/* ---------------------------------------------------------------- */}
      {pairs.length > 0 ? (
        <div className="sec" style={{ marginTop: 26 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>
            {event?.status === 'finished' ? 'Results' : 'The pairs'}
          </h2>
          <div className="ss-pairs">
            {pairs.map((p) => (
              <PairRow key={p.id} pair={p} userId={user?.id ?? null} />
            ))}
          </div>
        </div>
      ) : null}

      <Rules prize={event?.prize ?? null} />

      {event ? (
        <p className="small muted ss-seed">
          Pairs are drawn by shuffling the entries with a seed fixed when the event opened. Seed hash{' '}
          <code title={event.drawSeedHash}>{event.drawSeedHash.slice(0, 16)}…</code>
          {event.drawSeed ? (
            <>
              {' '}
              · seed <code title={event.drawSeed}>{event.drawSeed.slice(0, 16)}…</code>
            </>
          ) : (
            ' · the seed is revealed when the pairs are drawn'
          )}
          . Up to {money(totalPot)} in prizes.
        </p>
      ) : (
        <a className="btn discord" href={discordInvite} target="_blank" rel="noreferrer" style={{ marginTop: 16 }}>
          Join the Discord
        </a>
      )}
    </div>
  );
}

function ChoiceChip({ choice }: { choice: Choice | null }) {
  if (!choice) return <span className="ss-chip none">No choice</span>;
  return <span className={`ss-chip ${choice}`}>{choice === 'split' ? 'Split' : 'Steal'}</span>;
}

function YourMatch({ pair, userId, prize }: { pair: SsPair; userId: number; prize: number }) {
  const me = pair.a.userId === userId ? pair.a : pair.b;
  const them = pair.a.userId === userId ? pair.b : pair.a;

  return (
    <div className="card ss-card ss-match">
      <span className="tag gold">Your match · pair {pair.position}</span>
      <div className="ss-versus">
        <b>You</b>
        <span>vs</span>
        <b>{them.username}</b>
      </div>

      {pair.revealed ? (
        <div className="ss-result">
          <div className="ss-reveal">
            <div>
              <span>You</span>
              <ChoiceChip choice={me.choice} />
            </div>
            <div>
              <span>{them.username}</span>
              <ChoiceChip choice={them.choice} />
            </div>
          </div>
          <p className={`ss-won ${me.payout ? 'yes' : 'no'}`}>
            {me.payout ? `You won ${money(me.payout)}! A mod will send it to you.` : 'No prize this time.'}
          </p>
        </div>
      ) : me.choice ? (
        <p className="ss-in">
          You locked in <ChoiceChip choice={me.choice} />. It stays hidden from everyone until your pair is revealed.{' '}
          {them.locked ? `${them.username} has locked in too.` : `${them.username} hasn't chosen yet.`}
        </p>
      ) : (
        <>
          <p className="ss-in">
            {money(prize)} is on the table. Choose before your pair is revealed: if you don&apos;t choose, you forfeit and{' '}
            {them.username} takes it all. Your choice is final.
            {them.locked ? ` ${them.username} has already locked in.` : ''}
          </p>
          <ChooseSplitSteal opponent={them.username} />
        </>
      )}
    </div>
  );
}

function SideCell({ side, revealed, mine }: { side: SsSide; revealed: boolean; mine: boolean }) {
  return (
    <div className={`ss-side${mine ? ' me' : ''}`}>
      <b>{mine ? 'You' : maskUsername(side.username)}</b>
      {revealed ? (
        <>
          <ChoiceChip choice={side.choice} />
          <span className={side.payout ? 'ss-pay' : 'ss-pay none'}>{side.payout ? money(side.payout) : '$0'}</span>
        </>
      ) : (
        <span className={side.locked ? 'ss-locked' : 'ss-waiting'}>{side.locked ? 'Locked in' : 'Choosing…'}</span>
      )}
    </div>
  );
}

function PairRow({ pair, userId }: { pair: SsPair; userId: number | null }) {
  return (
    <div className={`ss-pair${pair.revealed ? ' revealed' : ''}`}>
      <span className="ss-pos">#{pair.position}</span>
      <SideCell side={pair.a} revealed={pair.revealed} mine={pair.a.userId === userId} />
      <span className="ss-vs">vs</span>
      <SideCell side={pair.b} revealed={pair.revealed} mine={pair.b.userId === userId} />
    </div>
  );
}

function Rules({ prize }: { prize: number | null }) {
  const half = prize ? `${money(Math.floor(prize * 50) / 100)} each` : 'Half each';
  const all = prize ? money(prize) : 'it all';
  return (
    <div className="card ss-card ss-rules">
      <span className="tag blue">How it works</span>
      <ol>
        <li>
          <b>Enter on this page</b>
          <span>
            You need {money(SPLIT_STEAL_WAGER_MIN)} wagered under code <code>MATTYSPINS</code> in the current leaderboard
            period, and your Razed account linked and approved on your profile.
          </span>
        </li>
        <li>
          <b>Get paired</b>
          <span>When entries close, entrants are shuffled into pairs. If there are more entrants than places, some miss out.</span>
        </li>
        <li>
          <b>Choose Split or Steal</b>
          <span>
            You see who you are up against, and lock in your choice here. Nobody sees it, not even the mods, until your
            pair is revealed on stream.
          </span>
        </li>
      </ol>
      <div className="ss-matrix">
        <div>
          <span>
            <ChoiceChip choice="split" /> + <ChoiceChip choice="split" />
          </span>
          <b>{half}</b>
        </div>
        <div>
          <span>
            <ChoiceChip choice="steal" /> + <ChoiceChip choice="split" />
          </span>
          <b>Stealer takes {all}</b>
        </div>
        <div>
          <span>
            <ChoiceChip choice="steal" /> + <ChoiceChip choice="steal" />
          </span>
          <b>Nobody wins</b>
        </div>
        <div>
          <span>
            <ChoiceChip choice={null} />
          </span>
          <b>Forfeit: the other player takes {all}</b>
        </div>
      </div>
    </div>
  );
}
