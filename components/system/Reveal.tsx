"use client";

import { useEffect, useRef } from 'react';

/**
 * Scroll entrances (Late Night §4).
 *
 * Children marked `data-r` arrive in sequence at 70ms steps. Two rules in
 * globals.css make this work and both are easy to break:
 *
 *   1. Start and end states are prefixed with the container class, so a later
 *      rule cannot silently cancel them.
 *   2. The stagger is RETIRED once the entrance finishes. `.rv.in.done` beats
 *      the nth-child delays it retires, because :nth-child counts as a class
 *      and a weaker rule would silently never apply, leaving every hover on
 *      the second and third card lagging by the stagger forever.
 *
 * Prove the retirement by hovering the second and third child after the
 * entrance ends.
 */
export function Reveal({
  children,
  className = '',
  as: Tag = 'div',
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'ul';
  once?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion: the CSS already shows the final state, so there is
    // nothing to observe and nothing to retire.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('in', 'done');
      return;
    }

    let retire: ReturnType<typeof setTimeout> | undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          if (!once) el.classList.remove('in', 'done');
          return;
        }
        el.classList.add('in');
        // longest delay (8 x 70ms) + the transition itself, then let go.
        retire = setTimeout(() => el.classList.add('done'), 490 + 620 + 60);
        if (once) io.disconnect();
      },
      { threshold: 0.15, rootMargin: '0px 0px -12% 0px' },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (retire) clearTimeout(retire);
    };
  }, [once]);

  return (
    // @ts-expect-error the ref type narrows per tag and every tag here is an element
    <Tag ref={ref} className={`rv ${className}`}>
      {children}
    </Tag>
  );
}
