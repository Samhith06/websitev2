/**
 * Two formatters, written once and never inlined (UI Spec §0), plus the
 * multiplier — which is always derived from bet and payout, never stored as
 * typed, so it can never disagree with the two figures beside it.
 */

/** Money. No decimals except where cents actually matter. */
export function money(amount: number, currency = 'USD'): string {
  const hasCents = Math.abs(amount % 1) > 0.0001;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}

/** Coins. Thousands separators, never decimals. */
export function coins(amount: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount));
}

/** "1,250 MC" — the tight form used where space is short. */
export function mc(amount: number): string {
  return `${coins(amount)} MC`;
}

/** Derived, never typed. */
export function multiplier(bet: number, payout: number): number {
  if (!bet) return 0;
  return payout / bet;
}

export function formatMultiplier(bet: number, payout: number): string {
  const m = multiplier(bet, payout);
  if (m >= 100) return `${m.toFixed(0)}×`;
  if (m >= 10) return `${m.toFixed(1)}×`;
  return `${m.toFixed(2)}×`;
}

/**
 * A raw multiplier that is already a number (paytables, game results).
 *
 * Shown at full stored precision with trailing zeros trimmed, never rounded to
 * a shorter figure: a player comparing 14.97× against 15.0× is comparing the
 * paytable they were promised against one they were not, and on the tables
 * where the top tier is 482× the extra ".00" is noise, so it goes.
 */
export function mult(m: number): string {
  if (m === 0) return '0×';
  const fixed = m.toFixed(2);
  return `${fixed.replace(/\.?0+$/, '')}×`;
}

export function compact(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Masking is applied server-side, never in the browser (§22). */
export function maskUsername(name: string): string {
  if (name.length <= 3) return `${name[0]}***`;
  return `${name.slice(0, 3)}${'*'.repeat(Math.max(3, name.length - 4))}${name.slice(-1)}`;
}

const UTC: Intl.DateTimeFormatOptions = { timeZone: 'UTC' };

export function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { ...UTC, day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateRange(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  const f = from.toLocaleDateString('en-GB', { ...UTC, day: 'numeric', month: sameMonth ? undefined : 'short' });
  const t = to.toLocaleDateString('en-GB', { ...UTC, day: 'numeric', month: 'short' });
  return `${f} – ${t}`;
}

export function dateTime(iso: string): string {
  return `${new Date(iso).toLocaleString('en-GB', {
    ...UTC, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })} UTC`;
}

/** "4 minutes ago" — the leaderboard's credibility lives in this string. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** 8_100 → "2h 15m". Used by the ledger's aggregated watch rows. */
export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** mm:ss for clip durations. */
export function clipLength(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
