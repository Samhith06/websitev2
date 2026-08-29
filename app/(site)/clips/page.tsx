import type { Metadata } from 'next';
import { clips } from '@/lib/mock';
import { Display, Label } from '@/components/ui/typography';
import { Chip, ChipRow } from '@/components/ui/controls';
import { EmptyState } from '@/components/ui/surfaces';
import { ClipCard } from '@/components/site/ClipCard';
import type { ClipSource } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Clips',
  description: 'Clips from MattySpins across Kick, YouTube, Instagram and X.',
};

const SOURCES: Array<{ value: ClipSource | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'kick', label: 'Kick' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
];

export default async function ClipsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source } = await searchParams;
  const active = (SOURCES.find((s) => s.value === source)?.value ?? 'all') as ClipSource | 'all';

  const published = clips.filter((c) => c.status === 'published');
  const visible = active === 'all' ? published : published.filter((c) => c.source === active);

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Label className="mb-3">{published.length} published</Label>
          <Display size="l" as="h1">
            Clips
          </Display>
        </div>

        <ChipRow label="Clip source">
          {SOURCES.map((s) => (
            <Chip
              key={s.value}
              as="link"
              href={s.value === 'all' ? '/clips' : `/clips?source=${s.value}`}
              active={active === s.value}
            >
              {s.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      {visible.length === 0 ? (
        <EmptyState className="mt-10" title="No clips from this source yet.">
          Kick clips are added by hand because Kick has no public clips endpoint. YouTube and
          Instagram sync automatically, but nothing reaches this page until a moderator publishes
          it — which is why it never fills up with filler.
        </EmptyState>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </div>
      )}

      <p className="mt-10 max-w-2xl text-[13.5px] leading-relaxed text-muted">
        Nothing on this page embeds until you click it. Each card holds a thumbnail and the player
        replaces it in place — three live embeds on one page is a six-megabyte page that stutters on
        a phone.
      </p>
    </div>
  );
}
