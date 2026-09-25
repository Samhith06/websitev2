import { Ambient } from '@/components/system/Ambient';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { MobileNav } from '@/components/site/MobileNav';
import { AgeGate } from '@/components/site/AgeGate';
import { viewerOrSignedOut } from '@/lib/viewer';
import { navFor } from '@/lib/nav';
import { liveGames } from '@/lib/store/stream-games';

/**
 * The public site's chrome. Admin runs inside it too — the staff bar sits
 * below this header rather than replacing it, so a mod is never unsure which
 * site they are on.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [viewer, live] = await Promise.all([viewerOrSignedOut(), liveGames()]);
  // A stream game is in the nav only while it runs.
  const nav = navFor(live);

  return (
    <>
      <Ambient />
      <AgeGate />
      <div className="shell">
        <SiteHeader viewer={viewer} nav={nav} />
        <main id="main" className="sitemain">
          <div className="wrap">{children}</div>
        </main>
        <SiteFooter />
      </div>
      <MobileNav nav={nav} />
    </>
  );
}
