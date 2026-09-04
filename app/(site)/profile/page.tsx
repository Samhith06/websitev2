import Link from 'next/link';
import type { Metadata } from 'next';
import { currentUser } from '@/lib/player';
import { currentViewer } from '@/lib/viewer';
import { verificationStateFor } from '@/lib/store/accounts';
import { ledgerFor } from '@/lib/store/coins';
import { redemptionsFor } from '@/lib/store/shop';
import { badgesFor } from '@/lib/store/badges';
import { pokerHandleFor, settingsFor } from '@/lib/store/profile';
import { claimsFor } from '@/lib/store/milestones';
import { wagerStateFor } from '@/lib/store/wager';
import { coins, dateShort, money, relativeTime } from '@/lib/format';
import { KickVerify } from '@/components/site/KickVerify';
import {
  AccountForms,
  BadgeGrid,
  SelfExclude,
  SettingToggle,
} from '@/components/site/ProfileControls';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your coins, badges, linked accounts and play settings.',
};

/** Everything here is the signed-in person's own data. */
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) return <SignedOut />;

  const viewer = await currentViewer();
  if (!viewer) return <SignedOut />;

  const [verification, ledger, redemptions, badges, settings, poker, claims, wager] =
    await Promise.all([
      verificationStateFor(user.id),
      ledgerFor(user.id, 40),
      redemptionsFor(user.id, 20),
      badgesFor(user.id),
      settingsFor(user.id),
      pokerHandleFor(user.id),
      claimsFor(user.id),
      wagerStateFor(user.id),
    ]);

  const pinned = badges.filter((b) => b.pinned);
  const razedStatus =
    wager.link?.status === 'approved'
      ? 'approved'
      : wager.link?.status === 'rejected'
        ? 'rejected'
        : wager.link
          ? 'pending'
          : 'none';

  // Watch time is the ledger's, not a separate counter: coins are minted one
  // per 180-second block, so the blocks are the hours.
  const watchCoins = ledger.filter((e) => e.kind === 'watch').reduce((n, e) => n + e.delta, 0);
  const hoursWatched = Math.floor((watchCoins * 3) / 60);

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Your account</span>
          <h1>Profile</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {viewer.role !== 'member' ? (
            <Link
              className="btn sm"
              href="/admin"
              style={{ borderColor: 'rgba(255,179,71,.35)', color: 'var(--warn)' }}
            >
              ◆ Staff area
            </Link>
          ) : null}
          <Link className="btn sm ghost" href={`/u/${encodeURIComponent(user.discordUsername)}`}>
            View public profile →
          </Link>
        </div>
      </div>

      <div className="pgrid">
        {/* -------------------------------------------------------------- */}
        {/* Identity and settings                                           */}
        {/* -------------------------------------------------------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="idcard">
            <div className="big">
              {viewer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.avatarUrl} alt="" />
              ) : (
                user.discordUsername.charAt(0).toUpperCase()
              )}
            </div>
            <div className="un">{user.discordUsername}</div>
            <div className="sub">Member since {dateShort(viewer.memberSince)}</div>

            {pinned.length > 0 ? (
              <div className="shelf">
                {pinned.map((b) => (
                  <span key={b.id} className={`mini-badge ${b.gold ? 'gold' : 'blue'}`}>
                    {b.name}
                  </span>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 18 }}>
              <div className="linkrow">
                <span className="lk">Discord</span>
                <span className="lv" style={{ color: 'var(--green)' }}>
                  {user.discordUsername} ✓
                </span>
              </div>
              <div className="linkrow">
                <span className="lk">Kick</span>
                <span
                  className="lv"
                  style={{ color: viewer.kick ? 'var(--green)' : 'var(--muted)' }}
                >
                  {viewer.kick ? `${viewer.kick.kickUsername} ✓` : 'Not linked'}
                </span>
              </div>
              <div className="linkrow">
                <span className="lk">Razed</span>
                <span
                  className="lv"
                  style={{
                    color:
                      razedStatus === 'approved'
                        ? 'var(--green)'
                        : razedStatus === 'pending'
                          ? 'var(--warn)'
                          : 'var(--muted)',
                  }}
                >
                  {wager.link
                    ? `${wager.link.username}${razedStatus === 'approved' ? ' ✓' : ' · pending'}`
                    : 'Not linked'}
                </span>
              </div>
              <div className="linkrow">
                <span className="lk">PokerNow</span>
                <span className="lv">{poker ?? '—'}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Settings</h3>
            <SettingToggle
              label="Games enabled"
              setting="gamesEnabled"
              value={settings.gamesEnabled}
              note="Games are opt-in and hidden until switched on."
            />
            <SettingToggle label="Game sound" setting="gameSound" value={settings.gameSound} />
            <SettingToggle
              label="Public profile"
              setting="publicProfile"
              value={settings.publicProfile}
              note="Badges, watch time and board position only."
            />
            <SettingToggle
              label="Stream notifications"
              setting="streamNotifications"
              value={settings.streamNotifications}
            />
            <SelfExclude excludedUntil={settings.excludedUntil} />
          </div>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Stats, accounts, verification, badges, history                  */}
        {/* -------------------------------------------------------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="statgrid">
            <Stat label="Coin balance" value={coins(viewer.balance)} tone="g" />
            <Stat label="Lifetime coins" value={coins(viewer.lifetimeEarned)} />
            <Stat label="Hours watched" value={String(hoursWatched)} />
            <Stat label="Multiplier" value={`${viewer.multiplier.value}×`} tone="b" />
            <Stat
              label="Lifetime wagered"
              value={wager.lifetime == null ? '—' : money(wager.lifetime)}
            />
            <Stat label="Milestones claimed" value={String(claims.length)} />
          </div>

          <AccountForms
            razedUsername={wager.link?.username ?? ''}
            razedStatus={razedStatus}
            pokerHandle={poker ?? ''}
          />

          <KickVerify state={verification} />

          <BadgeGrid badges={badges} />

          {/* Coin history. Two rows per game round — stake and payout — because
              a netted figure hides what was actually staked. */}
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Coin history</h3>
            {ledger.length === 0 ? (
              <div className="small muted">
                Nothing yet. Coins arrive while you chat during a stream.
              </div>
            ) : (
              <div className="tw" style={{ border: 0 }}>
                <table style={{ minWidth: 420 }}>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.reason}</td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {relativeTime(entry.createdAt)}
                        </td>
                        <td
                          className="n"
                          style={{
                            textAlign: 'right',
                            color: entry.delta >= 0 ? 'var(--green)' : 'var(--red)',
                          }}
                        >
                          {entry.delta >= 0 ? '+' : '−'}
                          {coins(Math.abs(entry.delta))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {redemptions.length > 0 ? (
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>Orders</h3>
              <div className="tw" style={{ border: 0 }}>
                <table style={{ minWidth: 420 }}>
                  <tbody>
                    {redemptions.map((r) => (
                      <tr key={r.id}>
                        <td>{r.itemName}</td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {dateShort(r.createdAt)}
                        </td>
                        <td className="n" style={{ textAlign: 'right' }}>
                          <span
                            className={`tag ${
                              r.status === 'fulfilled'
                                ? 'green'
                                : r.status === 'rejected'
                                  ? 'red'
                                  : 'warn'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'g' | 'b' }) {
  return (
    <div className="sbox">
      <div className="sl">{label}</div>
      <div className={`sv ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="gate">
      <h1>Sign in</h1>
      <p>
        Your profile holds your coin balance, badges, Kick verification and your Razed link.
      </p>
      <Link className="btn pri discord" href="/api/auth/signin?callbackUrl=/profile">
        Sign in with Discord
      </Link>
    </div>
  );
}
