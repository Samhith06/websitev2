import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { devBypass, noAdminsConfigured, roleFor } from '@/lib/admin';
import { pendingLinkCount } from '@/lib/store/razed-links';
import { pendingClaimCount } from '@/lib/store/milestones';
import { pendingCount as pendingRedemptions } from '@/lib/store/shop';
import { feedHealth } from '@/lib/store/razed-snapshots';
import { relativeTime } from '@/lib/format';
import { AdminNav } from '@/components/admin/AdminNav';

export const metadata: Metadata = {
  title: { default: 'Staff area', template: '%s · MattySpins staff' },
  robots: { index: false, follow: false },
};

/** Nothing here may be cached or prerendered — it is all session-dependent. */
export const dynamic = 'force-dynamic';

/**
 * The staff area, inside the ordinary site chrome.
 *
 * The design keeps the site header above it rather than swapping in a separate
 * admin shell, so a mod is never unsure which site they are on — and the amber
 * staff bar makes it unmistakable that actions here are logged.
 *
 * Access is decided on the server on every request: signed in with Discord,
 * and that Discord id present in OWNER_DISCORD_IDS or MOD_DISCORD_IDS. No role
 * travels in the session token.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const bypass = devBypass();
  const session = bypass ? null : await auth();
  const discordId = session?.user?.discordId ?? null;
  const role = bypass ? ('owner' as const) : roleFor(discordId);
  const name = bypass
    ? 'Local preview'
    : (session?.user?.discordUsername ?? session?.user?.name ?? 'Staff');

  if (!role) return <Denied signedIn={Boolean(session)} discordId={discordId} />;

  const [links, claims, redemptions, health] = await Promise.all([
    pendingLinkCount(),
    pendingClaimCount(),
    pendingRedemptions(),
    feedHealth(),
  ]);

  return (
    <>
      <div className="staffbar">
        <span className="sbt">◆ STAFF AREA</span>
        <span className="small muted" style={{ flex: 1, minWidth: 200 }}>
          Signed in as <b style={{ color: 'var(--text)' }}>{name}</b> · {role} · every action here
          is written to the audit log
        </span>
        <span className={`sync ${health.stale ? 'stale' : ''}`}>
          <i />
          {health.lastSyncAt
            ? `Razed synced ${relativeTime(health.lastSyncAt)}`
            : 'Razed never synced'}
        </span>
      </div>

      {bypass ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(255,179,71,.35)' }}>
          <div className="small" style={{ color: 'var(--warn)' }}>
            Local preview — signed in as owner without Discord. This cannot be enabled in
            production.
          </div>
        </div>
      ) : null}

      <div className="adm">
        <AdminNav
          role={role}
          pending={{ approvals: links + claims + redemptions, payouts: claims }}
        />
        <div>{children}</div>
      </div>
    </>
  );
}

/**
 * Three refusals, saying different things on purpose. "Sign in" is an
 * invitation; "not authorised" is a dead end that still shows the id a mod
 * would need to add you; "unconfigured" is the first-run case, where refusing
 * without explanation would just look broken.
 */
function Denied({ signedIn, discordId }: { signedIn: boolean; discordId: string | null }) {
  if (!signedIn) {
    return (
      <div className="gate">
        <h1>Sign in to continue</h1>
        <p>
          Staff access is tied to your Discord account. Sign in, and if your account is on the list
          you will land in the staff area.
        </p>
        <Link className="btn pri discord" href="/api/auth/signin?callbackUrl=/admin">
          Sign in with Discord
        </Link>
      </div>
    );
  }

  if (noAdminsConfigured()) {
    return (
      <div className="gate">
        <h1>No staff configured yet</h1>
        <p>
          Neither OWNER_DISCORD_IDS nor MOD_DISCORD_IDS is set, so nobody can get in. Add your
          Discord id to OWNER_DISCORD_IDS and restart.
        </p>
        {discordId ? (
          <div className="seed" style={{ maxWidth: 420, margin: '0 auto' }}>
            <div className="sl">Your Discord id</div>
            <div className="sv">{discordId}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="gate">
      <h1>Not authorised</h1>
      <p>
        This account is not on the staff list. If it should be, send the id below to Matty and ask
        to be added.
      </p>
      {discordId ? (
        <div className="seed" style={{ maxWidth: 420, margin: '0 auto' }}>
          <div className="sl">Your Discord id</div>
          <div className="sv">{discordId}</div>
        </div>
      ) : null}
    </div>
  );
}
