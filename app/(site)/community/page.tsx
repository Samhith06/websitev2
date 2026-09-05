import Link from 'next/link';
import type { Metadata } from 'next';
import { publishedBigWins, publishedClips } from '@/lib/store/clips';
import { ClipCard } from '@/components/site/ClipCard';
import type { Clip } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Clips & wall of fame',
  description:
    'Clips from MattySpins across Kick, YouTube, Instagram and X, and every big win with the bet, the payout and the multiplier alongside it.',
};

export const dynamic = 'force-dynamic';

type View = 'clips' | 'fame';

/**
 * Clips and the wall of fame.
 *
 * The design fixes the top nav at six entries and has no room for either of
 * these, so they share one page reached from the home strip and the footer.
 * They belong together anyway: a big win *is* a clip, with three numbers
 * attached, and splitting them across two routes made people hunt for the one
 * they meant.
 */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const active: View = view === 'fame' ? 'fame' : 'clips';

  const [clips, wins] = await Promise.all([publishedClips(48), publishedBigWins(48)]);
  const shown = active === 'fame' ? wins : clips;

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Community</span>
          <h1>{active === 'fame' ? 'Wall of fame' : 'Clips'}</h1>
          <div className="sh-sub">
            {active === 'fame'
              ? 'Every big win, with the bet and the payout it came from.'
              : 'The best of the stream, across Kick, YouTube, Instagram and X.'}
          </div>
        </div>
      </div>

      <div className="tabs">
        <Link href="/community" className={active === 'clips' ? 'on' : ''} scroll={false}>
          Clips {clips.length ? `(${clips.length})` : ''}
        </Link>
        <Link href="/community?view=fame" className={active === 'fame' ? 'on' : ''} scroll={false}>
          Wall of fame {wins.length ? `(${wins.length})` : ''}
        </Link>
      </div>

      {shown.length === 0 ? (
        <div className="emptyq">
          {active === 'fame'
            ? 'No big wins published yet. They are added from the staff area as they happen.'
            : 'No clips published yet.'}
        </div>
      ) : (
        <div className="clips">
          {shown.map((item) => (
            <ClipCard key={item.id} clip={item} showWin={active === 'fame'} />
          ))}
        </div>
      )}

      <p className="small muted" style={{ marginTop: 22, maxWidth: '72ch' }}>
        Wins are posted with the bet and the payout they came from, not just the number that looked
        best. The losses are part of the stream too — a highlight reel with the bad nights cut out
        is not a real picture of what this is.
      </p>
    </>
  );
}

