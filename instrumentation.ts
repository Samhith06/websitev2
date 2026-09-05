/**
 * The scheduler.
 *
 * Three jobs need to run on a timer: the coin tick, the Razed sync and the
 * badge sweep. Each already had an endpoint behind `CRON_SECRET`, and nothing
 * was calling them — so viewers only earned when somebody remembered, and the
 * leaderboard was only as fresh as the last button press.
 *
 * Railway's own cron cannot do this job. Its shortest interval is five minutes
 * and the coin tick is a three-minute tick; running it at five would quietly
 * re-rate the economy, paying a coin per five minutes instead of per three and
 * stretching the twenty-tick hour bonus from sixty minutes to a hundred. Its
 * schedules also live only in the dashboard, so they cannot be committed,
 * reviewed, or moved with the code.
 *
 * So the timers live here, in Next's instrumentation hook, which runs once when
 * the server starts.
 *
 * The jobs reach the work over HTTP on the loopback address rather than by
 * importing it. Calling the store functions directly reads better and was the
 * first attempt, but importing `lib/db` into the instrumentation bundle drags
 * `pg` in with it, and `pg` reaches for `fs` — which is not resolvable in that
 * bundle and takes the whole server down on boot. The endpoints already exist,
 * are already guarded, and are already tested; this calls them.
 *
 * Running two instances would double every call, and that is deliberately
 * harmless — each job refuses to run twice in quick succession, and those
 * guards are in the database rather than here:
 *
 *   /api/kick/tick     locks the open stream session and refuses a tick inside
 *                      the interval, so a second caller pays nobody twice.
 *   /api/razed/sync    refuses a sync less than eight minutes after the last.
 *   /api/badges/sweep  awards with ON CONFLICT DO NOTHING, so re-awarding is a
 *                      no-op rather than a duplicate row.
 *
 * Set `DISABLE_SCHEDULER=true` to switch it off — for an instance that should
 * not schedule, or to hand the job back to an external scheduler.
 */

/** Each job's path, interval in minutes, and delay before its first run. */
const JOBS = [
  /** Matches TICK_MINUTES. A tick paid late is a coin somebody did not earn. */
  { name: 'tick', path: '/api/kick/tick', everyMinutes: 3, firstRunAfterSeconds: 30 },
  /** The leaderboard's freshness. */
  { name: 'razed', path: '/api/razed/sync', everyMinutes: 10, firstRunAfterSeconds: 90 },
  /** Badges are not time-critical; this only has to beat somebody noticing. */
  { name: 'badges', path: '/api/badges/sweep', everyMinutes: 15, firstRunAfterSeconds: 150 },
] as const;

export async function register() {
  // The hook also runs for the edge runtime and during the production build.
  // Neither should start timers: the build would hold itself open, and the edge
  // runtime is not where this belongs.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  if (process.env.DISABLE_SCHEDULER === 'true') {
    console.log('[scheduler] disabled by DISABLE_SCHEDULER');
    return;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // The endpoints refuse without it, so scheduling would only produce a 503
    // every three minutes. Saying so once is more useful than that.
    console.warn('[scheduler] CRON_SECRET is not set — not scheduling anything');
    return;
  }

  // Loopback rather than the public domain: no DNS, no egress, no certificate,
  // and it works the same in a preview environment as in production.
  const base = process.env.SCHEDULER_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;

  console.log(
    `[scheduler] ${JOBS.map((j) => `${j.name} every ${j.everyMinutes}m`).join(', ')} via ${base}`,
  );

  for (const job of JOBS) {
    schedule(job, base, secret);
  }
}

type Job = (typeof JOBS)[number];

/**
 * Run one job on its interval, forever, without letting it take the server down
 * or overlap with itself.
 *
 * A throw inside a bare `setInterval` callback is an unhandled rejection, and
 * on Node that is a process exit — a failed sync would take the site with it.
 * The `running` flag matters for the same reason the tick locks its session
 * row: a job that overruns its interval must not have a second copy started on
 * top of it.
 *
 * Jobs are staggered rather than fired together so a cold start does not make
 * three requests in the same instant, on a server that is still warming up.
 */
function schedule(job: Job, base: string, secret: string): void {
  let running = false;

  const execute = async () => {
    if (running) {
      console.warn(`[scheduler] ${job.name} still running, skipping this turn`);
      return;
    }
    running = true;
    const startedAt = Date.now();
    try {
      const response = await fetch(`${base}${job.path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        console.error(`[scheduler] ${job.name} → ${response.status}`, body);
      } else if (worthLogging(job.name, body)) {
        console.log(`[scheduler] ${job.name}`, body, `(${Date.now() - startedAt}ms)`);
      }
    } catch (error) {
      console.error(`[scheduler] ${job.name} threw`, error);
    } finally {
      running = false;
    }
  };

  setTimeout(() => {
    void execute();
    const timer = setInterval(() => void execute(), job.everyMinutes * 60_000);
    // Never hold the process open on a timer's account; the server's own
    // listener is what should decide when Node may exit.
    timer.unref?.();
  }, job.firstRunAfterSeconds * 1_000).unref?.();
}

/**
 * Most turns are no-ops — the stream is not live, the sync ran recently,
 * nobody earned a badge. Logging those would bury the ones that did something
 * under hundreds of lines a day.
 */
function worthLogging(name: string, body: Record<string, unknown> | null): boolean {
  if (!body) return true;
  if (name === 'tick') return body.ran === true;
  if (name === 'razed') return body.ran === true || body.ok === false;
  if (name === 'badges') return typeof body.awarded === 'number' && body.awarded > 0;
  return true;
}
