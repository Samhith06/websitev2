/**
 * The shared loading state for public pages.
 *
 * Cold renders run to a couple of seconds because they wait on Postgres and, on
 * some pages, on Razed. Without this the browser holds the previous page and
 * then swaps, which reads as a click that did nothing.
 *
 * Deliberately shapes rather than a spinner: blocks at roughly the size of what
 * arrives mean the layout does not jump when it does.
 */
export default function Loading() {
  return (
    <div className="container-page py-10 lg:py-14" aria-busy aria-label="Loading">
      <div className="h-3 w-40 animate-pulse rounded-[2px] bg-surface-2" />
      <div className="mt-4 h-10 w-72 animate-pulse rounded-[3px] bg-surface-2" />

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[3px] border border-line bg-surface" />
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-[3px] border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
