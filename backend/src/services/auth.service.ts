import { timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { AdminOperatorStatus } from "../generated/prisma/enums.js";
import * as adminOperatorRepository from "../repositories/admin-operator.repository.js";
import type { LoginInput } from "../schemas/auth.schema.js";
import { AppError } from "../utils/app-error.js";
import { verifyPassword } from "../utils/password.js";

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "vitaran-api";
const JWT_AUDIENCE = "vitaran-admin";
const ADMIN_ROLE = "admin";

/** Env-configured primary admin (not stored in admin_operators). */
export const ROOT_ADMIN_ID = "root";

export type AdminProfile = {
  id: string;
  email: string;
  name: string;
  role: typeof ADMIN_ROLE;
  isRoot: boolean;
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
    adminEmail: env.ADMIN_EMAIL.trim().toLowerCase(),
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

function issueToken(
  config: AuthConfig,
  profile: AdminProfile,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + env.JWT_EXPIRES_IN_HOURS * 60 * 60 * 1000);
  return new SignJWT({
    role: ADMIN_ROLE,
    aid: profile.id,
    name: profile.name,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(profile.email)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(config.secret)
    .then((token) => ({ token, expiresAt }));
}

export async function loginAdmin(input: LoginInput): Promise<LoginResult> {
  const config = getAuthConfig();
  const email = input.email.trim().toLowerCase();

  if (email === config.adminEmail) {
    const passwordMatches = passwordsMatch(
      input.password.toLowerCase(),
      config.adminPassword.toLowerCase(),
    );
    if (!passwordMatches) throw invalidCredentials();

    const admin: AdminProfile = {
      id: ROOT_ADMIN_ID,
      email: config.adminEmail,
      name: "Admin",
      role: ADMIN_ROLE,
      isRoot: true,
    };
    const { token, expiresAt } = await issueToken(config, admin);
    return { token, expiresAt: expiresAt.toISOString(), admin };
  }

  const operator = await adminOperatorRepository.findAdminOperatorByEmail(email);
  if (!operator || operator.status !== AdminOperatorStatus.ACTIVE) {
    throw invalidCredentials();
  }
  if (!(await verifyPassword(input.password, operator.passwordHash))) {
    throw invalidCredentials();
  }

  const admin: AdminProfile = {
    id: operator.id,
    email: operator.email,
    name: operator.name,
    role: ADMIN_ROLE,
    isRoot: false,
  };
  const { token, expiresAt } = await issueToken(config, admin);
  return { token, expiresAt: expiresAt.toISOString(), admin };
}

export async function verifyAdminToken(token: string): Promise<AdminProfile> {
  const config = getAuthConfig();

  try {
    const { payload } = await jwtVerify(token, config.secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.role !== ADMIN_ROLE || typeof payload.sub !== "string") {
      throw new Error("Token does not belong to an admin");
    }

    const email = payload.sub.trim().toLowerCase();
    const aid = typeof payload.aid === "string" && payload.aid ? payload.aid : ROOT_ADMIN_ID;

    if (aid === ROOT_ADMIN_ID) {
      if (email !== config.adminEmail) {
        throw new Error("Token does not belong to the configured admin");
      }
      return {
        id: ROOT_ADMIN_ID,
        email: config.adminEmail,
        name: typeof payload.name === "string" && payload.name ? payload.name : "Admin",
        role: ADMIN_ROLE,
        isRoot: true,
      };
    }

    const operator = await adminOperatorRepository.findAdminOperatorById(aid);
    if (
      !operator ||
      operator.status !== AdminOperatorStatus.ACTIVE ||
      operator.email !== email
    ) {
      throw new Error("Operator is missing or disabled");
    }

    return {
      id: operator.id,
      email: operator.email,
      name: operator.name,
      role: ADMIN_ROLE,
      isRoot: false,
    };
  } catch (_error) {
    throw new AppError(401, "Invalid or expired session");
  }
}

/** Env root admin email — employees cannot reuse it. */
export function rootAdminEmail() {
  return getAuthConfig().adminEmail;
}
