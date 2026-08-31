/** Admin's own loading state — denser, matching the shell it appears inside. */
export default function Loading() {
  return (
    <div aria-busy aria-label="Loading">
      <div className="mb-5 h-3 w-32 animate-pulse rounded-[2px] bg-surface-2" />
      <div className="mb-6 h-8 w-56 animate-pulse rounded-[3px] bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-[3px] border border-line bg-surface" />
        ))}
      </div>
      <div className="mt-5 space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-[3px] border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
