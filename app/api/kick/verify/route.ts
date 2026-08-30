import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/player';
import { issueVerificationCode, verificationStateFor } from '@/lib/store/accounts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The Kick verification code, issued and polled.
 *
 * The code is generated **here**, on the server, and stored before it is shown.
 * A code the browser invented would prove nothing: the whole mechanism rests on
 * the site knowing a value the viewer could not have guessed, then seeing that
 * exact value arrive from Kick with a user id attached.
 */

/** The card polls this while it waits, so the page updates without a refresh. */
export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json(gate.refusal, { status: gate.status });

  return NextResponse.json(await verificationStateFor(gate.user.id));
}

export async function POST() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json(gate.refusal, { status: gate.status });

  const existing = await verificationStateFor(gate.user.id);
  if (existing.status === 'linked') {
    return NextResponse.json(existing);
  }

  const issued = await issueVerificationCode(gate.user.id);
  return NextResponse.json({
    status: 'waiting',
    code: issued.code,
    expiresAt: issued.expiresAt,
  });
}
