/**
 * Who is allowed into /admin, and as what.
 *
 * Roles are decided by Discord user id held in the environment, never by
 * anything carried in the session token. That distinction matters: the session
 * says *who you are*, this file says *what you may do*, and it is re-read on
 * every request. Removing an id from the list revokes access immediately —
 * there is no token to wait out and no cache to clear.
 *
 * Two roles, per Master Plan §11:
 *   owner — Matty. Everything, including prize tables, games config and RTP.
 *   mod   — redemptions, giveaways, clips, user lookup, freezing an account.
 *
 * When the database lands this moves to a column on `users`, and this file
 * becomes the seed for it.
 */
export type AdminRole = 'owner' | 'mod';

function idsFrom(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function ownerIds(): string[] {
  return idsFrom(process.env.OWNER_DISCORD_IDS);
}

export function modIds(): string[] {
  return idsFrom(process.env.MOD_DISCORD_IDS);
}

/**
 * Local review without a Discord app configured.
 *
 * This lives here, beside `roleFor`, rather than in the admin layout, because
 * the layout is not the only thing that asks "is this an admin" — every server
 * action does too, and a bypass that only the layout knew about produced a
 * screen you could open but not use. One answer, one place.
 *
 * The `NODE_ENV` check is the important half and is evaluated at build time, so
 * a production bundle cannot open it however the environment is set. It is
 * scaffolding, not a feature flag, and it comes out once sign-in works.
 */
export function devBypass(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_ADMIN_BYPASS === 'true';
}

/** Owner wins if an id somehow appears in both lists. */
export function roleFor(discordId: string | null | undefined): AdminRole | null {
  if (devBypass()) return 'owner';
  if (!discordId) return null;
  if (ownerIds().includes(discordId)) return 'owner';
  if (modIds().includes(discordId)) return 'mod';
  return null;
}

export function isAdmin(discordId: string | null | undefined): boolean {
  return roleFor(discordId) !== null;
}

/**
 * True when nobody has been named yet. The admin screens use this to explain
 * what to configure rather than just refusing, which is what you want the first
 * time you open it on a fresh deployment.
 */
export function noAdminsConfigured(): boolean {
  return ownerIds().length === 0 && modIds().length === 0;
}
