import { cn } from "@/lib/cn";
import { compact, relativeTime } from "@/lib/format";
import { PlayerFrame } from "./PlayerFrame";
import type { Clip } from "@/lib/types";

/**
 * A fixed-width card that does not flex (UI Spec §24): thumbnail with a centred
 * play glyph, source chip and duration in opposite corners, then the title and
 * the age and views in faint mono.
 */
export function ClipCard({
  clip,
  className,
}: {
  clip: Clip;
  className?: string;
}) {
  return (
    <article className={cn("flex flex-col", className)}>
      <PlayerFrame
        thumbUrl={clip.thumbUrl}
        embedUrl={clip.embedUrl || clip.url}
        title={clip.title}
        aspect={clip.aspect}
        source={clip.source}
        durationSeconds={clip.durationSeconds}
        playSize={48}
      />
      <h3 className="mt-3 text-[15.5px] font-semibold leading-snug text-ink">
        {clip.title}
      </h3>
      <p className="mt-1.5 font-mono text-[11.5px] tabular-nums text-faint">
        {relativeTime(clip.occurredAt)}
        {clip.views ? ` · ${compact(clip.views)} views` : ""}
      </p>
    </article>
  );
}

/**
 * A horizontally scrolling flex row with scroll-snap. No carousel library —
 * native scrolling gives momentum on touch, arrow keys and accessibility for
 * free. The container's padding matches the page gutter so the first card lines
 * up with the heading above it.
 */
export function ClipCarousel({
  clips,
  label,
}: {
  clips: Clip[];
  label: string;
}) {
  return (
    <div
      className="no-scrollbar -mx-[18px] flex snap-x snap-mandatory gap-4 overflow-x-auto px-[18px] pb-1 lg:-mx-[56px] lg:px-[56px]"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {clips.map((clip, index) => (
        <ClipCard
          key={clip.id}
          clip={clip}
          className={cn(
            "w-[210px] shrink-0 snap-start lg:w-[300px]",
            index < 10 && "stagger-item",
          )}
        />
      ))}
    </div>
  );
}
