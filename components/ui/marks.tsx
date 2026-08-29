import Link from 'next/link';
import { cn } from '@/lib/cn';

/* -------------------------------------------------------------------------- */
/* The Matty Coin — UI Spec §0.5                                              */
/* -------------------------------------------------------------------------- */

/**
 * Three assets ship with the currency: a full-detail coin for hero and balance
 * use, a flat version for inline use beside numbers, and a single-colour
 * outline for places that need to inherit the text colour. They are inlined
 * here rather than loaded as images so the outline variant can do that.
 */
export function CoinMark({
  size = 16,
  variant = 'flat',
  className,
}: {
  size?: number;
  variant?: 'flat' | 'mono' | 'detail';
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    role: 'img' as const,
    'aria-label': 'Matty Coin',
    className: cn('inline-block shrink-0 align-[-0.15em]', className),
  };

  if (variant === 'mono') {
    return (
      <svg {...common} fill="none">
        <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8.3 15.6V9L12 13l3.7-4v6.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === 'detail') {
    return (
      <svg {...common}>
        <defs>
          <linearGradient id="coin-face" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFD98A" />
            <stop offset="0.45" stopColor="#FFB93B" />
            <stop offset="1" stopColor="#D18A16" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10.6" fill="#8A5A0C" />
        <circle cx="12" cy="12" r="10.4" fill="url(#coin-face)" />
        <circle cx="12" cy="12" r="8.1" fill="none" stroke="#B57612" strokeWidth="1.1" opacity="0.7" />
        <path
          d="M8.1 15.9V8.6L12 12.9l3.9-4.3v7.3"
          fill="none"
          stroke="#3A2A08"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10.4" fill="#FFB93B" />
      <circle cx="12" cy="12" r="8.1" fill="none" stroke="#B57612" strokeWidth="1.1" opacity="0.7" />
      <path
        d="M8.1 15.9V8.6L12 12.9l3.9-4.3v7.3"
        fill="none"
        stroke="#3A2A08"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A coin figure: the mark, then the number, then MC. Never the word "points". */
export function CoinAmount({
  amount,
  size = 'md',
  tone = 'ink',
  className,
  showUnit = true,
}: {
  amount: number;
  size?: 'sm' | 'md' | 'lg' | 'display';
  tone?: 'ink' | 'brand' | 'gold' | 'danger' | 'muted';
  className?: string;
  showUnit?: boolean;
}) {
  const sizes = {
    sm: { text: 'text-[12.5px]', coin: 12, gap: 'gap-1' },
    md: { text: 'text-[15px]', coin: 15, gap: 'gap-1.5' },
    lg: { text: 'text-[22px]', coin: 20, gap: 'gap-2' },
    display: { text: 'text-[32px] lg:text-[38px] leading-none', coin: 30, gap: 'gap-2.5' },
  } as const;
  const tones = {
    ink: 'text-ink',
    brand: 'text-brand',
    gold: 'text-gold',
    danger: 'text-danger',
    muted: 'text-muted',
  } as const;
  const s = sizes[size];
  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <CoinMark size={s.coin} />
      <span className={cn('font-mono tabular-nums', s.text, tones[tone])}>
        {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount))}
        {showUnit ? <span className="ml-1 text-[0.7em] opacity-70">MC</span> : null}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* MattySpins wordmark                                                        */
/* -------------------------------------------------------------------------- */

export function LogoMark({ size = 38, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-[9px] bg-brand', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path
          d="M4.5 18.5V6.2l7.5 8 7.5-8v12.3"
          stroke="#04121F"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Wordmark({ className, markSize = 38 }: { className?: string; markSize?: number }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2.5', className)} aria-label="MattySpins, home">
      <LogoMark size={markSize} />
      <span className="display text-[19px] leading-none tracking-tight">
        <span className="text-ink">MATTY</span>
        <span className="text-brand">SPINS</span>
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Razed's marks — §1                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The Z mark: inline at 15–18px beside labels that say where data came from.
 * It reads as a provenance stamp, which is exactly the job.
 */
export function RazedZ({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Razed"
      className={cn('inline-block shrink-0 align-[-0.15em]', className)}
    >
      <rect x="1.5" y="1.5" width="21" height="21" rx="4" fill="#1B6FD8" />
      <path
        d="M7.6 7.4h9.1L8.2 16.6h8.6"
        stroke="#F2F7FF"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * The wordmark always appears inside its own dark plate. Razed's brand blue is
 * close to Matty's accent, and without the plate the page starts to read as
 * Razed's site rather than his.
 */
export function RazedWordmark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const pad = { sm: 'px-3 py-2', md: 'px-4 py-2.5', lg: 'px-6 py-4' }[size];
  const text = { sm: 'text-[13px]', md: 'text-[16px]', lg: 'text-[22px]' }[size];
  const mark = { sm: 14, md: 17, lg: 24 }[size];
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 rounded-[3px] border border-[#173252] bg-[#050C16]',
        pad,
        className,
      )}
    >
      <RazedZ size={mark} />
      <span className={cn('display tracking-[0.09em] text-[#E8F0FB]', text)}>RAZED</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Platform marks                                                             */
/* -------------------------------------------------------------------------- */

export function PlatformMark({ platform, size = 16, className }: { platform: string; size?: number; className?: string }) {
  const p = platform.toLowerCase();
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className: cn('inline-block shrink-0', className),
    'aria-hidden': true,
  };

  if (p === 'kick') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M3 3h5.4v5.4h2.7V5.7h2.7V3H19v7.5h-2.7v2.7h2.7V21h-5.2v-2.7h-2.7v-2.7H8.4V21H3V3Z" />
      </svg>
    );
  }
  if (p === 'youtube') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
      </svg>
    );
  }
  if (p === 'instagram') {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (p === 'x' || p === 'twitter') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5.1 21H2l7.3-8.3L2.4 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z" />
      </svg>
    );
  }
  if (p === 'discord') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M19.3 5.6A16 16 0 0 0 15.4 4.4l-.2.4a12 12 0 0 0-6.4 0l-.2-.4A16 16 0 0 0 4.7 5.6C2.2 9.3 1.5 12.9 1.9 16.4a16 16 0 0 0 4.8 2.4l.9-1.5a10 10 0 0 1-1.6-.8l.4-.3a11.4 11.4 0 0 0 9.8 0l.4.3a10 10 0 0 1-1.6.8l.9 1.5a16 16 0 0 0 4.8-2.4c.5-4-.7-7.6-2.4-10.8ZM8.5 14.3c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.7 1.9-1.7 1.9Zm7 0c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.7 1.9-1.7 1.9Z" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export const SOURCE_LABELS: Record<string, string> = {
  kick: 'Kick',
  youtube: 'YouTube',
  instagram: 'Instagram',
  x: 'X',
};
