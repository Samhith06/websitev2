import { cn } from "@/lib/cn";
import { coins, dateShort, formatMultiplier } from "@/lib/format";
import { Label } from "@/components/ui/typography";
import { PlayerFrame } from "./PlayerFrame";
import type { Clip } from "@/lib/types";

/**
 * The component the site is judged on (UI Spec §23). Two variants from one
 * definition.
 *
 * The three figures are the point. A multiplier alone is a boast; bet and
 * payout beside it are evidence, and evidence is what gets screenshotted into
 * other people's chats. The multiplier is always computed from the other two,
 * never stored as typed, so it can never disagree with them.
 */
export function BigWinCard({
  win,
  variant = "compact",
  className,
}: {
  win: Clip;
  variant?: "featured" | "compact";
  className?: string;
}) {
  const bet = win.bet ?? 0;
  const payout = win.payout ?? 0;
  const featured = variant === "featured";

  const overlay = featured ? (
    <span className="absolute left-4 top-4 text-left">
      <span className="block font-mono text-[10.5px] uppercase tracking-[0.18em] text-gold/80 [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
        Record holder
      </span>
      <span className="mt-1 block font-mono text-[40px] font-bold leading-none tabular-nums text-gold [text-shadow:0_3px_16px_rgba(0,0,0,0.95)] lg:text-[56px]">
        {formatMultiplier(bet, payout)}
      </span>
    </span>
  ) : (
    <span className="absolute left-3 top-3 font-mono text-[24px] font-bold leading-none tabular-nums text-ink [text-shadow:0_2px_12px_rgba(0,0,0,0.95)] lg:text-[30px]">
      {formatMultiplier(bet, payout)}
    </span>
  );

  return (
    <article
      className={cn("flex flex-col card-hover shadow-elevated", className)}
    >
      <PlayerFrame
        thumbUrl={win.thumbUrl}
        embedUrl={win.embedUrl || win.url}
        title={win.title}
        aspect={win.aspect}
        source={win.source}
        durationSeconds={win.durationSeconds}
        tone="gold"
        playSize={featured ? 82 : 46}
        overlay={overlay}
      />

      {/* Three hairline-divided cells at equal width. */}
      <div className="mt-px grid grid-cols-3 gap-px border-x border-b border-line bg-line [&>*]:bg-surface">
        <Figure label="Bet" value={coins(bet)} featured={featured} />
        <Figure
          label="Win"
          value={coins(payout)}
          featured={featured}
          tone="gold"
        />
        <Figure
          label={featured ? "Multiplier" : "Multi"}
          value={formatMultiplier(bet, payout)}
          featured={featured}
          tone="gold"
        />
      </div>

      <div
        className={cn(
          "flex items-baseline justify-between gap-4 border-x border-b border-line bg-surface px-4",
          featured ? "py-3.5" : "py-3",
        )}
      >
        <h3
          className={cn(
            "min-w-0 truncate font-semibold text-ink",
            featured ? "text-[16px]" : "text-[14px]",
          )}
        >
          {win.title}
        </h3>
        <p className="shrink-0 font-mono text-[11.5px] tabular-nums text-faint">
          {win.slotName} · {dateShort(win.occurredAt)}
        </p>
      </div>
    </article>
  );
}

function Figure({
  label,
  value,
  featured,
  tone = "ink",
}: {
  label: string;
  value: string;
  featured: boolean;
  tone?: "ink" | "gold";
}) {
  return (
    <div className={cn("px-4", featured ? "py-4" : "py-3")}>
      <Label className={featured ? "mb-2" : "mb-1.5 text-[10px]"}>
        {label}
      </Label>
      <span
        className={cn(
          "block font-mono font-medium leading-none tabular-nums",
          tone === "gold" ? "text-gold" : "text-ink",
          featured ? "text-[24px] lg:text-[30px]" : "text-[16px]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
