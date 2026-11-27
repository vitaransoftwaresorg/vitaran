import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import * as headOfficeRepository from "../repositories/head-office.repository.js";
import * as schoolRepository from "../repositories/school.repository.js";
import type {
  CreateHeadOfficeInput,
  UpdateHeadOfficeInput,
} from "../schemas/head-office.schema.js";
import { AppError } from "../utils/app-error.js";
import { notifyContentChanged } from "../utils/content-events.js";
import { hashPassword } from "../utils/password.js";
import { encryptSecret } from "../utils/secret-box.js";
import { sendHeadOfficeCredentialsEmail } from "./mail.service.js";

async function sealPassword(password: string) {
  return {
    passwordHash: await hashPassword(password),
    passwordEncrypted: encryptSecret(password),
  };
}

function toListDto(
  row: Awaited<ReturnType<typeof headOfficeRepository.listHeadOffices>>[number],
) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    city: row.city,
    state: row.state,
    schoolCount: row._count.schools,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetailDto(
  row: NonNullable<Awaited<ReturnType<typeof headOfficeRepository.findHeadOfficeById>>>,
) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    addressLine: row.addressLine,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    notes: row.notes,
    schools: row.schools.map((school) => ({
      id: school.id,
      code: school.code,
      name: school.name,
      type: school.type,
      status: school.status,
      city: school.city,
      state: school.state,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function duplicateConstraint(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(" ") : "";
    if (typeof target === "string" && target.includes("account_email")) {
      throw new AppError(409, "That email is already in use", [
        { path: ["contactEmail"], message: "This email is already used by a school or head office" },
      ]);
    }
    throw new AppError(409, "That office code is already in use");
  }
  throw error;
}

async function assertSchoolsExist(schoolIds: string[]) {
  if (schoolIds.length === 0) return;
  const unique = [...new Set(schoolIds)];
  const count = await prisma.school.count({ where: { id: { in: unique } } });
  if (count !== unique.length) {
    throw new AppError(400, "One or more selected schools were not found");
  }
}

/** Head office login email must not collide with school or other office emails. */
async function assertEmailAvailable(email: string, excludeId?: string) {
  const normalized = email.toLowerCase().trim();
  const [usedBySchool, usedByOffice] = await Promise.all([
    schoolRepository.isEmailUsedByOtherSchool(normalized),
    headOfficeRepository.isEmailUsedByOtherHeadOffice(normalized, excludeId),
  ]);
  if (usedBySchool || usedByOffice) {
    throw new AppError(409, "That email is already in use", [
      {
        path: ["contactEmail"],
        message: usedBySchool
          ? "This email is already used by a school"
          : "This email is already used by another head office",
      },
    ]);
  }
}

export async function listHeadOffices() {
  const rows = await headOfficeRepository.listHeadOffices();
  return rows.map(toListDto);
}

export async function getHeadOffice(id: string) {
  const row = await headOfficeRepository.findHeadOfficeById(id);
  if (!row) throw new AppError(404, "Head office not found");
  return toDetailDto(row);
}

export async function getCodeAvailability(code: string, excludeId?: string) {
  const existing = await headOfficeRepository.findHeadOfficeByCode(code.trim());
  return { taken: Boolean(existing && existing.id !== excludeId) };
}

/** Live check for the create/edit form — same rules as assertEmailAvailable. */
export async function getEmailAvailability(email: string, excludeId?: string) {
  const normalized = email.toLowerCase().trim();
  const [usedBySchool, usedByOffice] = await Promise.all([
    schoolRepository.isEmailUsedByOtherSchool(normalized),
    headOfficeRepository.isEmailUsedByOtherHeadOffice(normalized, excludeId),
  ]);
  return {
    taken: usedBySchool || usedByOffice,
    message: usedBySchool
      ? "This email is already used by a school"
      : usedByOffice
        ? "This email is already used by another head office"
        : null,
  };
}

export async function getNextOfficeCode() {
  try {
    const code = await headOfficeRepository.findNextOfficeCode();
    return { code };
  } catch {
    throw new AppError(409, "No available 6-digit office codes left");
  }
}

export async function createHeadOffice(input: CreateHeadOfficeInput) {
  const schoolIds = [...new Set(input.schoolIds)];
  await assertSchoolsExist(schoolIds);
  const requested = input.code?.trim();
  let code =
    requested && /^\d{6}$/.test(requested)
      ? requested
      : await headOfficeRepository.findNextOfficeCode();
  if (requested && /^\d{6}$/.test(requested)) {
    const taken = await headOfficeRepository.findHeadOfficeByCode(requested);
    if (taken) code = await headOfficeRepository.findNextOfficeCode();
  }
  const accountEmail = input.contactEmail.toLowerCase();
  const accountPhone = input.contactPhone;
  await assertEmailAvailable(accountEmail);
  try {
    const row = await headOfficeRepository.createHeadOffice({
      code,
      name: input.name,
      contactName: input.contactName,
      contactEmail: accountEmail,
      contactPhone: accountPhone,
      addressLine: input.addressLine,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      accountEmail,
      accountPhone,
      ...(await sealPassword(input.password)),
      schoolIds,
    });
    await sendHeadOfficeCredentialsEmail({
      to: accountEmail,
      officeName: row.name,
      loginEmail: accountEmail,
      loginPhone: accountPhone,
      password: input.password,
      reason: "created",
    });
    notifyContentChanged({ kind: "schools", schoolId: null });
    return toDetailDto(row);
  } catch (error) {
    throw duplicateConstraint(error);
  }
}

export async function updateHeadOffice(id: string, input: UpdateHeadOfficeInput) {
  const existing = await headOfficeRepository.findHeadOfficeById(id);
  if (!existing) throw new AppError(404, "Head office not found");
  const schoolIds = [...new Set(input.schoolIds)];
  await assertSchoolsExist(schoolIds);
  const accountEmail = input.contactEmail.toLowerCase();
  const accountPhone = input.contactPhone;
  await assertEmailAvailable(accountEmail, id);
  const passwordSeal = await sealPassword(input.password);
  try {
    const row = await headOfficeRepository.updateHeadOffice(id, {
      code: existing.code,
      name: input.name,
      contactName: input.contactName,
      contactEmail: accountEmail,
      contactPhone: accountPhone,
      addressLine: input.addressLine,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      accountEmail,
      accountPhone,
      ...passwordSeal,
      schoolIds,
    });
    await sendHeadOfficeCredentialsEmail({
      to: accountEmail,
      officeName: row.name,
      loginEmail: accountEmail,
      loginPhone: accountPhone,
      password: input.password,
      reason: "password-reset",
    });
    notifyContentChanged({ kind: "schools", schoolId: null });
    return toDetailDto(row);
  } catch (error) {
    throw duplicateConstraint(error);
  }
}

export async function deleteHeadOffice(id: string) {
  const existing = await headOfficeRepository.findHeadOfficeById(id);
  if (!existing) throw new AppError(404, "Head office not found");
  await headOfficeRepository.deleteHeadOffice(id);
  notifyContentChanged({ kind: "schools", schoolId: null });
}
