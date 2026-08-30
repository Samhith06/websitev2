import { NextResponse } from 'next/server';
import { publicState, rotateSeed } from '@/lib/store/play';
import { requireUser } from '@/lib/player';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The commitment as it stands: the hash, the client seed, the next nonce. */
export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json(gate.refusal, { status: gate.status });
  return NextResponse.json(await publicState(gate.user.id));
}

/**
 * Rotate. The old server seed is revealed in the response so every round played
 * on it can be recomputed — that is the whole point of the commitment.
 */
export async function POST(request: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json(gate.refusal, { status: gate.status });

  let clientSeed: string | undefined;
  try {
    const body = await request.json();
    clientSeed = typeof body.clientSeed === 'string' ? body.clientSeed : undefined;
  } catch {
    // Rotating without setting a new client seed is fine.
  }
  return NextResponse.json(await rotateSeed(gate.user.id, clientSeed));
}
