/**
 * Slot bingo's rules as pure functions: which squares make a line, how a
 * square is named, and whether a buy counts.
 *
 * Nothing here touches the database, so the store (deciding BINGO), the
 * pages and the overlay all agree on what a line is.
 */

export const BINGO_SIZES = [3, 4, 5] as const;

export type BingoLine = {
  kind: 'row' | 'col' | 'diag';
  /** Row or column number from 0; for diagonals, 0 is top-left to bottom-right. */
  index: number;
  positions: number[];
};

/** Rows, columns and both diagonals: 2n + 2 in all. */
export function allLines(size: number): BingoLine[] {
  const lines: BingoLine[] = [];
  const range = [...Array(size).keys()];
  for (const r of range) lines.push({ kind: 'row', index: r, positions: range.map((c) => r * size + c) });
  for (const c of range) lines.push({ kind: 'col', index: c, positions: range.map((r) => r * size + c) });
  lines.push({ kind: 'diag', index: 0, positions: range.map((i) => i * size + i) });
  lines.push({ kind: 'diag', index: 1, positions: range.map((i) => i * size + (size - 1 - i)) });
  return lines;
}

/** The lines every one of whose squares is green. */
export function completedLines(size: number, green: Iterable<number>): BingoLine[] {
  const set = new Set(green);
  return allLines(size).filter((line) => line.positions.every((p) => set.has(p)));
}

/** "B3": column letter, row number, the way a square is read out on stream. */
export function cellLabel(position: number, size: number): string {
  return `${String.fromCharCode(65 + (position % size))}${Math.floor(position / size) + 1}`;
}

export function lineLabel(line: BingoLine, size: number): string {
  if (line.kind === 'row') return `row ${line.index + 1}`;
  if (line.kind === 'col') return `column ${String.fromCharCode(65 + line.index)}`;
  return line.index === 0
    ? `diagonal ${cellLabel(0, size)}–${cellLabel(size * size - 1, size)}`
    : `diagonal ${cellLabel(size - 1, size)}–${cellLabel(size * (size - 1), size)}`;
}

/** A buy wins its square when it pays back more than it cost. Breaking even is not profit. */
export function isProfit(buyCost: number, payout: number): boolean {
  return payout > buyCost;
}
