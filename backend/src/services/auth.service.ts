import { timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
import type { LoginInput } from "../schemas/auth.schema.js";
import { AppError } from "../utils/app-error.js";

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "vitaran-api";
const JWT_AUDIENCE = "vitaran-admin";
const ADMIN_ROLE = "admin";

export type AdminProfile = {
  email: string;
  role: typeof ADMIN_ROLE;
};

export type LoginResult = {
  token: string;
  expiresAt: string;
  admin: AdminProfile;
};

type AuthConfig = {
  secret: Uint8Array;
  adminEmail: string;
  adminPassword: string;
};

function getAuthConfig(): AuthConfig {
  if (!env.JWT_SECRET || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new AppError(
      503,
      "Admin authentication is not configured",
      undefined,
      false,
    );
  }

  return {
    secret: new TextEncoder().encode(env.JWT_SECRET),
    adminEmail: env.ADMIN_EMAIL,
    adminPassword: env.ADMIN_PASSWORD,
  };
}

function passwordsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);

  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }

  return timingSafeEqual(left, right);
}

function invalidCredentials(): AppError {
  return new AppError(401, "Invalid email or password");
}

export async function loginAdmin(input: LoginInput): Promise<LoginResult> {
  const config = getAuthConfig();

  const passwordMatches = passwordsMatch(input.password.toLowerCase(), config.adminPassword.toLowerCase());

  if (input.email !== config.adminEmail.trim().toLowerCase() || !passwordMatches) {
    throw invalidCredentials();
  }

  const expiresAt = new Date(
    Date.now() + env.JWT_EXPIRES_IN_HOURS * 60 * 60 * 1000,
  );

  const token = await new SignJWT({ role: ADMIN_ROLE })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(config.adminEmail)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(config.secret);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    admin: { email: config.adminEmail, role: ADMIN_ROLE },
  };
}

export async function verifyAdminToken(token: string): Promise<AdminProfile> {
  const config = getAuthConfig();

  try {
    const { payload } = await jwtVerify(token, config.secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.role !== ADMIN_ROLE || payload.sub !== config.adminEmail) {
      throw new Error("Token does not belong to the configured admin");
    }

    return { email: payload.sub, role: ADMIN_ROLE };
  } catch (_error) {
    throw new AppError(401, "Invalid or expired session");
  }
}
