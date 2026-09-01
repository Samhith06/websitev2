import type { Metadata, Viewport } from 'next';
import { Anton, Archivo, Barlow, JetBrains_Mono, Spectral } from 'next/font/google';
import './globals.css';

/** Three faces: a condensed display used only in uppercase, a workhorse sans,
 *  and a mono for every number (UI Spec §2). */
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton', display: 'swap' });
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-jetbrains', display: 'swap' });

/** Two more, used only by the blackjack table, which follows its own design:
 *  Archivo for its chrome and Spectral for every figure on the felt. */
const archivo = Archivo({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-archivo', display: 'swap' });
const spectral = Spectral({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-spectral', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://mattyspins.com'),
  title: {
    default: 'MattySpins — earn coins for watching, win a share of the weekly pot',
    template: '%s · MattySpins',
  },
  description:
    'The MattySpins community site. Earn Matty Coins by watching on Kick, spend them on giveaway entries, Discord perks and merch, and track the weekly Razed wager leaderboard.',
  openGraph: {
    type: 'website',
    siteName: 'MattySpins',
    title: 'MattySpins',
    description: 'Earn Matty Coins by watching. Weekly prizes straight from Razed.',
  },
  // Search engines stay out until the legal review in Master Plan §12 has
  // landed and the geo-block list is in place. Flip ALLOW_INDEXING to 'true'
  // in the environment to open it up.
  robots:
    process.env.ALLOW_INDEXING === 'true'
      ? { index: true, follow: true }
      : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#070B14',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${barlow.variable} ${jetbrains.variable} ${archivo.variable} ${spectral.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[110] focus:rounded-[3px] focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
