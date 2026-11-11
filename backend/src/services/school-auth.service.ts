import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { SchoolStatus } from "../generated/prisma/enums.js";
import * as schoolRepository from "../repositories/school.repository.js";
import type { SchoolWithPrograms } from "../repositories/school.repository.js";
import type { SchoolLoginInput } from "../schemas/auth.schema.js";
import { AppError } from "../utils/app-error.js";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "../utils/password.js";
import {
  toSchoolAccountDto,
  toSchoolSessionAccountDto,
  type SchoolAccountDto,
} from "./school.service.js";

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "vitaran-api";
const JWT_AUDIENCE = "vitaran-school";
const SCHOOL_ROLE = "school";
const DAY_MS = 24 * 60 * 60 * 1000;

export type SchoolLoginResult = {
  token: string;
  expiresAt: string;
  school: SchoolAccountDto;
};

// Compared against when no school matches, so unknown accounts take as long as wrong passwords.
const dummyHash = hashPassword("vitaran-dummy-password");

function getSecret(): Uint8Array {
  if (!env.JWT_SECRET) {
    throw new AppError(503, "School authentication is not configured", undefined, false);
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

/** Changes whenever the password changes, which revokes previously issued tokens. */
function passwordVersion(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

function parseIdentifier(identifier: string) {
  if (identifier.includes("@")) return { email: identifier };
  return { phone: identifier.replace(/[\s-]/g, "") };
}

export async function loginSchool(input: SchoolLoginInput): Promise<SchoolLoginResult> {
  const secret = getSecret();
  const school = await schoolRepository.findSchoolByAccount(parseIdentifier(input.identifier));

  const passwordMatches = await verifyPassword(
    input.password,
    school?.passwordHash ?? (await dummyHash),
  );

  if (!school?.passwordHash || !passwordMatches) {
    throw new AppError(401, "Invalid email, phone or password");
  }

  if (passwordNeedsRehash(school.passwordHash)) {
    school.passwordHash = await hashPassword(input.password);
    await schoolRepository.setSchoolPasswordHash(school.id, school.passwordHash);
  }

  return issueSchoolLogin(school, secret);
}

/** Password or Google — same JWT. Caller already proved the account. */
export async function issueSchoolLogin(
  school: SchoolWithPrograms,
  secret = getSecret(),
): Promise<SchoolLoginResult> {
  if (school.status !== SchoolStatus.ACTIVE) {
    throw new AppError(403, "This school account is inactive");
  }
  if (!school.passwordHash) {
    throw new AppError(401, "Invalid email, phone or password");
  }

  const expiresAt = new Date(Date.now() + env.SCHOOL_JWT_EXPIRES_IN_DAYS * DAY_MS);

  const token = await new SignJWT({
    role: SCHOOL_ROLE,
    pwv: passwordVersion(school.passwordHash),
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(school.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);

  return { token, expiresAt: expiresAt.toISOString(), school: toSchoolAccountDto(school) };
}

export async function verifySchoolToken(token: string): Promise<SchoolAccountDto> {
  const secret = getSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.role !== SCHOOL_ROLE || !payload.sub) {
      throw new Error("Not a school token");
    }

    const school = await schoolRepository.findSchoolSessionById(payload.sub);

    if (
      !school?.passwordHash ||
      school.status !== SchoolStatus.ACTIVE ||
      payload.pwv !== passwordVersion(school.passwordHash)
    ) {
      throw new Error("School session revoked");
    }

    return toSchoolSessionAccountDto(school);
  } catch (_error) {
    throw new AppError(401, "Invalid or expired session");
  }
}
