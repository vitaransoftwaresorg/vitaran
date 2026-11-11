import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,req,res,reqId",
            singleLine: true,
            messageFormat: "{msg}{if responseTime} ({responseTime}ms){end}",
          },
        },
      }
    : {}),
});
