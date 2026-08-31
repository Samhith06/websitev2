-- Operational switches that must survive a restart and take effect without a
-- deploy (Master Plan §11, §38).
--
-- The kill switch was a constant in a source file, which meant two things: it
-- could only be changed by shipping code, and — worse — it was checked in the
-- lobby but not in the play endpoint. An emergency switch that leaves the API
-- accepting bets is not a switch.

CREATE TABLE IF NOT EXISTS settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value, updated_by)
VALUES ('games_killed', 'false'::jsonb, 'migration')
ON CONFLICT (key) DO NOTHING;

/* Per-game availability. The maths — RTP, paytables — deliberately stays in
   code and version control: it is verified by `npm run check:rtp`, and a hand
   edit here would silently make the advertised 99% untrue. */
INSERT INTO settings (key, value, updated_by)
VALUES ('games_disabled', '[]'::jsonb, 'migration')
ON CONFLICT (key) DO NOTHING;
