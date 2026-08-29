import { cn } from '@/lib/cn';

/** Major sections are separated by 72px (UI Spec §3). */
export function Section({
  children,
  className,
  id,
  bleed = false,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** A full-bleed band, bordered top and bottom, on a lifted ground. */
  bleed?: boolean;
}) {
  if (bleed) {
    return (
      <section id={id} className={cn('mt-[72px] border-y border-line bg-surface/40 py-[56px]', className)}>
        <div className="container-page">{children}</div>
      </section>
    );
  }
  return (
    <section id={id} className={cn('container-page mt-[72px]', className)}>
      {children}
    </section>
  );
}
