import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { SchoolStatus, TeacherStatus } from "../generated/prisma/enums.js";
import * as teacherRepository from "../repositories/teacher.repository.js";
import type { TeacherRecord } from "../repositories/teacher.repository.js";
import type { SchoolLoginInput } from "../schemas/auth.schema.js";
import { AppError } from "../utils/app-error.js";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "../utils/password.js";
import { toTeacherAccountDto, type TeacherAccountDto } from "./teacher.service.js";

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "vitaran-api";
const JWT_AUDIENCE = "vitaran-teacher";
const TEACHER_ROLE = "teacher";
const DAY_MS = 24 * 60 * 60 * 1000;

export type TeacherLoginResult = {
  token: string;
  expiresAt: string;
  teacher: TeacherAccountDto;
};

const dummyHash = hashPassword("vitaran-dummy-password");

function getSecret(): Uint8Array {
  if (!env.JWT_SECRET) {
    throw new AppError(503, "Teacher authentication is not configured", undefined, false);
  }
  return new TextEncoder().encode(env.JWT_SECRET);
}

function passwordVersion(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

function parseIdentifier(identifier: string) {
  if (identifier.includes("@")) return { email: identifier };
  return { phone: identifier.replace(/[\s-]/g, "") };
}

export async function loginTeacher(input: SchoolLoginInput): Promise<TeacherLoginResult> {
  const secret = getSecret();
  const teacher = await teacherRepository.findTeacherByAccount(parseIdentifier(input.identifier));

  const passwordMatches = await verifyPassword(
    input.password,
    teacher?.passwordHash ?? (await dummyHash),
  );

  if (!teacher?.passwordHash || !passwordMatches) {
    throw new AppError(401, "Invalid email, phone or password");
  }

  if (passwordNeedsRehash(teacher.passwordHash)) {
    teacher.passwordHash = await hashPassword(input.password);
    await teacherRepository.setTeacherPasswordHash(teacher.id, teacher.passwordHash);
  }

  return issueTeacherLogin(teacher, secret);
}

/** Password or Google — same JWT. Caller already proved the account. */
export async function issueTeacherLogin(
  teacher: TeacherRecord,
  secret = getSecret(),
): Promise<TeacherLoginResult> {
  if (teacher.status !== TeacherStatus.ACTIVE) {
    throw new AppError(403, "This teacher account is inactive");
  }
  if (teacher.school.status !== SchoolStatus.ACTIVE) {
    throw new AppError(403, "This school account is inactive");
  }
  if (!teacher.passwordHash) {
    throw new AppError(401, "Invalid email, phone or password");
  }

  const expiresAt = new Date(Date.now() + env.SCHOOL_JWT_EXPIRES_IN_DAYS * DAY_MS);

  const token = await new SignJWT({
    role: TEACHER_ROLE,
    schoolId: teacher.schoolId,
    pwv: passwordVersion(teacher.passwordHash),
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(teacher.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    teacher: toTeacherAccountDto(teacher),
  };
}

export async function verifyTeacherToken(token: string): Promise<TeacherAccountDto> {
  const secret = getSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.role !== TEACHER_ROLE || !payload.sub) {
      throw new Error("Not a teacher token");
    }

    const teacher = await teacherRepository.findTeacherById(payload.sub);

    if (
      !teacher?.passwordHash ||
      teacher.status !== TeacherStatus.ACTIVE ||
      teacher.school.status !== SchoolStatus.ACTIVE ||
      payload.pwv !== passwordVersion(teacher.passwordHash)
    ) {
      throw new Error("Teacher session revoked");
    }

    return toTeacherAccountDto(teacher);
  } catch (_error) {
    throw new AppError(401, "Invalid or expired session");
  }
}
