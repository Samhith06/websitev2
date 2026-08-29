import Link from 'next/link';
import { Display, Label } from '@/components/ui/typography';
import { Card } from '@/components/ui/surfaces';
import { LogoMark, PlatformMark } from '@/components/ui/marks';

type State = 'signed-out' | 'not-authorised' | 'unconfigured';

/**
 * What you see instead of the dashboard when you are not allowed in.
 *
 * The three states say different things on purpose. "Sign in" is an invitation;
 * "not authorised" is a dead end that still shows the id a moderator would need
 * to add you; "unconfigured" is the first-run case, where refusing without
 * explanation would just look broken.
 */
export function AdminGate({
  state,
  discordId,
  username,
  signIn,
}: {
  state: State;
  discordId?: string | null;
  username?: string | null;
  signIn?: () => Promise<void>;
}) {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-16">
      <Card className="w-full max-w-lg">
        <div className="p-7 lg:p-9">
          <div className="mb-6 flex items-center gap-3">
            <LogoMark size={32} />
            <Label>MattySpins admin</Label>
          </div>

          {state === 'signed-out' ? (
            <>
              <Display size="m" as="h1">Sign in to continue</Display>
              <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
                Admin access is tied to your Discord account. Sign in and, if your account is on the
                owner or moderator list, the dashboard opens straight away.
              </p>
              <form action={signIn} className="mt-7">
                <button
                  type="submit"
                  className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[6px] bg-discord text-[15px] font-medium text-white transition-[filter] duration-150 hover:brightness-110"
                >
                  <PlatformMark platform="discord" size={18} />
                  Sign in with Discord
                </button>
              </form>
            </>
          ) : null}

          {state === 'not-authorised' ? (
            <>
              <Display size="m" as="h1">Not an admin</Display>
              <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
                You are signed in as{' '}
                <span className="text-ink">{username ?? 'an unknown account'}</span>, but that
                account is not on the owner or moderator list.
              </p>
              <div className="mt-5 rounded-[6px] border border-line bg-surface-2 px-4 py-3.5">
                <Label className="mb-1.5">Your Discord ID</Label>
                <code className="block break-all font-mono text-[13px] text-brand">
                  {discordId ?? 'unknown'}
                </code>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  Send this to Matty. Adding it to <code className="text-ink-2">OWNER_DISCORD_IDS</code>{' '}
                  or <code className="text-ink-2">MOD_DISCORD_IDS</code> grants access on your next
                  request — no redeploy, no new login.
                </p>
              </div>
              <Link
                href="/"
                className="mt-6 inline-block text-[14px] text-brand underline underline-offset-2 hover:text-brand-dim"
              >
                Back to the site
              </Link>
            </>
          ) : null}

          {state === 'unconfigured' ? (
            <>
              <Display size="m" as="h1">No admins set</Display>
              <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">
                Nobody has been named as an owner or moderator yet, so nothing can open the
                dashboard — including you.
              </p>
              <div className="mt-5 rounded-[6px] border border-gold-line bg-gold-bg px-4 py-3.5">
                <Label className="mb-1.5 text-gold/70">Your Discord ID</Label>
                <code className="block break-all font-mono text-[13px] text-gold">
                  {discordId ?? 'unknown'}
                </code>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
                  Set <code className="text-ink">OWNER_DISCORD_IDS</code> to this value in the
                  environment and reload. Multiple ids are comma-separated.
                </p>
              </div>
              <Link
                href="/"
                className="mt-6 inline-block text-[14px] text-brand underline underline-offset-2 hover:text-brand-dim"
              >
                Back to the site
              </Link>
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
