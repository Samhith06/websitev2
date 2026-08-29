import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { discordInvite, socials } from '@/lib/mock';
import { Display, Label } from '@/components/ui/typography';
import { PlatformMark } from '@/components/ui/marks';

export const metadata: Metadata = {
  title: 'Official accounts',
  description:
    'The only real MattySpins accounts. Matty will never DM you first and will never ask you to deposit.',
};

const ACCOUNTS = [
  ...socials,
  { platform: 'Discord', handle: 'discord.gg/mattyspins', url: discordInvite },
];

/**
 * Deliberately plain, deliberately short (UI Spec §14). Someone reading this
 * page is checking whether they are being scammed, and it should feel like a
 * fact sheet.
 */
export default function OfficialPage() {
  return (
    <div className="container-page py-10 lg:py-14">
      <div className="max-w-3xl">
        <Label className="mb-3">Anti-impersonation</Label>
        <Display size="l" as="h1">
          Official accounts
        </Display>

        <p className="mt-6 text-[18px] font-semibold leading-relaxed text-ink">
          Matty will never DM you first and will never ask you to deposit.
        </p>

        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          These five accounts are the only ones he runs. Anything else using his name, his logo or
          his clips is not him, no matter how convincing it looks.
        </p>
      </div>

      <ul className="mt-10 max-w-3xl overflow-hidden rounded-[3px] border border-line">
        {ACCOUNTS.map((account) => (
          <li key={account.platform} className="border-b border-line last:border-b-0">
            <a
              href={account.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-surface px-5 py-5 transition-colors duration-150 hover:bg-surface-2"
            >
              <PlatformMark platform={account.platform} size={22} className="shrink-0 text-ink-2" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-ink">{account.platform}</span>
                <span className="mt-0.5 block truncate font-mono text-[14px] text-brand">
                  {account.handle}
                </span>
              </span>
              <ExternalLink size={16} className="shrink-0 text-faint" aria-hidden />
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-8 max-w-3xl space-y-3 text-[14px] leading-relaxed text-ink-2">
        <p>
          <span className="text-ink">If someone claiming to be Matty contacts you first,</span> it
          is a scam. Do not send money, do not send account details, and do not click anything they
          send you. Screenshot it and report it in the Discord.
        </p>
        <p>
          <span className="text-ink">If you are told you have won something,</span> check this site.
          Every giveaway winner is listed publicly on the giveaways page and every leaderboard prize
          is claimed here, never over DM. Nobody will ever ask you to pay a fee to release a prize.
        </p>
      </div>
    </div>
  );
}
