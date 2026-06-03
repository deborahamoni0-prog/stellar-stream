import { reconcileMissingStreams } from "./streamStore";
import { logger } from "../logger";

let reconciliationInterval: NodeJS.Timeout | null = null;
let reconciliationInFlight = false;

async function runReconciliationCycle(): Promise<void> {
  if (reconciliationInFlight) {
    logger.warn("skipping reconciliation cycle because a previous run is still in progress");
    return;
  }

  reconciliationInFlight = true;
  try {
    await reconcileMissingStreams();
  } finally {
    reconciliationInFlight = false;
  }
}

export function startReconciliationJob(intervalMs = 60000): void {
  if (reconciliationInterval) {
    return;
  }

  logger.info({ intervalMs }, "reconciliation job started");

  reconciliationInterval = setInterval(() => {
    runReconciliationCycle().catch((err) => {
      logger.error({ err }, "reconciliation job cycle failed");
    });
  }, intervalMs);

  runReconciliationCycle().catch((err) => {
    logger.error({ err }, "initial reconciliation failed");
  });
}

export function stopReconciliationJob(): void {
  if (!reconciliationInterval) {
    return;
  }

  clearInterval(reconciliationInterval);
  reconciliationInterval = null;
  logger.info("reconciliation job stopped");
}
