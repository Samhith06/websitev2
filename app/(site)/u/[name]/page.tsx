import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { one } from '@/lib/db';
import { badgesFor } from '@/lib/store/badges';
import { settingsFor } from '@/lib/store/profile';
import { claimsFor } from '@/lib/store/milestones';
import { ledgerFor } from '@/lib/store/coins';
import { dateShort } from '@/lib/format';
import { BadgeIcon } from '@/components/site/ProfileControls';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  return {
    title: decodeURIComponent(name),
    description: `Badges, watch time and leaderboard position for ${decodeURIComponent(name)}.`,
  };
}

type PublicUser = { id: string; discord_username: string; created_at: Date };

/**
 * Somebody else's profile.
 *
 * What is *absent* is the point. Coin balances, order history, the Razed
 * username and every personal figure stay private; only badges, watch time and
 * board position are public. A profile that leaked a balance would turn the
 * leaderboard into a target list.
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const username = decodeURIComponent(name);

  const row = await one<PublicUser>(
    `SELECT id::text, discord_username, created_at
       FROM users
      WHERE lower(discord_username) = lower($1) AND status <> 'banned'`,
    [username],
  );
  if (!row) notFound();

  const userId = Number(row.id);
  const [settings, badges, claims, ledger] = await Promise.all([
    settingsFor(userId),
    badgesFor(userId),
    claimsFor(userId),
    ledgerFor(userId, 500),
  ]);

  // An opted-out profile is a 404 rather than a "this is private" page: the
  // second still confirms the account exists, which is the thing being opted
  // out of.
  if (!settings.publicProfile) notFound();

  const earned = badges.filter((b) => b.earnedAt);
  const pinned = earned.filter((b) => b.pinned);
  const watchCoins = ledger.filter((e) => e.kind === 'watch').reduce((n, e) => n + e.delta, 0);
  const hoursWatched = Math.floor((watchCoins * 3) / 60);

  return (
    <>
      <div className="sec-head">
        <div>
          <Link href="/leaderboard" className="eyebrow">
            ← Leaderboard
          </Link>
          <h1>{row.discord_username}</h1>
          <div className="sh-sub">Public profile · what everyone else sees</div>
        </div>
      </div>

      <div className="pgrid">
        <div className="idcard">
          <div className="big" aria-hidden>
            {row.discord_username.charAt(0).toUpperCase()}
          </div>
          <div className="un">{row.discord_username}</div>
          <div className="sub">Member since {dateShort(row.created_at.toISOString())}</div>

          {pinned.length > 0 ? (
            <div className="shelf">
              {pinned.map((b) => (
                <span key={b.id} className={`mini-badge ${b.gold ? 'gold' : 'blue'}`}>
                  {b.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="statgrid">
            <div className="sbox">
              <div className="sl">Hours watched</div>
              <div className="sv">{hoursWatched}</div>
            </div>
            <div className="sbox">
              <div className="sl">Badges earned</div>
              <div className="sv b">{earned.length}</div>
            </div>
            <div className="sbox">
              <div className="sl">Milestones claimed</div>
              <div className="sv">{claims.length}</div>
            </div>
          </div>

          {earned.length > 0 ? (
            <div className="card">
              <h2 style={{ fontSize: 15, marginBottom: 12 }}>Badges earned</h2>
              <div className="bgrid">
                {earned.map((badge) => (
                  <div className={`bdg earned ${badge.gold ? 'gold' : ''}`} key={badge.id}>
                    <BadgeIcon badge={badge} />
                    <div className="bn">{badge.name}</div>
                    <div className="bd">{badge.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="emptyq">No badges earned yet.</div>
          )}

          <p className="small muted">
            Coin balances, order history and personal stats stay private — only badges, watch time
            and leaderboard position are public.
          </p>
        </div>
      </div>
    </>
  );
}
