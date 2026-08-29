import Link from 'next/link';
import { coins, money, relativeTime } from '@/lib/format';
import { adminStats, auditLog, feedHealth, redemptions, siteStats, stream } from '@/lib/mock';
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
export default function AdminOverview() {
  const pending = redemptions.filter((r) => r.status === 'pending');

  return (
    <>
      <AdminHeader
        title="Overview"
        eyebrow={`Today · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`}
      />

      <Hairlines cols="grid-cols-2 lg:grid-cols-4">
        <Stat label="Coins minted this week" value={coins(adminStats.coinsMintedThisWeek)} />
        <Stat
          label="Destroyed by the edge"
          value={coins(adminStats.coinsDestroyedThisWeek)}
          sub="2% of everything wagered"
        />
        <Stat label="Members earning" value={coins(siteStats.membersEarning)} />
        <Stat label="Rounds today" value={coins(adminStats.roundsToday)} />
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
            <div className="flex items-baseline gap-3">
              <Num tone={pending.length > 0 ? 'gold' : 'muted'} className="text-[34px] leading-none">
                {pending.length}
              </Num>
              <span className="text-[13.5px] text-muted">waiting on a moderator</span>
            </div>
            <ul className="mt-4 space-y-2">
              {pending.map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="min-w-0 truncate text-ink-2">
                    {r.itemName} <span className="text-faint">· {r.member}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-faint">
                    {relativeTime(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
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
              detail={stream.live ? 'Running every 3 minutes' : 'Paused while offline'}
              tone={stream.live ? 'brand' : 'muted'}
              status={stream.live ? 'Ticking' : 'Paused'}
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
              +{coins(adminStats.coinsMintedThisWeek)}
            </Num>
          </div>
          <div className="px-4 py-4">
            <Label className="mb-2">Destroyed by the edge</Label>
            <Num tone="gold" className="text-[24px]">
              −{coins(adminStats.coinsDestroyedThisWeek)}
            </Num>
          </div>
          <div className="px-4 py-4">
            <Label className="mb-2">Net into circulation</Label>
            <Num className="text-[24px]">
              +{coins(adminStats.coinsMintedThisWeek - adminStats.coinsDestroyedThisWeek)}
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
          {auditLog.slice(0, 10).map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="font-mono text-[11.5px] tabular-nums text-faint">
                {relativeTime(entry.createdAt)}
              </span>
              <span className="text-[13.5px] text-ink">{entry.action}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{entry.target}</span>
              <span className="font-mono text-[11px] text-faint">{entry.admin}</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-6 max-w-2xl text-[12.5px] leading-relaxed text-muted">
        Paid out to date: {money(siteStats.paidOutToDate)} across every finalised period. Prize
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
