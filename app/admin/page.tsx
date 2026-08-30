import Link from 'next/link';
import { coins, maybe, money, relativeTime } from '@/lib/format';
import { siteStats, stream, weeklyPeriod } from '@/lib/mock';
import { fetchRazedLeaderboard, healthFrom } from '@/lib/razed';
import { databaseHealth, hasDatabase, rows } from '@/lib/db';
import { coinFlow } from '@/lib/store/coins';
import { roundsToday } from '@/lib/store/play';
import { earnersNow, lastTickAt } from '@/lib/store/presence';
import { userCount } from '@/lib/store/accounts';
import { AdminHeader } from '@/components/admin/AdminShell';
import { StatusPill } from '@/components/admin/Table';
import { Card, Hairlines, Stat } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import { ButtonLink } from '@/components/ui/controls';
import { RazedZ } from '@/components/ui/marks';

export const metadata = { title: 'Overview' };

/**
 * Four things and nothing else (UI Spec §15). Resist adding charts — this page
 * exists to answer "is anything broken and does anything need me", and every
 * extra element makes that slower.
 */
export const dynamic = 'force-dynamic';

type AuditRow = { id: string; admin_name: string; action: string; target: string; created_at: Date };

export default async function AdminOverview() {
  // Every figure on this page is a real query or an em dash. A green light
  // nobody checked is worse than no light at all, and an invented number on
  // the screen you use to spot problems is worse than both.
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const [feed, db, flow, rounds, earning, members, tickedAt, auditLog] = await Promise.all([
    fetchRazedLeaderboard({
      from: weeklyPeriod.startsAt.slice(0, 10),
      to: weeklyPeriod.endsAt.slice(0, 10),
    }),
    databaseHealth(),
    hasDatabase() ? coinFlow(weekStart) : Promise.resolve(null),
    hasDatabase() ? roundsToday() : Promise.resolve(null),
    hasDatabase() ? earnersNow() : Promise.resolve(null),
    hasDatabase() ? userCount() : Promise.resolve(null),
    hasDatabase() ? lastTickAt() : Promise.resolve(null),
    hasDatabase()
      ? rows<AuditRow>(
          `SELECT id::text, admin_name, action, target, created_at
             FROM audit_log ORDER BY created_at DESC LIMIT 10`,
        )
      : Promise.resolve([] as AuditRow[]),
  ]);

  const feedHealth = healthFrom(feed);
  const minted = flow?.minted ?? null;
  const destroyed = flow?.destroyed ?? null;
  // A tick inside the last ten minutes means the job is running.
  const ticking = Boolean(tickedAt && Date.now() - new Date(tickedAt).getTime() < 10 * 60_000);

  return (
    <>
      <AdminHeader
        title="Overview"
        eyebrow={`Today · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`}
      />

      <Hairlines cols="grid-cols-2 lg:grid-cols-4">
        <Stat label="Coins minted this week" value={maybe(minted)} />
        <Stat
          label="Destroyed by the edge"
          value={maybe(destroyed)}
          sub="1% of everything wagered"
        />
        <Stat label="Earning right now" value={maybe(earning)} sub={`${maybe(members)} accounts`} />
        <Stat label="Rounds today" value={maybe(rounds)} />
      </Hairlines>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* --------------------------------------------------------- */}
        {/* The queue                                                 */}
        {/* --------------------------------------------------------- */}
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <Label>Redemption queue</Label>
            <ButtonLink href="/admin/redemptions" size="sm" variant="outline">
              Open the queue
            </ButtonLink>
          </div>
          <div className="p-4">
            {/* The shop has no tables yet, so this is a known nothing rather
                than a zero anyone should read as "all caught up". */}
            <div className="flex items-baseline gap-3">
              <Num tone="muted" className="text-[34px] leading-none">
                —
              </Num>
              <span className="text-[13.5px] text-muted">waiting on a moderator</span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              Redemptions are not stored yet. The shop is the next piece of work that needs a
              table; until it has one, nothing can queue here.
            </p>
          </div>
        </Card>

        {/* --------------------------------------------------------- */}
        {/* Feed health                                               */}
        {/* --------------------------------------------------------- */}
        <Card>
          <div className="border-b border-line px-4 py-3">
            <Label>Feed health</Label>
          </div>
          <div className="divide-y divide-line">
            <FeedRow
              name="Razed leaderboard"
              detail={`Synced ${relativeTime(feedHealth.lastSyncAt)} · ${feedHealth.code}`}
              tone={feedHealth.status === 'healthy' ? 'brand' : feedHealth.status === 'stale' ? 'gold' : 'danger'}
              status={feedHealth.status === 'healthy' ? 'Healthy' : feedHealth.status === 'stale' ? 'Stale' : 'Failing'}
              icon={<RazedZ size={14} />}
            />
            <FeedRow
              name="Kick webhook"
              detail={stream.live ? 'Live · chat events arriving' : 'Idle · stream offline'}
              tone={stream.live ? 'brand' : 'muted'}
              status={stream.live ? 'Receiving' : 'Idle'}
            />
            <FeedRow
              name="Coin tick job"
              detail={
                tickedAt
                  ? `Last tick ${relativeTime(tickedAt)}`
                  : 'No tick recorded — the scheduler has never called /api/kick/tick'
              }
              tone={ticking ? 'brand' : 'gold'}
              status={ticking ? 'Ticking' : 'Idle'}
            />
            <FeedRow
              name="Database"
              detail={db.ok ? `Connected · ${db.latencyMs}ms` : db.detail}
              tone={db.ok ? 'brand' : 'danger'}
              status={db.ok ? 'Connected' : 'Missing'}
            />
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Coin flow — the number Matty actually needs                   */}
      {/* ------------------------------------------------------------- */}
      <Card className="mt-4">
        <div className="border-b border-line px-4 py-3">
          <Label>Coin flow this week</Label>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-3 [&>div]:bg-surface">
          <div className="px-4 py-4">
            <Label className="mb-2">Minted by watching</Label>
            <Num tone="brand" className="text-[24px]">
              {maybe(minted, (n) => `+${coins(n)}`)}
            </Num>
          </div>
          <div className="px-4 py-4">
            <Label className="mb-2">Destroyed by the edge</Label>
            <Num tone="gold" className="text-[24px]">
              {maybe(destroyed, (n) => `−${coins(n)}`)}
            </Num>
          </div>
          <div className="px-4 py-4">
            <Label className="mb-2">Net into circulation</Label>
            <Num className="text-[24px]">
              {minted !== null && destroyed !== null ? `+${coins(minted - destroyed)}` : '—'}
            </Num>
          </div>
        </div>
        <p className="border-t border-line px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          At 99% RTP the games are close to neutral, not a real sink. If coins inflate, pull the
          daily wager cap or nudge shop prices — never cut the advertised RTP.
        </p>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* Last ten audit entries                                        */}
      {/* ------------------------------------------------------------- */}
      <Card className="mt-4">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <Label>Last ten actions</Label>
          <Link href="/admin/audit" className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand hover:text-brand-dim">
            Full log
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {auditLog.length === 0 ? (
            <li className="px-4 py-6 text-[13.5px] text-muted">
              Nothing logged yet. Admin actions that change something are recorded here.
            </li>
          ) : null}
          {auditLog.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="font-mono text-[11.5px] tabular-nums text-faint">
                {relativeTime(entry.created_at.toISOString())}
              </span>
              <span className="text-[13.5px] text-ink">{entry.action}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{entry.target}</span>
              <span className="font-mono text-[11px] text-faint">{entry.admin_name}</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-6 max-w-2xl text-[12.5px] leading-relaxed text-muted">
        Paid out to date: {maybe(siteStats.paidOutToDate, money)} across every finalised period. Prize
        records live under Prizes and periods.
      </p>
    </>
  );
}

function FeedRow({
  name,
  detail,
  tone,
  status,
  icon,
}: {
  name: string;
  detail: string;
  tone: 'brand' | 'gold' | 'danger' | 'muted';
  status: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[14px] text-ink">
          {icon}
          {name}
        </p>
        <p className="mt-0.5 font-mono text-[11.5px] text-faint">{detail}</p>
      </div>
      <StatusPill tone={tone}>{status}</StatusPill>
    </div>
  );
}
