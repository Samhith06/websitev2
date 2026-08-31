'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * The boundary that catches a render that threw.
 *
 * Without it a thrown error is a blank page in production, which is the worst
 * possible outcome: the visitor cannot tell whether the site is down, their
 * connection failed, or their account is gone.
 *
 * It deliberately does not print the error. A stack trace tells a visitor
 * nothing and can leak internals; the digest is enough to find it in the logs.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[render]', error);
  }, [error]);

  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-20">
      <div className="max-w-lg text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          Something broke
        </p>
        <h1 className="display mt-3 text-[38px] leading-none text-ink">
          This page did not load
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          Something on our side failed while building this page. Your account, your coins and your
          balance are untouched — nothing here was in the middle of changing them.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-[3px] bg-brand px-5 py-2.5 text-[14px] text-brand-ink transition-colors duration-150 hover:bg-brand-dim"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-[3px] border border-line bg-surface px-5 py-2.5 text-[14px] text-ink-2 transition-colors duration-150 hover:border-line-2 hover:text-ink"
          >
            Go home
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-6 font-mono text-[11px] tabular-nums text-faint">
            Reference {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
