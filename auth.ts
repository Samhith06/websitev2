import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';

/**
 * Discord sign-in (Master Plan §4, §14).
 *
 * The plan calls for Auth.js with database sessions so an account can be
 * revoked. There is no database yet, so this runs on JWT sessions in the
 * meantime — with one deliberate consequence handled: **no role is stored in
 * the token.** The token carries identity only, and `lib/admin.ts` decides
 * privileges from the Discord id on every request. Revoking an admin therefore
 * takes effect on the next request rather than when a token happens to expire.
 *
 * When Postgres lands, add the adapter and switch `strategy` to 'database'.
 * Nothing else here needs to change.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      // `identify` gives the id, username and avatar; `guilds` lets us require
      // membership of Matty's server once that check is turned on.
      authorization: 'https://discord.com/api/oauth2/authorize?scope=identify+guilds',
    }),
  ],
  /**
   * Required for self-hosting. Auth.js refuses unrecognised Host headers by
   * default, and Railway terminates TLS at a proxy, so the app never sees its
   * own public hostname. Set AUTH_URL to the deployed origin alongside this.
   */
  trustHost: true,
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, profile }) {
      // Key off the numeric Discord id, never the username — usernames change.
      if (profile?.id) token.discordId = String(profile.id);
      if (profile?.username) token.discordUsername = String(profile.username);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = (token.discordId as string) ?? null;
        session.user.discordUsername = (token.discordUsername as string) ?? session.user.name ?? null;
      }
      return session;
    },
  },
  pages: {
    // The default Auth.js screens are fine for now; a branded one comes with
    // the accounts work.
  },
});
