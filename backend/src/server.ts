import { createApp } from "./app.js";
import { disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { startScanWorker, stopScanWorker } from "./scan/queue.js";
import { objectStorageMode } from "./services/object-storage.js";
import { logger } from "./utils/logger.js";

startScanWorker();
const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(
    { host: env.HOST, port: env.PORT, storage: objectStorageMode() },
    "Server listening",
  );
});
// Scanned answer-key OCR can run past a minute; don't drop the socket mid-parse.
server.requestTimeout = 10 * 60 * 1000;
server.headersTimeout = 10 * 60 * 1000 + 1000;

const shutdownTimeoutMs = 10_000;

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");

  server.close(() => {
    stopScanWorker()
      .catch(() => undefined)
      .finally(() => {
        disconnectDatabase().finally(() => process.exit(0));
      });
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, shutdownTimeoutMs).unref();
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  process.exit(1);
});
