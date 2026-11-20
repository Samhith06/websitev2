import 'server-only';
import { auth } from '@/auth';
import { devBypass, roleFor, type AdminRole } from '@/lib/admin';

/**
 * The signed-in visitor's staff role, or null.
 *
 * Staff pages must call this themselves. The admin layout refuses outsiders,
 * but Next renders a layout and its page in parallel and still sends the
 * page's output with the response, so a check that lives only in the layout
 * hides the screen without withholding its data.
 */
export async function staffRole(): Promise<AdminRole | null> {
  if (devBypass()) return 'owner';
  const session = await auth();
  return roleFor(session?.user?.discordId ?? null);
}
