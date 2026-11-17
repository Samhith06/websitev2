import Link from 'next/link';
import { notFound } from 'next/navigation';
import { periodById } from '@/lib/store/periods';
import { money, periodLabel, relativeTime } from '@/lib/format';
import { PastStandings } from '@/components/site/PastStandings';

export const metadata = { title: 'Leaderboard history' };
export const dynamic = 'force-dynamic';

/**
 * One past board, every position, with real usernames — staff need them to
 * check a result or send a tip by hand.
 */
export default async function AdminHistoryBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d{1,15}$/.test(id)) notFound();
  const board = await periodById(Number(id));
  if (!board || !board.frozenStandings) notFound();

  const standings = board.frozenStandings;
  const label = periodLabel(board.startsAt, board.endsAt);
  const total = standings.reduce((sum, row) => sum + row.wagered, 0);
  const paid = standings.filter((row) => row.prize > 0).length;

  return (
    <>
      <Link href="/admin/history" className="small muted lb-back">
        ← All past boards
      </Link>
      <div className="sec-head">
        <div>
          <span className="eyebrow">
            {board.status}
            {board.frozenAt ? ` · frozen ${relativeTime(board.frozenAt)}` : ''}
          </span>
          <h1>{label}</h1>
          <div className="sh-sub">
            Final standings as stored when the board locked. Read-only.
          </div>
        </div>
        {board.status === 'paid' || board.status === 'archived' ? (
          <Link className="btn sm" href={`/leaderboard/${board.id}`} target="_blank">
            Public page
          </Link>
        ) : null}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kl">Players</div>
          <div className="kv">{standings.length.toLocaleString('en-GB')}</div>
          <div className="kd">wagered under the code</div>
        </div>
        <div className="kpi">
          <div className="kl">Total wagered</div>
          <div className="kv">{money(Math.round(total))}</div>
          <div className="kd">summed from the rows below</div>
        </div>
        <div className="kpi">
          <div className="kl">Prize pool</div>
          <div className="kv g">{board.pot ? money(board.pot) : '—'}</div>
          <div className="kd">{paid ? `${paid} paid places` : 'no prizes recorded'}</div>
        </div>
        <div className="kpi">
          <div className="kl">Winner</div>
          <div className="kv b" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {standings[0] ? (standings[0].username ?? standings[0].maskedUsername) : '—'}
          </div>
          <div className="kd">{standings[0] ? money(standings[0].wagered) : ''}</div>
        </div>
      </div>

      {standings.length === 0 ? (
        <div className="emptyq">This board was frozen with no rows.</div>
      ) : (
        <PastStandings rows={standings} reveal />
      )}
    </>
  );
}
