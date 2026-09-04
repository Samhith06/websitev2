'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { toggleSetting } from '@/app/(site)/profile/actions';

/**
 * The three reasons the games are not showing.
 *
 * Games are opt-in and hidden until switched on, which is a deliberate choice
 * rather than a technical one: someone who came here for the leaderboard should
 * not be shown a casino they did not ask for. The list is the same in all three
 * states because it is what the person is agreeing to, not decoration.
 */
export function GamesGate({
  reason,
  excludedUntil,
}: {
  reason: 'signed-out' | 'opt-in' | 'excluded';
  excludedUntil?: string | null;
}) {
  const [pending, startTransition] = useTransition();

  if (reason === 'excluded') {
    return (
      <div className="gate">
        <div style={{ fontSize: 34, marginBottom: 8 }} aria-hidden>
          ⬢
        </div>
        <h1>Games are switched off for your account</h1>
        <p>
          You self-excluded until{' '}
          <b style={{ color: 'var(--text)' }}>
            {excludedUntil ? new Date(excludedUntil).toLocaleDateString('en-GB') : 'further notice'}
          </b>
          . The server refuses every bet until then, and it cannot be lifted early — not by you, and
          not by a mod.
        </p>
        <p>
          If gambling has stopped being fun,{' '}
          <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer noopener">
            BeGambleAware
          </a>{' '}
          and{' '}
          <a href="https://www.gamcare.org.uk" target="_blank" rel="noreferrer noopener">
            GamCare
          </a>{' '}
          are there, free and confidential.
        </p>
      </div>
    );
  }

  return (
    <div className="gate">
      <div style={{ fontSize: 34, marginBottom: 8 }} aria-hidden>
        ⬢
      </div>
      <h1>{reason === 'signed-out' ? 'Sign in to play' : 'Turn on Games'}</h1>
      <p>
        Games are opt-in and hidden until you switch them on. They are played entirely with Matty
        Coins earned from watching the stream.
      </p>

      <div className="gatelist">
        <div>
          <b>01</b>
          <span>Matty Coins have no cash value and can never be bought with real money.</span>
        </div>
        <div>
          <b>02</b>
          <span>Every game is provably fair — you can check any result against the seeds.</span>
        </div>
        <div>
          <b>03</b>
          <span>You can switch games off again at any time from your profile settings.</span>
        </div>
        <div>
          <b>04</b>
          <span>18+ only, and nothing here pays out in cash.</span>
        </div>
      </div>

      {reason === 'signed-out' ? (
        <Link className="btn pri discord" href="/api/auth/signin?callbackUrl=/games">
          Sign in with Discord
        </Link>
      ) : (
        <button
          className="btn pri"
          disabled={pending}
          onClick={() => startTransition(() => void toggleSetting('gamesEnabled', true))}
        >
          {pending ? 'Enabling…' : 'Enable games'}
        </button>
      )}
    </div>
  );
}
