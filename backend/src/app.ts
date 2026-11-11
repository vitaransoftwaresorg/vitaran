import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env, getCorsOrigins } from "./config/env.js";
import { API_PREFIX, REQUEST_BODY_LIMIT } from "./constants/http.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { apiRouter } from "./routes/index.js";
import { logger } from "./utils/logger.js";

export function createApp() {
  const app = express();

  // Cloud Run / load balancers terminate TLS and forward the client IP.
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      strictTransportSecurity: env.NODE_ENV === "production",
    }),
  );
  app.use(
    cors({
      origin: getCorsOrigins(),
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "Accept", "X-Test-Id"],
    }),
  );
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: REQUEST_BODY_LIMIT }));
  app.use(
    pinoHttp({
      logger,
      quietReqLogger: true,
      quietResLogger: true,
      autoLogging: {
        ignore: (req) => req.url === `${API_PREFIX}/health`,
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      serializers: {
        req: () => undefined,
        res: () => undefined,
      },
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode}`,
      customErrorMessage: (req, res, error) =>
        `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode} ${error.message}`,
    }),
  );
  app.use(API_PREFIX, apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
