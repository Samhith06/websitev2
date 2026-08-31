-- The coin shop (Master Plan §8, §13).
--
-- Coins have been earnable for a while with nothing to spend them on, which
-- breaks the loop the whole site is built around: watch, earn, spend.
--
-- Two rules shape these tables. A redemption records the cost **at the time it
-- was made**, so re-pricing an item tomorrow cannot rewrite what somebody paid
-- yesterday. And a redemption is only ever created in the same transaction that
-- debits the coins, so there is no state where one exists without the other.

CREATE TABLE IF NOT EXISTS shop_items (
  id            bigserial   PRIMARY KEY,
  name          text        NOT NULL,
  description   text        NOT NULL DEFAULT '',
  cost          integer     NOT NULL CHECK (cost > 0),
  -- 'entries' | 'discord' | 'merch' | 'stream'
  category      text        NOT NULL DEFAULT 'entries',
  -- NULL means unlimited. 0 means out of stock.
  stock         integer     CHECK (stock IS NULL OR stock >= 0),
  -- Days a member must wait before buying this one again. NULL means never.
  cooldown_days integer     CHECK (cooldown_days IS NULL OR cooldown_days > 0),
  /*
   * Whether a moderator has to act. Entries and Discord roles are granted
   * straight away; merch and on-stream items are reviewed, which is what the
   * shop already tells people.
   */
  needs_review  boolean     NOT NULL DEFAULT false,
  active        boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_items_listing_idx ON shop_items (active, sort_order, cost);

CREATE TABLE IF NOT EXISTS redemptions (
  id           bigserial   PRIMARY KEY,
  user_id      bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id      bigint      NOT NULL REFERENCES shop_items(id),
  -- Copied, not joined: the price then, not the price now.
  item_name    text        NOT NULL,
  cost         integer     NOT NULL,
  -- 'pending' | 'approved' | 'fulfilled' | 'rejected'
  status       text        NOT NULL DEFAULT 'pending',
  -- Size, address, chosen colour — whatever the item needs to be delivered.
  fulfilment   jsonb,
  handled_by   text,
  handled_at   timestamptz,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS redemptions_user_idx   ON redemptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS redemptions_queue_idx  ON redemptions (status, created_at);
CREATE INDEX IF NOT EXISTS redemptions_cooldown_idx ON redemptions (user_id, item_id, created_at DESC);

/* -------------------------------------------------------------------------- */
/* The launch catalogue (§3)                                                  */
/* -------------------------------------------------------------------------- */

INSERT INTO shop_items (name, description, cost, category, stock, cooldown_days, needs_review, sort_order)
SELECT * FROM (VALUES
  ('Weekly giveaway entry', 'One entry into this week''s draw. Enter as many times as the cap allows.', 50, 'entries', NULL::integer, NULL::integer, false, 1),
  ('Monthly draw entry', 'One entry into the monthly prize draw. Bigger pot, longer odds.', 150, 'entries', NULL, NULL, false, 2),
  ('Custom chat colour', 'Your name in the colour of your choice in Discord for 14 days.', 200, 'discord', NULL, 14, false, 3),
  ('Shoutout on stream', 'Matty reads your message out live. Keep it clean and he will read it.', 350, 'stream', 8, NULL, true, 4),
  ('High Roller role', 'The gold Discord role and its channels for 30 days.', 500, 'discord', NULL, 30, false, 5),
  ('Pick the next slot', 'You choose what he opens next. One pick, taken live.', 750, 'stream', 3, NULL, true, 6),
  ('Signed card deck', 'A deck signed by Matty, posted anywhere he can legally post it.', 1000, 'merch', 0, NULL, true, 7),
  ('MattySpins hoodie', 'Heavyweight, embroidered mark. Sizes S to XXL.', 1250, 'merch', 14, NULL, true, 8)
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM shop_items);
