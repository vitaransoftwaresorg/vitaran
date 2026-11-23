import { prisma } from "../config/database.js";
import type { Prisma } from "../generated/prisma/client.js";
import { AdminOperatorStatus } from "../generated/prisma/enums.js";

const select = {
  id: true,
  name: true,
  email: true,
  status: true,
  passwordHash: true,
  passwordEncrypted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminOperatorSelect;

export type AdminOperatorRow = Prisma.AdminOperatorGetPayload<{ select: typeof select }>;

export function listAdminOperators() {
  return prisma.adminOperator.findMany({
    select,
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });
}

export function findAdminOperatorById(id: string) {
  return prisma.adminOperator.findUnique({ where: { id }, select });
}

export function findAdminOperatorByEmail(email: string) {
  return prisma.adminOperator.findUnique({
    where: { email: email.trim().toLowerCase() },
    select,
  });
}

export function createAdminOperator(data: {
  name: string;
  email: string;
  passwordHash: string;
  passwordEncrypted: string;
}) {
  return prisma.adminOperator.create({
    data: {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash,
      passwordEncrypted: data.passwordEncrypted,
      status: AdminOperatorStatus.ACTIVE,
    },
    select,
  });
}

export function updateAdminOperator(
  id: string,
  data: {
    name?: string;
    email?: string;
    status?: AdminOperatorStatus;
    passwordHash?: string;
    passwordEncrypted?: string;
  },
) {
  return prisma.adminOperator.update({
    where: { id },
    data: {
      ...(data.name != null ? { name: data.name.trim() } : {}),
      ...(data.email != null ? { email: data.email.trim().toLowerCase() } : {}),
      ...(data.status != null ? { status: data.status } : {}),
      ...(data.passwordHash != null ? { passwordHash: data.passwordHash } : {}),
      ...(data.passwordEncrypted != null ? { passwordEncrypted: data.passwordEncrypted } : {}),
    },
    select,
  });
}

export function deleteAdminOperator(id: string) {
  return prisma.adminOperator.delete({ where: { id }, select: { id: true } });
}
