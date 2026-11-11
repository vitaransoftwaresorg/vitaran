import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../utils/app-error.js";
import { sendError } from "../utils/api-response.js";
import { logger } from "../utils/logger.js";

type JsonParseError = SyntaxError & {
  status?: number;
  type?: string;
};

function isJsonParseError(error: unknown): error is JsonParseError {
  return (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400 &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    sendError(res, 400, "Validation failed", error.issues);
    return;
  }

  if (isJsonParseError(error)) {
    sendError(res, 400, "Request body must be valid JSON");
    return;
  }

  if (error?.type === "entity.too.large") {
    sendError(res, 413, "The upload is too large");
    return;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE" ? "Keep each file under 2 MB" : "This upload couldn't be read";
    sendError(res, 400, message, error.field ? [{ path: [error.field], message }] : undefined);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1001") {
      sendError(res, 503, "Database is temporarily unavailable. Please try again shortly.");
      return;
    }

    if (error.code === "P2025") {
      sendError(res, 404, "Resource not found");
      return;
    }

    if (error.code === "P2002") {
      sendError(res, 409, "A record with these details already exists");
      return;
    }

    if (error.code === "P2011") {
      const column =
        typeof error.meta?.constraint === "string"
          ? error.meta.constraint
          : Array.isArray(error.meta?.constraint)
            ? error.meta.constraint.join(", ")
            : "a required field";
      sendError(res, 400, `Missing required data (${column}). Check the form and try again.`);
      return;
    }
  }

  if (error instanceof AppError) {
    if (!error.isOperational) {
      logger.error({ err: error }, "Non-operational application error");
    }

    sendError(res, error.statusCode, error.message, error.details);
    return;
  }

  logger.error({ err: error }, "Unhandled error");

  const message =
    env.NODE_ENV === "production"
      ? "Internal server error"
      : error instanceof Error
        ? error.message
        : "Internal server error";

  sendError(res, 500, message);
};
