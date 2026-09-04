import { rows } from '@/lib/db';
import { listTiers } from '@/lib/store/milestones';
import { money } from '@/lib/format';
import { saveTierForm } from '@/app/(site)/admin/actions';

export const metadata = { title: 'Milestone tiers' };
export const dynamic = 'force-dynamic';

/**
 * The ladder, as data.
 *
 * Editing a tier needs no deploy, and never touches a claim that has already
 * been made — a claim froze its own reward and wager figure when it was
 * created, precisely so that retuning the ladder later cannot rewrite history.
 */
export default async function AdminMilestonesPage() {
  const [tiers, counts] = await Promise.all([
    listTiers(true),
    rows<{ tier_id: string; n: string }>(
      `SELECT tier_id::text, COUNT(*)::text AS n FROM milestone_claims GROUP BY tier_id`,
    ),
  ]);

  const claimed = new Map(counts.map((c) => [Number(c.tier_id), Number(c.n)]));

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Lifetime wager ladder</span>
          <h1>Milestone tiers</h1>
          <div className="sh-sub">
            Stored as data — editing a tier needs no deploy. Existing claims are never affected.
          </div>
        </div>
      </div>

      <div className="card">
        {tiers.map((tier, i) => (
          <form
            className="editrow"
            key={tier.id}
            action={saveTierForm}
            style={{ gridTemplateColumns: '60px 1fr 1fr auto auto' }}
          >
            <input type="hidden" name="id" value={tier.id} />
            <div className="er">T{i + 1}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="er">Wager $</span>
              <input
                className="inp s"
                style={{ width: 110 }}
                name="threshold"
                type="number"
                step="1"
                min="1"
                defaultValue={tier.threshold}
                aria-label={`Tier ${i + 1} threshold`}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="er">Reward $</span>
              <input
                className="inp s"
                style={{ width: 90 }}
                name="reward"
                type="number"
                step="1"
                min="0"
                defaultValue={tier.reward}
                aria-label={`Tier ${i + 1} reward`}
              />
            </div>

            <div className="er">{claimed.get(tier.id) ?? 0} claimed</div>
            <button className="btn sm">Save</button>
          </form>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Add a tier</h2>
        <form
          className="editrow"
          action={saveTierForm}
          style={{ gridTemplateColumns: '1fr 1fr auto', borderBottom: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="er">Wager $</span>
            <input
              className="inp s"
              name="threshold"
              type="number"
              step="1"
              min="1"
              required
              aria-label="New tier threshold"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="er">Reward $</span>
            <input
              className="inp s"
              name="reward"
              type="number"
              step="1"
              min="0"
              required
              aria-label="New tier reward"
            />
          </div>
          <button className="btn pri sm">Add tier</button>
        </form>
      </div>

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Total on the ladder as it stands: {money(tiers.reduce((sum, t) => sum + t.reward, 0))} per
        member who eventually reaches the top.
      </p>
    </>
  );
}
