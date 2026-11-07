import Link from 'next/link';
import { razed } from '@/lib/mock';
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
          <div className="fbrand">
            <span className="brand">
              <Logo />
              <span className="bt">
                MATTY<i>SPINS</i>
              </span>
            </span>
            <p>The official community hub. Live every day at 7pm UK on Kick. Official Razed partner.</p>
            <a
              className="fpartner"
              href={razed.affiliateUrl}
              target="_blank"
              rel="noreferrer noopener sponsored"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/razed.png" alt="Razed" width={110} height={38} />
              <span>Official partner</span>
            </a>
          </div>

          <div>
            <h4>Site</h4>
            <div className="flinks">
              <Link href="/leaderboard">Leaderboard</Link>
              <Link href="/milestones">Milestones</Link>
              <Link href="/games">Games</Link>
              <Link href="/raffles">Raffles</Link>
              <Link href="/store">Store</Link>
              <Link href="/hunt">Bonus hunt</Link>
              <Link href="/bingo">Slot bingo</Link>
              <Link href="/koth">King of the hill</Link>
              <Link href="/raid">Boss raid</Link>
              <Link href="/battle">Team battle</Link>
              <Link href="/tournament">Slot tournament</Link>
              <Link href="/slots">Slot catalog</Link>
              <Link href="/community">Clips &amp; wall of fame</Link>
              <Link href="/verify">Verify a round</Link>
            </div>
          </div>

          <div>
            <h4>Play responsibly</h4>
            <div className="flinks one">
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
        </div>

        <div className="rg">
          <div className="age">18+</div>
          <p>
            Gambling can be addictive — please play responsibly. This site is not a gambling
            operator: Matty Coins have no cash value and cannot be purchased. All dollar rewards are
            tipped directly by Razed. MattySpins earns a commission from signups made under the
            referral code.
          </p>
        </div>
      </div>
    </footer>
  );
}
