-- Blackjack rounds (Master Plan §9).
--
-- Every other game settles in one request: one nonce, one outcome, done. A
-- blackjack hand spans several — deal, then hit or stand, maybe double or
-- split — so the round has to live somewhere between them, and it cannot live
-- in the browser or the player would be holding the cards.
--
-- What is stored is the *state*, never the shoe. The shoe is rebuilt from the
-- seed pair and nonce on every request, so the cards a round will deal are
-- fixed the moment it opens and can be recomputed by anybody afterwards. A
-- player who doubles cannot cause the dealer to be dealt something different.

CREATE TABLE IF NOT EXISTS blackjack_rounds (
  id              bigserial   PRIMARY KEY,
  user_id         bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed_pair_id    bigint      NOT NULL REFERENCES seed_pairs(id),
  nonce           integer     NOT NULL,
  -- The opening bets, and the live hand.
  bets            jsonb       NOT NULL,
  state           jsonb       NOT NULL,
  -- Grows when a hand doubles or splits.
  staked          integer     NOT NULL,
  returned        integer,
  idempotency_key text        NOT NULL,
  settled_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

/* One hand at a time. Two open rounds would mean two live shoes and a player
   able to pick whichever was going better. */
CREATE UNIQUE INDEX IF NOT EXISTS blackjack_one_open_idx
  ON blackjack_rounds (user_id) WHERE settled_at IS NULL;

/* A nonce is never reused on a seed pair — the verifier depends on it. */
CREATE UNIQUE INDEX IF NOT EXISTS blackjack_nonce_idx
  ON blackjack_rounds (seed_pair_id, nonce);

/* A double-tap on Deal is one hand, not two. */
CREATE UNIQUE INDEX IF NOT EXISTS blackjack_idem_idx
  ON blackjack_rounds (user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS blackjack_user_idx
  ON blackjack_rounds (user_id, created_at DESC);
