import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dateShort } from '@/lib/format';
import { LAST_UPDATED, LEGAL_REVIEWED } from '@/lib/legal';
import { Display, Label } from '@/components/ui/typography';

const PAGES = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/giveaway-rules', label: 'Giveaway rules' },
  { href: '/responsible', label: 'Responsible play' },
];

/**
 * One shell for all four legal documents: the same measure, the same heading
 * scale, the same cross-links, and the same draft notice while the text is
 * still unreviewed.
 */
export function LegalPage({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-page py-10 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:items-start">
        <nav aria-label="Legal documents" className="lg:sticky lg:top-[84px]">
          <Label className="mb-3">Legal</Label>
          <ul className="flex flex-wrap gap-1.5 lg:flex-col">
            {PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  aria-current={page.href === current ? 'page' : undefined}
                  className={cn(
                    'block rounded-[6px] px-3 py-2 text-[13.5px] transition-colors duration-150',
                    page.href === current
                      ? 'bg-brand-bg font-medium text-brand'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-[70ch]">
          {!LEGAL_REVIEWED ? (
            <div className="mb-8 flex items-start gap-3 rounded-[8px] border border-gold-line bg-gold-bg px-4 py-3.5">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
              <p className="text-[13px] leading-relaxed text-ink-2">
                <span className="text-gold">Draft — not yet reviewed by a solicitor.</span> This
                text was written from the site&rsquo;s own operating rules to give counsel something
                concrete to mark up. It is not legal advice and must not be relied on. Passages in
                square brackets are facts still to be confirmed.
              </p>
            </div>
          ) : null}

          <Label className="mb-3">Last updated {dateShort(LAST_UPDATED)}</Label>
          <Display size="l" as="h1">
            {title}
          </Display>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-2">{intro}</p>

          <div className="mt-10 space-y-9">{children}</div>

          <p className="mt-12 border-t border-line pt-6 text-[13px] leading-relaxed text-muted">
            Questions about any of this go to the contact address on the{' '}
            <Link href="/terms" className="text-brand underline underline-offset-2">terms page</Link>.
            The four documents are meant to be read together.
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Section({
  n,
  title,
  children,
  id,
}: {
  n?: number;
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="flex items-baseline gap-3 text-[19px] font-semibold text-ink">
        {n !== undefined ? (
          <span className="font-mono text-[13px] tabular-nums text-brand">{String(n).padStart(2, '0')}</span>
        ) : null}
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-brand" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A fact counsel still has to supply, marked so it cannot be missed. */
export function ToConfirm({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded-[3px] bg-gold/15 px-1.5 py-0.5 font-mono text-[13px] text-gold">
      {children}
    </mark>
  );
}
