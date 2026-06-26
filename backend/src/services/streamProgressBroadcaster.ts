import { listStreams, calculateProgress, nowInSeconds } from "./streamStore";
import { broadcastStreamProgress } from "./websocket";
import { logger } from "../logger";

let broadcasterInterval: NodeJS.Timeout | null = null;
let broadcasterInFlight = false;

async function runBroadcastCycle(): Promise<void> {
  if (broadcasterInFlight) {
    return;
  }

  broadcasterInFlight = true;
  try {
    const streams = listStreams(false); // Only broadcast active streams
    const now = nowInSeconds();

    for (const stream of streams) {
      const progress = calculateProgress(stream, now);
      broadcastStreamProgress(stream.id, progress.vestedAmount, progress.percentComplete);
    }

    if (streams.length > 0) {
      logger.debug({ streamCount: streams.length }, "broadcasted stream progress");
    }
  } catch (err) {
    logger.error({ err }, "stream progress broadcast cycle failed");
  } finally {
    broadcasterInFlight = false;
  }
}

export function startStreamProgressBroadcaster(intervalMs = 5000): void {
  if (broadcasterInterval) {
    return;
  }

  logger.info({ intervalMs }, "stream progress broadcaster started");

  broadcasterInterval = setInterval(() => {
    runBroadcastCycle().catch((err) => {
      logger.error({ err }, "broadcast cycle error");
    });
  }, intervalMs);
}

export function stopStreamProgressBroadcaster(): void {
  if (!broadcasterInterval) {
    return;
  }

  clearInterval(broadcasterInterval);
  broadcasterInterval = null;
  logger.info("stream progress broadcaster stopped");
}
