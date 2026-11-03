import { rateLimit } from "express-rate-limit";
import { sendError } from "../utils/api-response.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

// Keyed by account because logins are proxied through the Next.js server, so the client IP is shared.
function createLoginRateLimit(field: "email" | "identifier") {
  return rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_MAX_ATTEMPTS,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const account: unknown = req.body?.[field];
      return typeof account === "string" ? account : "unknown";
    },
    handler: (_req, res) => {
      sendError(res, 429, "Too many login attempts. Please try again later.");
    },
  });
}

export const loginRateLimit = createLoginRateLimit("email");
export const schoolLoginRateLimit = createLoginRateLimit("identifier");
export const teacherLoginRateLimit = createLoginRateLimit("identifier");

function googleLoginKey(idToken: unknown) {
  if (typeof idToken !== "string") return "google-unknown";
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString());
    return typeof payload.email === "string" ? `google:${payload.email.toLowerCase()}` : "google-unknown";
  } catch {
    return "google-unknown";
  }
}

export const googleLoginRateLimit = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_MAX_ATTEMPTS,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => googleLoginKey(req.body?.idToken),
  handler: (_req, res) => {
    sendError(res, 429, "Too many login attempts. Please try again later.");
  },
});

export const omrScanRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // A failed read should not lock the examiner out of the next attempt.
  skipFailedRequests: true,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req, res) => {
    const locals = (res as { locals?: { admin?: { email?: string }; school?: { id?: string }; teacher?: { id?: string } } }).locals;
    return locals?.teacher?.id ?? locals?.school?.id ?? locals?.admin?.email ?? req.ip ?? "omr-unknown";
  },
  handler: (_req, res) => {
    sendError(res, 429, "Too many OMR scans. Wait a few minutes and try again.");
  },
});

export const forgotPasswordRateLimit = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email: unknown = req.body?.email;
    return typeof email === "string" ? email.toLowerCase() : "unknown";
  },
  handler: (_req, res) => {
    sendError(res, 429, "Too many password reset attempts. Please try again later.");
  },
});
