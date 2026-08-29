import type { Metadata } from 'next';
import { auth, signIn } from '@/auth';
import { noAdminsConfigured, roleFor } from '@/lib/admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminGate } from '@/components/admin/AdminGate';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · MattySpins admin' },
  robots: { index: false, follow: false },
};

/** Nothing here may be cached or prerendered — it is all session-dependent. */
export const dynamic = 'force-dynamic';

/**
 * Admin shares the design tokens but runs denser (UI Spec §15).
 *
 * Access is decided here, on the server, on every request: you must be signed
 * in with Discord and your Discord id must appear in OWNER_DISCORD_IDS or
 * MOD_DISCORD_IDS. There is no password, and no role travels in the session
 * token — see `lib/admin.ts`.
 */
/**
 * A local-only door into the dashboard, for reviewing the admin screens before
 * Discord credentials exist.
 *
 * The `NODE_ENV` check is the important half and is evaluated at build time, so
 * a production bundle cannot open it however the environment is set. It is not
 * a feature flag — it is scaffolding, and it comes out once sign-in works.
 */
function devBypass(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_ADMIN_BYPASS === 'true';
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (devBypass()) {
    return (
      <AdminShell role="owner" name="Local preview">
        <div className="mb-5 rounded-[6px] border border-gold-line bg-gold-bg px-4 py-3 text-[13px] text-gold">
          Local preview — signed in as owner without Discord. Set DEV_ADMIN_BYPASS to anything
          other than &ldquo;true&rdquo; to test the real sign-in gate. This cannot be enabled in
          production.
        </div>
        {children}
      </AdminShell>
    );
  }

  const session = await auth();
  const discordId = session?.user?.discordId ?? null;
  const role = roleFor(discordId);

  if (!session) {
    return (
      <AdminGate
        state="signed-out"
        signIn={async () => {
          'use server';
          await signIn('discord', { redirectTo: '/admin' });
        }}
      />
    );
  }

  if (!role) {
    return (
      <AdminGate
        state={noAdminsConfigured() ? 'unconfigured' : 'not-authorised'}
        discordId={discordId}
        username={session.user?.discordUsername ?? session.user?.name ?? null}
      />
    );
  }

  return (
    <AdminShell role={role} name={session.user?.discordUsername ?? session.user?.name ?? 'Admin'}>
      {children}
    </AdminShell>
  );
}
