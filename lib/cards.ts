/**
 * A playing card, shared by the two card games.
 *
 * This lives on its own because blackjack and baccarat both need it and
 * neither should import the other's rules to get it — a baccarat coup has no
 * business pulling in split logic and a six-deck shoe, and `lib/fairness.ts`
 * needs the shape without either.
 *
 * Suits and ranks only. Every value a game reads off a card — blackjack's
 * ace-demoting total, baccarat's modulo ten — is derived by that game, because
 * the two disagree: a king is ten at one table and nothing at the other.
 */

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['S', 'H', 'D', 'C'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

/** A card is stored as rank + suit; everything else is derived. */
export type Card = { r: Rank; s: Suit };

export const isRed = (card: Card) => card.s === 'H' || card.s === 'D';

/** An unshuffled shoe of `decks` decks, in a fixed order. The shuffle is the
 *  caller's job, because only the caller holds the round's seeds. */
export function freshShoe(decks: number): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d += 1) {
    for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s });
  }
  return shoe;
}
