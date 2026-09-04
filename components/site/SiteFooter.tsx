import Link from 'next/link';
import { Logo } from './SiteHeader';

/**
 * The footer carries the responsible-gambling block, which is the one piece of
 * chrome that must appear on every page without exception — including the
 * games, where it matters most.
 *
 * It is also where the secondary destinations live. Clips and the wall of fame
 * are reachable here and from the home strip rather than from the top row,
 * which the design fixes at six entries.
 */
export function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="fgrid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
              <Logo />
              <div
                className="bt"
                style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16 }}
              >
                MATTY<i style={{ fontStyle: 'normal', color: 'var(--blue)' }}>SPINS</i>
              </div>
            </div>
            <p className="small muted" style={{ maxWidth: '38ch', margin: 0 }}>
              The official community hub. Live every day at 7pm UK on Kick. Official Razed partner.
            </p>
          </div>

          <div>
            <h4>Site</h4>
            <Link href="/leaderboard">Leaderboard</Link>
            <Link href="/milestones">Milestones</Link>
            <Link href="/games">Games</Link>
            <Link href="/raffles">Raffles</Link>
            <Link href="/store">Store</Link>
            <Link href="/community">Clips &amp; wall of fame</Link>
            <Link href="/verify">Verify a round</Link>
          </div>

          <div>
            <h4>Play responsibly</h4>
            <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer noopener">
              BeGambleAware.org
            </a>
            <a href="https://www.gamcare.org.uk" target="_blank" rel="noreferrer noopener">
              GamCare
            </a>
            <a href="https://www.gamstop.co.uk" target="_blank" rel="noreferrer noopener">
              Gamstop
            </a>
            <Link href="/responsible">Responsible play</Link>
            <Link href="/terms">Terms &amp; conditions</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>

        <div className="rg">
          <div className="age">18+</div>
          <div style={{ maxWidth: '74ch' }}>
            Gambling can be addictive — please play responsibly. This site is not a gambling
            operator: Matty Coins have no cash value and cannot be purchased. All dollar rewards are
            tipped directly by Razed. MattySpins earns a commission from signups made under the
            referral code.
          </div>
        </div>
      </div>
    </footer>
  );
}
