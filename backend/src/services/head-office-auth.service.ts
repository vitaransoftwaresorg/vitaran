import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
import * as headOfficeRepository from "../repositories/head-office.repository.js";
import type { SchoolLoginInput } from "../schemas/auth.schema.js";
import { AppError } from "../utils/app-error.js";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "../utils/password.js";

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "vitaran-api";
const JWT_AUDIENCE = "vitaran-head-office";
const HEAD_OFFICE_ROLE = "head-office";
const DAY_MS = 24 * 60 * 60 * 1000;

export type HeadOfficeAccountDto = {
  id: string;
  code: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  accountEmail: string | null;
  accountPhone: string | null;
  city: string;
  state: string;
  schoolCount: number;
};

export type HeadOfficeLoginResult = {
  token: string;
  expiresAt: string;
  office: HeadOfficeAccountDto;
};

const dummyHash = hashPassword("vitaran-dummy-password");

function getSecret(): Uint8Array {
  if (!env.JWT_SECRET) {
    throw new AppError(503, "Head office authentication is not configured", undefined, false);
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

function passwordVersion(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

function parseIdentifier(identifier: string) {
  if (identifier.includes("@")) return { email: identifier.toLowerCase().trim() };
  return { phone: identifier.replace(/[\s-]/g, "") };
}

export function toHeadOfficeAccountDto(
  office: NonNullable<Awaited<ReturnType<typeof headOfficeRepository.findHeadOfficeForAuth>>>,
): HeadOfficeAccountDto {
  return {
    id: office.id,
    code: office.code,
    name: office.name,
    contactName: office.contactName,
    contactEmail: office.contactEmail,
    contactPhone: office.contactPhone,
    accountEmail: office.accountEmail,
    accountPhone: office.accountPhone,
    city: office.city,
    state: office.state,
    schoolCount: office._count.schools,
  };
}

export async function loginHeadOffice(input: SchoolLoginInput): Promise<HeadOfficeLoginResult> {
  const secret = getSecret();
  const office = await headOfficeRepository.findHeadOfficeByAccount(parseIdentifier(input.identifier));

  const passwordMatches = await verifyPassword(
    input.password,
    office?.passwordHash ?? (await dummyHash),
  );

  if (!office?.passwordHash || !passwordMatches) {
    throw new AppError(401, "Invalid email, phone or password");
  }

  if (passwordNeedsRehash(office.passwordHash)) {
    const nextHash = await hashPassword(input.password);
    await headOfficeRepository.setHeadOfficePasswordHash(office.id, nextHash);
    office.passwordHash = nextHash;
  }

  return issueHeadOfficeLogin(office, secret);
}

export async function issueHeadOfficeLogin(
  office: NonNullable<Awaited<ReturnType<typeof headOfficeRepository.findHeadOfficeForAuth>>>,
  secret = getSecret(),
): Promise<HeadOfficeLoginResult> {
  if (!office.passwordHash) {
    throw new AppError(401, "Invalid email, phone or password");
  }

  const expiresAt = new Date(Date.now() + env.SCHOOL_JWT_EXPIRES_IN_DAYS * DAY_MS);
  const token = await new SignJWT({
    role: HEAD_OFFICE_ROLE,
    pwv: passwordVersion(office.passwordHash),
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(office.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    office: toHeadOfficeAccountDto(office),
  };
}

export async function verifyHeadOfficeToken(token: string): Promise<HeadOfficeAccountDto> {
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.role !== HEAD_OFFICE_ROLE || !payload.sub) {
      throw new Error("Not a head office token");
    }

    const office = await headOfficeRepository.findHeadOfficeForAuth(payload.sub);
    if (!office?.passwordHash || payload.pwv !== passwordVersion(office.passwordHash)) {
      throw new Error("Head office session revoked");
    }

    return toHeadOfficeAccountDto(office);
  } catch {
    throw new AppError(401, "Invalid or expired session");
  }
}
