import { NextResponse } from 'next/server';
import { getSession, publicState, rotateSeed } from '@/lib/session';
import { NOT_SIGNED_IN, currentPlayerId } from '@/lib/player';

export const dynamic = 'force-dynamic';

/** The commitment as it stands: the hash, the client seed, the next nonce. */
export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) return NextResponse.json(NOT_SIGNED_IN, { status: 401 });
  return NextResponse.json(publicState(playerId));
}

/**
 * Rotate. The old server seed is revealed in the response so every round played
 * on it can be recomputed — that is the whole point of the commitment.
 */
export async function POST(request: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return NextResponse.json(NOT_SIGNED_IN, { status: 401 });

  let clientSeed: string | undefined;
  try {
    const body = await request.json();
    clientSeed = typeof body.clientSeed === 'string' ? body.clientSeed : undefined;
  } catch {
    // Rotating without setting a new client seed is fine.
  }
  return NextResponse.json(rotateSeed(getSession(playerId), clientSeed));
}
