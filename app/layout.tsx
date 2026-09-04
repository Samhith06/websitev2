import type { Metadata, Viewport } from 'next';
import { Archivo, Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from 'next/font/google';
import './globals.css';

/** Three faces carry the whole site: a squared display for headings and
 *  buttons, a workhorse sans for prose, and a mono for every figure. */
const chakra = Chakra_Petch({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-chakra',
  display: 'swap',
});
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

/** Two more, used only by the blackjack table, which follows its own design:
 *  Archivo for its chrome and Spectral for every figure on the felt. */
const archivo = Archivo({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-archivo', display: 'swap' });
const spectral = Spectral({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-spectral', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://mattyspins.com'),
  title: {
    default: 'MattySpins — the official community hub',
    template: '%s · MattySpins',
  },
  description:
    'Earn Matty Coins for watching on Kick, climb the monthly Razed wager leaderboard, claim lifetime milestones, and spend coins on raffles and the store. Live every day at 7pm UK.',
  openGraph: {
    type: 'website',
    siteName: 'MattySpins',
    title: 'MattySpins',
    description: 'Earn coins for watching. Monthly leaderboard prizes tipped straight from Razed.',
  },
  // Search engines stay out until the legal review has landed and the
  // geo-block list is in place. Flip ALLOW_INDEXING to 'true' to open it up.
  robots:
    process.env.ALLOW_INDEXING === 'true'
      ? { index: true, follow: true }
      : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#050507',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${chakra.variable} ${plexSans.variable} ${plexMono.variable} ${archivo.variable} ${spectral.variable}`}
    >
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[400] focus:rounded-lg focus:bg-blue focus:px-4 focus:py-2 focus:text-[#03181f]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
