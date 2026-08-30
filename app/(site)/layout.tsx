import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { Nav } from '@/components/site/Nav';
import { Footer } from '@/components/site/Footer';
import { MobileTabBar } from '@/components/site/MobileTabBar';
import { AgeGate } from '@/components/site/AgeGate';
import { currentStream } from '@/lib/store/stream';
import { viewerOrSignedOut } from '@/lib/viewer';

/** The public site's chrome. Admin runs its own shell (UI Spec §15). */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Identity and balance both come from the database now, so the coin bar shows
  // what the ledger says rather than a figure nobody earned.
  const [viewer, stream] = await Promise.all([viewerOrSignedOut(), currentStream()]);

  const account = session?.user
    ? {
        username: session.user.discordUsername ?? session.user.name ?? 'Account',
        avatarUrl: session.user.image ?? null,
        isAdmin: isAdmin(session.user.discordId),
      }
    : null;

  return (
    <div className="pb-[62px] lg:pb-0">
      <AgeGate />
      <Nav live={stream.live} viewer={viewer} account={account} />
      <main id="main">{children}</main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}
