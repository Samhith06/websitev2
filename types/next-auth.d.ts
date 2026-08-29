import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      discordId?: string | null;
      discordUsername?: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
