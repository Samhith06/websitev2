/* -------------------------------------------------------------------------- */
/* Slot bingo                                                                 */
/* -------------------------------------------------------------------------- */

/*
 * How a bingo runs on stream:
 *
 *   1. The streamer starts a card (3×3 to 5×5). Every square starts open.
 *   2. Chat joins the pool with `!sr <slot>`.
 *   3. The site draws a random viewer from the pool and a random open square.
 *   4. The streamer bonus-buys that viewer's slot. If it pays more than the
 *      buy cost, the square turns green and belongs to that viewer. If not,
 *      the square stays open and the next viewer is drawn.
 *   5. The first full row, column or diagonal of green squares is BINGO, and
 *      the card ends. The viewers whose squares make up that line are each
 *      paid the card's prize; other green squares win nothing.
 *
 * Only one card is ever running, so `!sr` never has to say which one.
 */
CREATE TABLE IF NOT EXISTS bingo_cards (
  id              bigserial     PRIMARY KEY,
  title           text          NOT NULL,
  size            integer       NOT NULL CHECK (size BETWEEN 3 AND 5),
  -- MC paid to each viewer whose square is on the BINGO line, fixed when the card
  -- starts so nobody plays for one prize and is paid another.
  square_prize    integer       NOT NULL DEFAULT 0 CHECK (square_prize >= 0),
  -- 'running' | 'finished'
  status          text          NOT NULL DEFAULT 'running',
  requests_open   boolean       NOT NULL DEFAULT true,
  -- 'bingo' when a line ended it, 'stopped' when the streamer did.
  result          text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS bingo_cards_one_live_idx
  ON bingo_cards ((status = 'running')) WHERE status = 'running';

/*
 * The pool: one row per chatter per card, keyed on the numeric Kick id.
 *
 *   waiting → playing → won | lost        (or skipped, if the slot can't be played)
 *
 * A second !sr replaces a waiting one. A viewer who lost or was skipped can
 * !sr again and goes back to waiting; a viewer who won a square is done for
 * this card, and so is one whose turn is being played right now.
 */
CREATE TABLE IF NOT EXISTS bingo_entries (
  id              bigserial   PRIMARY KEY,
  card_id         bigint      NOT NULL REFERENCES bingo_cards(id) ON DELETE CASCADE,
  kick_user_id    text        NOT NULL,
  kick_username   text        NOT NULL,
  query           text        NOT NULL,
  slot_id         bigint      REFERENCES slots(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'waiting',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, kick_user_id)
);

CREATE INDEX IF NOT EXISTS bingo_entries_pool_idx ON bingo_entries (card_id, status);

/*
 * Every draw, kept as history: who was drawn, onto which square, with which
 * slot, and what the buy cost and paid. The slot is copied so editing the
 * catalog cannot rewrite a finished card.
 *
 * A green square is a turn with status 'won'; the partial unique indexes make
 * a square green at most once and allow only one turn in play at a time.
 */
CREATE TABLE IF NOT EXISTS bingo_turns (
  id              bigserial     PRIMARY KEY,
  card_id         bigint        NOT NULL REFERENCES bingo_cards(id) ON DELETE CASCADE,
  entry_id        bigint        REFERENCES bingo_entries(id) ON DELETE SET NULL,
  position        integer       NOT NULL CHECK (position >= 0),
  kick_user_id    text          NOT NULL,
  kick_username   text          NOT NULL,
  slot_id         bigint        REFERENCES slots(id) ON DELETE SET NULL,
  slot_name       text          NOT NULL,
  provider        text          NOT NULL DEFAULT '',
  image_url       text,
  -- 'playing' | 'won' | 'lost' | 'skipped'
  status          text          NOT NULL DEFAULT 'playing',
  buy_cost        numeric(12,2) CHECK (buy_cost > 0),
  payout          numeric(12,2) CHECK (payout >= 0),
  -- Filled in when the card ends and the square's prize is paid.
  paid_user_id    bigint        REFERENCES users(id) ON DELETE SET NULL,
  paid            integer       NOT NULL DEFAULT 0,
  drawn_at        timestamptz   NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS bingo_turns_card_idx ON bingo_turns (card_id, drawn_at);
CREATE UNIQUE INDEX IF NOT EXISTS bingo_turns_one_green_idx
  ON bingo_turns (card_id, position) WHERE status = 'won';
CREATE UNIQUE INDEX IF NOT EXISTS bingo_turns_one_playing_idx
  ON bingo_turns (card_id) WHERE status = 'playing';
