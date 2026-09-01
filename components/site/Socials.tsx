import { ArrowUpRight } from 'lucide-react';
import { PlatformMark } from '@/components/ui/marks';

/**
 * The socials band. One card per platform, each carrying its own mark twice:
 * small and legible in the foreground, and blown up behind it as a blurred
 * watermark so a row of four reads as four distinct places rather than four
 * identical boxes.
 *
 * The list is `socials` from `lib/mock` — the same one the About card reads,
 * so a changed handle changes in both places at once.
 */
export function Socials({
  socials,
}: {
  socials: Array<{ platform: string; handle: string; url: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {socials.map((social) => (
        <a
          key={social.platform}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative isolate overflow-hidden rounded-[3px] border border-line bg-surface px-4 py-7 transition-colors duration-150 hover:border-brand-line hover:bg-surface-2"
        >
          {/* The watermark. Low enough to read as texture, not as a second
              logo, and it lifts rather than moves on hover. */}
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 text-brand opacity-[0.07] blur-[10px] transition-opacity duration-200 group-hover:opacity-[0.18]"
            aria-hidden
          >
            <PlatformMark platform={social.platform} size={172} />
          </span>

          <span className="absolute right-3 top-3 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" aria-hidden>
            <ArrowUpRight size={14} />
          </span>

          <span className="flex flex-col items-center gap-3 text-center">
            <PlatformMark
              platform={social.platform}
              size={26}
              className="text-ink transition-colors duration-150 group-hover:text-brand-dim"
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted transition-colors duration-150 group-hover:text-ink-2">
              {social.platform}
            </span>
            <span className="max-w-full truncate font-mono text-[11.5px] text-faint">
              {social.handle}
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
