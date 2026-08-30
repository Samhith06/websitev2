import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The deployment healthcheck, and deliberately the dumbest route in the app.
 *
 * It touches nothing — no database, no Razed, no session. That is the point:
 * this endpoint answers "is the server process up and serving?", which is the
 * only question a platform healthcheck should ask.
 *
 * Pointing the healthcheck at `/` instead would tie every deploy to Postgres
 * being reachable and to Razed answering, so a slow database on first boot
 * would roll back a release that was actually fine. Those belong on the admin
 * overview, where a human is asking a different question.
 */
export async function GET() {
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
