'use client';

/**
 * A one-line channel for "the balance just changed".
 *
 * The coin pill lives in the layout and is server-rendered, so it only knows
 * what the balance was when the page was built. Spending through a server
 * action revalidates and the pill catches up on its own — but a game round goes
 * to an API route, which the layout knows nothing about, so the number sat
 * stale until a reload.
 *
 * The server stays the source of truth: this only carries a figure the server
 * has already committed and returned, and any navigation re-reads it from the
 * database. Nothing here decides a balance, it only stops the header lying
 * about one between renders.
 */

const EVENT = 'ms:balance';

export function publishBalance(balance: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: balance }));
}

export function onBalance(handler: (balance: number) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => handler((event as CustomEvent<number>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
