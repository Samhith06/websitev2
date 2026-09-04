-- The named milestone ladder.
--
-- Tiers gain a name, because the ladder is presented as Rookie through Legend
-- rather than as a list of thresholds — "you are $8k from Grinder" is a
-- sentence people repeat in chat, and "$8k from tier 3" is not.

ALTER TABLE milestone_tiers
  ADD COLUMN IF NOT EXISTS name text;

/*
 * The new ladder, upserted on threshold rather than replacing the table.
 *
 * A tier that has been claimed is referenced by milestone_claims, so deleting
 * it would either break that foreign key or erase the record of a payout.
 * Thresholds that survive are updated in place; the ones that do not are
 * deactivated below, which hides them from the ladder while leaving every
 * existing claim intact and explicable.
 */
INSERT INTO milestone_tiers (threshold, reward, name, sort_order, active) VALUES
  (10000,   25,   'Rookie',      1, true),
  (25000,   50,   'Hustler',     2, true),
  (50000,   100,  'Grinder',     3, true),
  (100000,  150,  'High Roller', 4, true),
  (250000,  250,  'VIP',         5, true),
  (500000,  500,  'Elite',       6, true),
  (700000,  750,  'Diamond',     7, true),
  (1300000, 1000, 'Legend',      8, true)
ON CONFLICT (threshold) DO UPDATE
  SET reward     = EXCLUDED.reward,
      name       = EXCLUDED.name,
      sort_order = EXCLUDED.sort_order,
      active     = true;

-- Anything outside the new ladder stops being offered without being destroyed.
UPDATE milestone_tiers
   SET active = false
 WHERE threshold NOT IN (10000, 25000, 50000, 100000, 250000, 500000, 700000, 1300000);

-- Older rows predate the name column; give them one so nothing renders blank.
UPDATE milestone_tiers
   SET name = 'Tier ' || threshold::bigint
 WHERE name IS NULL;
