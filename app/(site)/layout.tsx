import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { Nav } from '@/components/site/Nav';
import { Footer } from '@/components/site/Footer';
import { MobileTabBar } from '@/components/site/MobileTabBar';
import { AgeGate } from '@/components/site/AgeGate';
import { stream, viewer } from '@/lib/mock';

/** The public site's chrome. Admin runs its own shell (UI Spec §15). */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  /**
   * Identity is real; the coin balance is still mock until the database lands.
   * Keeping the two separate here means the swap later is one line rather than
   * a hunt through the components.
   */
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
