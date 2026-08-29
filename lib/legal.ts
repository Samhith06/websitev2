/**
 * Shared facts for the four legal pages.
 *
 * Everything a lawyer will want to change lives here rather than being typed
 * into four documents, so a correction is one edit and cannot land in three
 * places out of four.
 *
 * These documents are DRAFTS. They were written from the decisions recorded in
 * the Master Plan, not by a solicitor, and Master Plan §12 lists legal review
 * as blocking before launch. `LEGAL_REVIEWED` gates a visible banner saying so
 * on every page — flip it only once counsel has actually signed the text off.
 */
export const LEGAL_REVIEWED = false;

/**
 * The operator is Matty personally (Master Plan §12) — his name on the terms,
 * the giveaway rules and the prize records, and the liability is personal.
 * Counsel may advise incorporating; if so, this is the line that changes, and
 * every set of rules has to be re-issued.
 */
export const OPERATOR = {
  name: 'Matthew [SURNAME — TO CONFIRM]',
  tradingAs: 'MattySpins',
  /** A real, postal address is required. A PO box is usually acceptable. */
  address: '[CONTACT ADDRESS — TO CONFIRM]',
  email: '[CONTACT EMAIL — TO CONFIRM]',
  entity: 'an individual trading as MattySpins',
};

export const LAST_UPDATED = '2026-08-29';

/** The minimum age for the whole site. Counsel may raise this to 21 for some markets. */
export const MIN_AGE = 18;

/**
 * Territories where the games and giveaways must be blocked. Washington and
 * Idaho prohibit sweepstakes casinos outright today, and bills are moving
 * elsewhere. This list is a starting point for counsel, NOT a legal opinion,
 * and nothing enforces it in code yet.
 */
export const EXCLUDED_TERRITORIES = [
  'Washington (US)',
  'Idaho (US)',
  '[FURTHER TERRITORIES — TO CONFIRM WITH COUNSEL]',
];

/** Shown in the footer, on the responsible-play page and beside the games. */
export const HELPLINE = {
  name: 'BeGambleAware',
  url: 'https://www.begambleaware.org',
  phone: '0808 8020 133',
  region: 'United Kingdom',
};

export const GOVERNING_LAW = 'England and Wales [TO CONFIRM WITH COUNSEL]';

/** Coin rules, taken from Master Plan §3 so the terms cannot drift from the code. */
export const COIN_RULES = {
  inactivityExpiryDays: 90,
  prizeClaimWindowDays: 14,
  giveawayClaimWindowDays: 7,
  verificationHours: 72,
};
