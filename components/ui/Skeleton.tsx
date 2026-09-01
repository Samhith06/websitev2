import { cn } from "@/lib/cn";

/**
 * Skeleton loading component for content placeholders
 */
export function Skeleton({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "text" | "title" | "circle" | "card";
}) {
  const variants = {
    default: "skeleton",
    text: "skeleton skeleton-text",
    title: "skeleton skeleton-title",
    circle: "skeleton rounded-full",
    card: "skeleton h-48",
  };

  return <div className={cn(variants[variant], className)} {...props} />;
}

/**
 * Skeleton for leaderboard rows
 */
export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-[3px] border border-line bg-surface p-4"
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for clip cards
 */
export function ClipCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[3px] border border-line"
        >
          <Skeleton className="aspect-video" />
          <div className="p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for game cards
 */
export function GameCardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[10px] border border-line"
        >
          <Skeleton className="aspect-square" />
          <div className="p-3">
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for stat cards
 */
export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface p-5">
          <Skeleton className="mb-2 h-3 w-1/2" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ))}
    </div>
  );
}
