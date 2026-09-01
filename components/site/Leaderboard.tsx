"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Crown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { RazedZ } from "@/components/ui/marks";
import { Num } from "@/components/ui/typography";
import type { LeaderboardRow } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Podium — UI Spec §22                                                       */
/* -------------------------------------------------------------------------- */

const METALS = {
  1: {
    badge: "bg-gold text-brand-ink",
    border: "border-gold/45",
    glow: "shadow-[0_0_34px_-8px_rgba(255,185,59,0.45)]",
    wash: "from-gold/[0.09]",
    amount: "text-gold",
    prize: "border-gold/35 bg-gold/[0.10] text-gold",
  },
  2: {
    badge: "bg-silver text-brand-ink",
    border: "border-[#39424F]",
    glow: "",
    wash: "from-silver/[0.06]",
    amount: "text-ink",
    prize: "border-line-2 bg-surface-2 text-ink-2",
  },
  3: {
    badge: "bg-bronze text-brand-ink",
    border: "border-[#3A2C1E]",
    glow: "",
    wash: "from-bronze/[0.08]",
    amount: "text-ink",
    prize: "border-line-2 bg-surface-2 text-ink-2",
  },
} as const;

/**
 * First place sits centred and raised, with the metal tint fading into the
 * surface behind it. The order is a desktop-only reorder — the DOM runs 1, 2, 3
 * so the stack on a phone reads first place first.
 */
