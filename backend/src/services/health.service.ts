import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";

export type HealthStatus = {
  status: "ok" | "degraded";
  backend: "ok";
  database: "ok" | "error";
};

/** Liveness for Cloud Run: API process + a cheap DB round-trip. */
export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", backend: "ok", database: "ok" };
  } catch (error) {
    logger.error({ err: error }, "Health check: database unreachable");
    return { status: "degraded", backend: "ok", database: "error" };
  }
}
