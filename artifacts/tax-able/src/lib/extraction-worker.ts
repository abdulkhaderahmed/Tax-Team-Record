import { prisma } from "./prisma";

export interface ExtractionLease {
  id: string;
  lockedAt: Date;
  attemptCount: number;
}

export interface ExtractionWorkerOptions {
  leaseMs?: number;
  heartbeatMs?: number;
  maxAttempts?: number;
  retryBaseMs?: number;
}

const DEFAULT_LEASE_MS = 2 * 60_000;
const DEFAULT_HEARTBEAT_MS = 20_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 30_000;

export function extractionRetryDelayMs(
  attemptCount: number,
  baseMs = DEFAULT_RETRY_BASE_MS,
): number {
  return Math.min(baseMs * 2 ** Math.max(0, attemptCount - 1), 15 * 60_000);
}

/** Atomically claims one queued run or one whose worker lease has expired. */
export async function claimExtractionRun(
  options: ExtractionWorkerOptions = {},
): Promise<ExtractionLease | null> {
  const now = new Date();
  const staleBefore = new Date(
    now.getTime() - (options.leaseMs ?? DEFAULT_LEASE_MS),
  );
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const rows = await prisma.$transaction(
    (tx) =>
      tx.$queryRaw<ExtractionLease[]>`
      WITH candidate AS (
        SELECT id
        FROM "ExtractionRun"
        WHERE "attemptCount" < ${maxAttempts}
          AND (
            (
              status = 'Pending'
              AND "nextAttemptAt" <= ${now}
              AND "lockedAt" IS NULL
            )
            OR (
              status = 'Running'
              AND COALESCE("heartbeatAt", "lockedAt", "updatedAt") < ${staleBefore}
            )
          )
        ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE "ExtractionRun" AS run
      SET status = 'Running',
          "lockedAt" = ${now},
          "heartbeatAt" = ${now},
          "attemptCount" = run."attemptCount" + 1,
          "updatedAt" = ${now}
      FROM candidate
      WHERE run.id = candidate.id
      RETURNING run.id, run."lockedAt", run."attemptCount"
    `,
  );

  return rows[0] ?? null;
}

export async function heartbeatExtractionRun(
  lease: ExtractionLease,
): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE "ExtractionRun"
    SET "heartbeatAt" = ${new Date()}, "updatedAt" = ${new Date()}
    WHERE id = ${lease.id}
      AND status = 'Running'
      AND "lockedAt" = ${lease.lockedAt}
  `;
  return updated === 1;
}

export async function releaseExtractionRun(
  lease: ExtractionLease,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "ExtractionRun"
    SET "lockedAt" = NULL, "heartbeatAt" = NULL, "updatedAt" = ${new Date()}
    WHERE id = ${lease.id} AND "lockedAt" = ${lease.lockedAt}
  `;
}

export async function rescheduleExtractionRun(
  lease: ExtractionLease,
  error: unknown,
  options: ExtractionWorkerOptions = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const errorMessage = String(error).slice(0, 4_000);
  const now = new Date();

  if (lease.attemptCount >= maxAttempts) {
    await prisma.$executeRaw`
      UPDATE "ExtractionRun"
      SET status = 'Failed',
          "errorMessage" = ${errorMessage},
          "completedAt" = ${now},
          "lockedAt" = NULL,
          "heartbeatAt" = NULL,
          "updatedAt" = ${now}
      WHERE id = ${lease.id} AND "lockedAt" = ${lease.lockedAt}
    `;
    return;
  }

  const nextAttemptAt = new Date(
    now.getTime() +
      extractionRetryDelayMs(lease.attemptCount, options.retryBaseMs),
  );
  await prisma.$executeRaw`
    UPDATE "ExtractionRun"
    SET status = 'Pending',
        "errorMessage" = ${errorMessage},
        "nextAttemptAt" = ${nextAttemptAt},
        "lockedAt" = NULL,
        "heartbeatAt" = NULL,
        "updatedAt" = ${now}
    WHERE id = ${lease.id} AND "lockedAt" = ${lease.lockedAt}
  `;
}

/** Processes at most one persisted job. Returns false when no run was ready. */
export async function workOneExtractionRun(
  processRun: (runId: string) => Promise<void>,
  options: ExtractionWorkerOptions = {},
): Promise<boolean> {
  const lease = await claimExtractionRun(options);
  if (!lease) return false;

  const heartbeat = setInterval(() => {
    void heartbeatExtractionRun(lease);
  }, options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
  heartbeat.unref();

  try {
    await processRun(lease.id);
    await releaseExtractionRun(lease);
  } catch (error) {
    await rescheduleExtractionRun(lease, error, options);
  } finally {
    clearInterval(heartbeat);
  }

  return true;
}
