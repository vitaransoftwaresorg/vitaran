import { prisma } from "../config/database.js";
import { schoolSessionSelect } from "./school.repository.js";

const schoolSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  status: true,
  city: true,
  state: true,
} as const;

const listInclude = {
  _count: { select: { schools: true } },
} as const;

const detailInclude = {
  schools: {
    select: schoolSelect,
    orderBy: { name: "asc" as const },
  },
} as const;

export function listHeadOffices() {
  return prisma.headOffice.findMany({
    include: listInclude,
    orderBy: { name: "asc" },
  });
}

export function findHeadOfficeById(id: string) {
  return prisma.headOffice.findUnique({
    where: { id },
    include: detailInclude,
  });
}

export function findHeadOfficeByCode(code: string) {
  return prisma.headOffice.findUnique({
    where: { code },
    select: { id: true },
  });
}

/** Login/contact email must be unique across head offices. */
export async function isEmailUsedByOtherHeadOffice(email: string, excludeId?: string) {
  const match = { equals: email, mode: "insensitive" } as const;
  const count = await prisma.headOffice.count({
    where: {
      OR: [{ accountEmail: match }, { contactEmail: match }],
      ...(excludeId && { NOT: { id: excludeId } }),
    },
  });
  return count > 0;
}

const authSelect = {
  id: true,
  code: true,
  name: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  accountEmail: true,
  accountPhone: true,
  passwordHash: true,
  city: true,
  state: true,
  _count: { select: { schools: true } },
} as const;

export function findHeadOfficeForAuth(id: string) {
  return prisma.headOffice.findUnique({
    where: { id },
    select: authSelect,
  });
}

export function findHeadOfficeByAccount(input: { email?: string; phone?: string }) {
  if (input.email) {
    return prisma.headOffice.findFirst({
      where: { accountEmail: { equals: input.email, mode: "insensitive" } },
      select: authSelect,
    });
  }
  if (input.phone) {
    return prisma.headOffice.findFirst({
      where: { accountPhone: input.phone },
      select: authSelect,
    });
  }
  return null;
}

export function setHeadOfficePasswordHash(id: string, passwordHash: string) {
  return prisma.headOffice.update({
    where: { id },
    data: { passwordHash },
    select: { id: true },
  });
}

export function listSchoolsForHeadOffice(headOfficeId: string) {
  return prisma.school.findMany({
    where: { headOfficeId },
    select: {
      id: true,
      code: true,
      name: true,
      board: true,
      type: true,
      status: true,
      contactName: true,
      contactEmail: true,
      city: true,
      state: true,
      createdAt: true,
      logoMimeType: true,
    },
    orderBy: { name: "asc" },
  });
}

export function findSchoolForHeadOffice(headOfficeId: string, schoolId: string) {
  return prisma.school.findFirst({
    where: { id: schoolId, headOfficeId },
    select: {
      id: true,
      code: true,
      name: true,
      board: true,
      type: true,
      status: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      addressLine: true,
      city: true,
      state: true,
      pincode: true,
      principalName: true,
      studentStrength: true,
      accountEmail: true,
      accountPhone: true,
      passwordEncrypted: true,
      createdAt: true,
      updatedAt: true,
      logoMimeType: true,
    },
  });
}

/** Session payload for assuming a linked school portal. */
export function findSchoolSessionForHeadOffice(headOfficeId: string, schoolId: string) {
  return prisma.school.findFirst({
    where: { id: schoolId, headOfficeId },
    select: schoolSessionSelect,
  });
}

export async function getHeadOfficeDashboard(headOfficeId: string) {
  const [office, total, active, inactive, regular, customized] = await Promise.all([
    prisma.headOffice.findUniqueOrThrow({
      where: { id: headOfficeId },
      select: { id: true, name: true, code: true },
    }),
    prisma.school.count({ where: { headOfficeId } }),
    prisma.school.count({ where: { headOfficeId, status: "ACTIVE" } }),
    prisma.school.count({ where: { headOfficeId, status: "INACTIVE" } }),
    prisma.school.count({ where: { headOfficeId, type: "REGULAR" } }),
    prisma.school.count({ where: { headOfficeId, type: "CUSTOMIZED" } }),
  ]);
  const recent = await prisma.school.findMany({
    where: { headOfficeId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      status: true,
      city: true,
      state: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return { office, total, active, inactive, regular, customized, recent };
}

/** Next unused 6-digit office code (starts at 100001). */
export async function findNextOfficeCode() {
  const rows = await prisma.headOffice.findMany({ select: { code: true } });
  let max = 100_000;
  for (const { code } of rows) {
    if (!/^\d{6}$/.test(code)) continue;
    const value = Number(code);
    if (value > max) max = value;
  }
  if (max >= 999_999) {
    throw new Error("No available 6-digit office codes left");
  }
  return String(max + 1);
}

export type HeadOfficeWriteData = {
  code: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  notes: string | null;
  accountEmail?: string | null;
  accountPhone?: string | null;
  passwordHash?: string | null;
  passwordEncrypted?: string | null;
  schoolIds: string[];
};

export async function createHeadOffice(data: HeadOfficeWriteData) {
  const { schoolIds, ...fields } = data;
  return prisma.$transaction(async (tx) => {
    const office = await tx.headOffice.create({ data: fields });
    if (schoolIds.length > 0) {
      await tx.school.updateMany({
        where: { id: { in: schoolIds } },
        data: { headOfficeId: office.id },
      });
    }
    return tx.headOffice.findUniqueOrThrow({
      where: { id: office.id },
      include: detailInclude,
    });
  });
}

export async function updateHeadOffice(id: string, data: HeadOfficeWriteData) {
  const { schoolIds, ...fields } = data;
  return prisma.$transaction(async (tx) => {
    await tx.headOffice.update({ where: { id }, data: fields });
    // Clear previous assignments, then apply the selected set.
    await tx.school.updateMany({
      where: { headOfficeId: id },
      data: { headOfficeId: null },
    });
    if (schoolIds.length > 0) {
      await tx.school.updateMany({
        where: { id: { in: schoolIds } },
        data: { headOfficeId: id },
      });
    }
    return tx.headOffice.findUniqueOrThrow({
      where: { id },
      include: detailInclude,
    });
  });
}

export function deleteHeadOffice(id: string) {
  return prisma.headOffice.delete({ where: { id } });
}
