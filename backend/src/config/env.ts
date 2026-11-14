import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Bind address. Use 127.0.0.1 behind Nginx on the VPS. */
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z
    .string()
    .min(32, "must be at least 32 characters")
    .optional(),
  JWT_EXPIRES_IN_HOURS: z.coerce.number().int().positive().default(8),
  SCHOOL_JWT_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(365),
  PASSWORD_ENCRYPTION_KEY: z
    .string()
    .min(32, "must be at least 32 characters")
    .optional(),
  ADMIN_EMAIL: z.email().toLowerCase().optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  /** Public app URL used in credential emails (defaults to first CORS origin). */
  APP_URL: z.url().optional(),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().trim().min(1).optional(),
  /** Google OAuth client ID — must match Auth.js AUTH_GOOGLE_ID. */
  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
  /** Redis for BullMQ OMR batch jobs. When unset, sheets are processed in-process. */
  REDIS_URL: z.string().trim().min(1).optional(),
  /** Google Cloud Storage bucket for PDFs, OMR images, logos. When unset, bytes stay in Postgres. */
  GCS_BUCKET: z.string().trim().min(1).optional(),
  /** Optional GCP project id (ADC / Cloud Run usually supply this). */
  GCS_PROJECT_ID: z.string().trim().min(1).optional(),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT?.trim() || undefined,
  HOST: process.env.HOST?.trim() || undefined,
  DATABASE_URL: process.env.DATABASE_URL?.trim() || undefined,
  JWT_SECRET: process.env.JWT_SECRET?.trim() || undefined,
  JWT_EXPIRES_IN_HOURS: process.env.JWT_EXPIRES_IN_HOURS?.trim() || undefined,
  SCHOOL_JWT_EXPIRES_IN_DAYS:
    process.env.SCHOOL_JWT_EXPIRES_IN_DAYS?.trim() || undefined,
  PASSWORD_ENCRYPTION_KEY: process.env.PASSWORD_ENCRYPTION_KEY?.trim() || undefined,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL?.trim() || undefined,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || undefined,
  CORS_ORIGIN: process.env.CORS_ORIGIN?.trim() || undefined,
  APP_URL: process.env.APP_URL?.trim() || undefined,
  SMTP_HOST: process.env.SMTP_HOST?.trim() || undefined,
  SMTP_PORT: process.env.SMTP_PORT?.trim() || undefined,
  SMTP_USER: process.env.SMTP_USER?.trim() || undefined,
  SMTP_PASS: process.env.SMTP_PASS || undefined,
  SMTP_FROM: process.env.SMTP_FROM?.trim() || undefined,
  GOOGLE_CLIENT_ID:
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.AUTH_GOOGLE_ID?.trim() ||
    undefined,
  REDIS_URL: process.env.REDIS_URL?.trim() || undefined,
  GCS_BUCKET: process.env.GCS_BUCKET?.trim() || undefined,
  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim() || undefined,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");

  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

export function getCorsOrigins(): string[] {
  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
