import { cn } from '@/lib/cn';

/**
 * A bordered pill (UI Spec §21). Live: a blue dot with a soft glow, pulsing
 * slowly, LIVE NOW in mono blue on a tinted ground. Offline: a faint dot, no
 * glow, plain border. The pulse stops entirely for reduced-motion, which the
 * global stylesheet handles.
 */
export function LiveBadge({ live, className, compact = false }: { live: boolean; className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-[3px] border font-mono uppercase tracking-[0.16em]',
        compact ? 'h-7 px-2 text-[10px]' : 'h-9 px-3 text-[11px]',
        live ? 'border-online-line bg-online-bg text-online' : 'border-line bg-surface text-faint',
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          live ? 'animate-pulse-online bg-online' : 'bg-faint',
        )}
        aria-hidden
      />
      {live ? 'Live now' : 'Offline'}
    </span>
  );
}
