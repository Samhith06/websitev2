'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Slot art that falls back to the slot's initials when the image does not
 * load. The art comes from casino CDNs we do not control, and some of those
 * links die — a broken-image icon is bad on the site and worse on stream.
 */
export function SlotArt({
  src,
  name,
  className,
  fallbackClassName,
  lazy = false,
}: {
  src: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
  lazy?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // A server-rendered image can fail before React is listening, and that
  // error event is not replayed — so check on mount whether it already has.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) {
    return (
      <span className={fallbackClassName ?? className} aria-hidden>
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      ref={ref}
      className={className}
      src={src}
      alt=""
      loading={lazy ? 'lazy' : undefined}
      onError={() => setFailed(true)}
    />
  );
}
