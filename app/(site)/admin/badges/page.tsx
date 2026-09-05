import { rows } from '@/lib/db';
import { badgesFor } from '@/lib/store/badges';
import { evaluateBadges, type RuleReport } from '@/lib/store/badge-rules';
import { SweepBadgesButton } from '@/components/admin/AdminButtons';

export const metadata = { title: 'Badges' };
export const dynamic = 'force-dynamic';

/**
 * Badge definitions, and whether their rules can actually be evaluated.
 *
 * The criteria column is shown raw on purpose — staff editing these need to
 * see the actual rule, not a prettified summary of it that might be wrong.
 *
 * The "Rule" column beside it is the addition that matters. Criteria were data
 * from the first migration and read by nothing, so the screen could show a
 * badge as defined while nobody could ever earn it. Now every row says whether
 * its rule ran, how many people it matched, or exactly what it could not read
 * — a wager rule with no Razed snapshot behind it says so rather than looking
 * like a rule nobody qualifies for.
 */
export default async function AdminBadgesPage() {
  const [badges, holders] = await Promise.all([
    badgesFor(null),
    rows<{ badge_id: string; n: string }>(
      'SELECT badge_id::text, COUNT(*)::text AS n FROM user_badges GROUP BY badge_id',
    ),
  ]);

  const counts = new Map(holders.map((h) => [Number(h.badge_id), Number(h.n)]));

  const criteria = await rows<{ id: string; criteria: Record<string, unknown> }>(
    'SELECT id::text, criteria FROM badges',
  );
  const criteriaById = new Map(criteria.map((c) => [Number(c.id), c.criteria]));

  // A dry read of the same rules the sweep runs. It awards nothing — the
  // screen reports what *would* happen, and the button is what makes it so.
  const report = await preview();
  const byslug = new Map(report.map((r) => [r.slug, r]));

  const blocked = report.filter((r) => r.status === 'no-data');

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">{badges.length} defined</span>
          <h1>Badges</h1>
          <div className="sh-sub">
            Criteria are data and evaluated by the rules below. The sweep only ever awards — taking
            a badge back is a deliberate act, logged with a name against it.
          </div>
        </div>
        <SweepBadgesButton />
      </div>

      {blocked.length > 0 ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(255,179,71,.35)' }}>
          <div className="small" style={{ color: 'var(--warn)' }}>
            {blocked.length} rule{blocked.length === 1 ? '' : 's'} cannot be evaluated yet:{' '}
            {blocked.map((r) => r.name).join(', ')}. These are not badges nobody has earned — they
            are badges nothing can currently check.
          </div>
        </div>
      ) : null}

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Badge</th>
              <th>Description</th>
              <th>Criteria</th>
              <th>Rule</th>
              <th>Holders</th>
            </tr>
          </thead>
          <tbody>
            {badges.map((badge) => (
              <tr key={badge.id}>
                <td>
                  <span className={`tag ${badge.gold ? 'gold' : 'blue'}`}>{badge.name}</span>
                </td>
                <td className="muted">{badge.description}</td>
                <td className="n" style={{ color: 'var(--muted)', fontSize: 11 }}>
                  {JSON.stringify(criteriaById.get(badge.id) ?? {})}
                </td>
                <td>
                  <RuleCell report={byslug.get(badge.slug)} />
                </td>
                <td className="n">{counts.get(badge.id) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Badges marked <b>manual</b> are only ever granted by hand — Founder, for instance, belongs
        to the first thirty accounts and no rule can recompute that after the fact. Everything else
        is re-checked by the sweep, which can be scheduled against{' '}
        <code>POST /api/badges/sweep</code> with the cron secret.
      </p>
    </>
  );
}

/**
 * Evaluating against an empty scope.
 *
 * `evaluateBadges([])` would fall through to "everybody", so the preview passes
 * an id that cannot exist: every rule runs and reports its status honestly,
 * matches nobody, and awards nothing. The alternative — a second, read-only
 * copy of all ten rules — is two things to keep in step, and the copy that
 * drifts is always the one the screen shows.
 */
async function preview(): Promise<RuleReport[]> {
  const { rules } = await evaluateBadges([-1]);
  return rules;
}

function RuleCell({ report }: { report: RuleReport | undefined }) {
  if (!report) return <span className="tag">—</span>;

  if (report.status === 'manual') {
    return <span className="tag">manual</span>;
  }
  if (report.status === 'no-data') {
    return (
      <span className="tag warn" title={report.detail}>
        no data
      </span>
    );
  }
  if (report.status === 'unknown-kind') {
    return (
      <span className="tag red" title={report.detail}>
        unknown rule
      </span>
    );
  }
  return <span className="tag green">automatic</span>;
}