export function Podium({
  rows,
  className,
  variant = "full",
}: {
  rows: LeaderboardRow[];
  className?: string;
  /**
   * `compact` is the home page's version, sitting in five of twelve columns
   * beside the table. Same three positions, same metals, but only the two
   * figures that fit: the name and the prize.
   */
  variant?: "full" | "compact";
}) {
  if (variant === "compact")
    return <CompactPodium rows={rows} className={className} />;

  const top = rows.slice(0, 3);

  const STEP = [
    { order: "md:order-2", lift: "md:-mt-6" },
    { order: "md:order-1", lift: "md:mt-4" },
    { order: "md:order-3", lift: "md:mt-4" },
  ];

  return (
    <div className={cn("grid gap-3 md:grid-cols-3 md:items-start", className)}>
      {top.map((row, index) => {
        const metal = METALS[row.rank as 1 | 2 | 3] ?? METALS[3];
        const step = STEP[index] ?? STEP[2];
        const first = row.rank === 1;

        return (
          <div key={row.rank} className={cn(step.order, step.lift)}>
            <div
              className={cn(
                "relative flex flex-col items-center rounded-[12px] border bg-gradient-to-b to-surface text-center",
                metal.border,
                metal.wash,
                metal.glow,
                first ? "px-5 py-7" : "px-5 py-6",
              )}
            >
              {first ? (
                <Crown
                  size={15}
                  className="absolute right-3.5 top-3.5 text-gold/70"
                  aria-label="Leader"
                />
              ) : null}

              <span
                className={cn(
                  "grid place-items-center rounded-[10px] font-mono font-bold tabular-nums",
                  metal.badge,
                  first ? "size-12 text-[24px]" : "size-10 text-[19px]",
                )}
              >
                {row.rank}
              </span>

              <p
                className={cn(
                  "mt-3 truncate font-semibold text-ink",
                  first ? "text-[17px]" : "text-[15px]",
                )}
              >
                {row.maskedUsername}
              </p>

              <span className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Wagered
              </span>
              <p
                className={cn(
                  "mt-1 font-mono font-medium tabular-nums",
                  metal.amount,
                  first ? "text-[26px]" : "text-[19px]",
                )}
              >
                {money(row.wagered)}
              </p>

              <span
                className={cn(
                  "mt-4 inline-flex items-center rounded-[6px] border px-3 py-1.5 font-mono text-[11.5px] tabular-nums",
                  metal.prize,
                )}
              >
                Prize: {money(row.prize)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The stepped version. First place is centred and sits highest, the metal
 * reads as a bar across the top of each card rather than a badge, and the
 * three cards carry a name and a prize and nothing else — the wagered totals
 * are one column over in the table.
 *
 * The DOM order is 1, 2, 3 so a screen reader reads the winner first; the
 * 2-1-3 arrangement is done with `order`.
 */
function CompactPodium({
  rows,
  className,
}: {
  rows: LeaderboardRow[];
  className?: string;
}) {
  const top = rows.slice(0, 3);

  const STEP: Record<number, string> = {
    1: "order-2",
    2: "order-1 pt-7",
    3: "order-3 pt-11",
  };

  return (
    <div className={cn("grid grid-cols-3 items-end gap-2.5", className)}>
      {top.map((row) => {
        const first = row.rank === 1;
        const metal = METALS[row.rank as 1 | 2 | 3] ?? METALS[3];
        const bar =
          { 1: "bg-gold", 2: "bg-silver", 3: "bg-bronze" }[
            row.rank as 1 | 2 | 3
          ] ?? "bg-bronze";

        return (
          <div key={row.rank} className={cn(STEP[row.rank] ?? "order-3 pt-11")}>
            <div
              className={cn(
                "relative flex flex-col items-center overflow-hidden rounded-[3px] border px-2.5 pb-3.5 pt-4 text-center",
                first
                  ? "border-gold-line bg-gold-bg"
                  : "border-line bg-surface",
                first && metal.glow,
              )}
            >
              <span
                className={cn("absolute inset-x-0 top-0 h-[3px]", bar)}
                aria-hidden
              />

              {first ? (
                <Crown
                  size={16}
                  className="mb-1 text-gold"
                  aria-label="Leader"
                />
              ) : null}

              <Num tone={first ? "gold" : "muted"} className="text-[11.5px]">
                #{row.rank}
              </Num>

              <p
                className={cn(
                  "mt-1.5 w-full truncate font-mono text-ink",
                  first ? "text-[14.5px] font-medium" : "text-[13px]",
                )}
              >
                {row.maskedUsername}
              </p>

              <span className="mt-2.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted">
                Prize
              </span>
              <Num
                tone={first ? "gold" : "ink"}
                className={cn(
                  "mt-0.5",
                  first ? "text-[17px] font-medium" : "text-[14px]",
                )}
              >
                {money(row.prize)}
              </Num>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Movement                                                                   */
/* -------------------------------------------------------------------------- */

function Movement({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
        new
      </span>
    );
  }
  if (value === 0) {
    return (
      <>
        <Minus size={14} className="text-faint" aria-hidden />
        <span className="sr-only">Unchanged</span>
      </>
    );
  }
  const up = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        up ? "text-brand" : "text-danger",
      )}
    >
      {up ? (
        <ArrowUp size={14} aria-hidden />
      ) : (
        <ArrowDown size={14} aria-hidden />
      )}
      <span className="sr-only">
        {up ? "Up" : "Down"} {Math.abs(value)}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

const COLS = "lg:grid-cols-[70px_1fr_90px_170px_110px]";
/** Without the movement column the four that remain get the width back. */
const COLS_NO_MOVEMENT = "lg:grid-cols-[64px_1fr_130px_110px]";

/**
 * Built from divs with table roles, not a table element, so the mobile
 * breakpoint can restructure it — a horizontally scrolling leaderboard on a
 * phone is a failed screen.
 *
 * Masking is applied server-side, never in the browser.
 */
export function BoardRows({
  rows,
  from = 4,
  className,
  showMovement = true,
  initialVisible,
  footer,
}: {
  rows: LeaderboardRow[];
  /** The podium already carries 1–3, so the table usually starts at 4. */
  from?: number;
  className?: string;
  showMovement?: boolean;
  /** Rows shown before "Load more" appears. Omit to show them all. */
  initialVisible?: number;
  /** A last row inside the table — the home page hangs "view full board" here. */
  footer?: React.ReactNode;
}) {
  const all = rows.filter((r) => r.rank >= from);
  const [expanded, setExpanded] = useState(false);
  if (all.length === 0) return null;

  const cols = showMovement ? COLS : COLS_NO_MOVEMENT;
  const limit = initialVisible ?? all.length;
  const visible = expanded ? all : all.slice(0, limit);
  const hasMore = all.length > visible.length;

  return (
    <div
      role="table"
      aria-label="Leaderboard positions"
      className={cn(
        "overflow-hidden rounded-[12px] border border-line bg-surface",
        className,
      )}
    >
      <div role="rowgroup">
        <div
          role="row"
          className={cn(
            "hidden border-b border-line bg-surface-2/60 lg:grid",
            cols,
          )}
        >
          <HeaderCell>Rank</HeaderCell>
          <HeaderCell>Username</HeaderCell>
          {showMovement ? (
            <HeaderCell className="text-center">Move</HeaderCell>
          ) : null}
          <HeaderCell className="text-right">Wagered</HeaderCell>
          <HeaderCell className="text-right">Prize</HeaderCell>
        </div>
      </div>

      <div role="rowgroup">
        {visible.map((row, index) => (
          <div
            key={row.rank}
            role="row"
            className={cn(
              "grid grid-cols-[40px_1fr_auto] items-center gap-x-3 border-b border-line px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-surface-2/50",
              "lg:gap-x-0 lg:px-0 lg:py-0",
              cols,
              index < 10 && "stagger-item",
            )}
          >
            <Cell className="font-mono text-[13.5px] tabular-nums text-muted">
              {row.rank}
            </Cell>

            <Cell className="min-w-0">
              <span className="flex items-center gap-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-bg text-[10px] font-semibold uppercase text-brand">
                  {row.maskedUsername.slice(0, 1)}
                </span>
                <span className="min-w-0 truncate text-[14px] text-ink">
                  {row.maskedUsername}
                </span>
              </span>
              {/* On mobile the wagered total moves to a second line. */}
              <span className="mt-1 block pl-[34px] font-mono text-[12px] tabular-nums text-muted lg:hidden">
                {money(row.wagered)} wagered
              </span>
            </Cell>

            {showMovement ? (
              <Cell className="hidden justify-center lg:flex">
                <Movement value={row.movement} />
              </Cell>
            ) : null}

            <Cell className="hidden text-right font-mono text-[14px] tabular-nums text-ink-2 lg:block">
              {money(row.wagered)}
            </Cell>

            <Cell className="text-right font-mono text-[14px] tabular-nums text-gold">
              {money(row.prize)}
            </Cell>
          </div>
        ))}
      </div>

      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full border-t border-line py-3.5 font-mono text-[11.5px] uppercase tracking-[0.16em] text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-brand"
        >
          Load more
        </button>
      ) : null}

      {footer ? <div className="border-t border-line">{footer}</div> : null}
    </div>
  );
}

function HeaderCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="columnheader" className={cn("px-4 py-2.5", className)}>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {children}
      </span>
    </div>
  );
}

function Cell({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="cell" className={cn("lg:px-4 lg:py-3.5", className)}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Provenance                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A self-linked design would put the viewer's own position here. Razed returns
 * a top-N list, so any claim from outside it is unverifiable — and an
 * unverifiable claim attached to prize money is fraud waiting to happen.
 *
 * This bar does more work than the row it replaces: it explains the absence
 * rather than leaving the viewer wondering why they cannot find themselves.
 */
export function ProvenanceRow({
  frozen = false,
  className,
}: {
  frozen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[12px] border border-brand-line bg-brand-bg",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2.5 px-4 py-3.5 text-center transition-colors duration-150 hover:bg-brand/[0.06]"
      >
        <RazedZ size={14} />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
          Every figure comes straight from Razed
        </span>
      </button>

      {open ? (
        <p className="border-t border-brand-line px-5 py-4 text-[13.5px] leading-relaxed text-ink-2">
          {frozen
            ? "The board is frozen for this period and the ranks are locked. If one of these positions is yours, open a claim and a moderator will check the name against Razed’s own figures before anything is paid."
            : "Nothing on this board is self-reported. Positions are Razed usernames rather than site accounts, so you will not find yourself listed here by your Discord name. When the period closes you claim your position by stating your Razed username, and a moderator verifies it against the frozen snapshot before any money moves."}
        </p>
      ) : null}
    </div>
  );
}
