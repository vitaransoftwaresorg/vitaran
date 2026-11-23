import { Prisma } from "../generated/prisma/client.js";
import { AdminOperatorStatus } from "../generated/prisma/enums.js";
import * as adminOperatorRepository from "../repositories/admin-operator.repository.js";
import type {
  CreateAdminOperatorInput,
  UpdateAdminOperatorInput,
} from "../schemas/admin-operator.schema.js";
import { AppError } from "../utils/app-error.js";
import { hashPassword } from "../utils/password.js";
import { decryptSecret, encryptSecret } from "../utils/secret-box.js";
import { ROOT_ADMIN_ID, rootAdminEmail, type AdminProfile } from "./auth.service.js";

export type AdminOperatorDto = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "DISABLED";
  password: string;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: {
  id: string;
  name: string;
  email: string;
  status: AdminOperatorStatus;
  passwordEncrypted: string;
  createdAt: Date;
  updatedAt: Date;
}): AdminOperatorDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    password: decryptSecret(row.passwordEncrypted) ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertEmailAvailable(email: string, exceptId?: string) {
  if (email === rootAdminEmail()) {
    throw new AppError(409, "That email is already used by the primary admin account.");
  }
  const existing = await adminOperatorRepository.findAdminOperatorByEmail(email);
  if (existing && existing.id !== exceptId) {
    throw new AppError(409, "An employee with that email already exists.");
  }
}

export async function listOperators() {
  const rows = await adminOperatorRepository.listAdminOperators();
  return rows.map(toDto);
}

export async function createOperator(input: CreateAdminOperatorInput) {
  await assertEmailAvailable(input.email);
  try {
    const row = await adminOperatorRepository.createAdminOperator({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      passwordEncrypted: encryptSecret(input.password),
    });
    return toDto(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "An employee with that email already exists.");
    }
    throw error;
  }
}

export async function updateOperator(
  id: string,
  input: UpdateAdminOperatorInput,
  actor: AdminProfile,
) {
  const current = await adminOperatorRepository.findAdminOperatorById(id);
  if (!current) throw new AppError(404, "Employee not found");

  if (input.email && input.email !== current.email) {
    await assertEmailAvailable(input.email, id);
  }

  // Don't let someone disable or wipe their own login while signed in.
  if (actor.id === id && input.status === "DISABLED") {
    throw new AppError(400, "You cannot disable your own account while signed in.");
  }

  const sealed =
    input.password != null
      ? {
          passwordHash: await hashPassword(input.password),
          passwordEncrypted: encryptSecret(input.password),
        }
      : {};

  try {
    const row = await adminOperatorRepository.updateAdminOperator(id, {
      name: input.name,
      email: input.email,
      status: input.status as AdminOperatorStatus | undefined,
      ...sealed,
    });
    return toDto(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "An employee with that email already exists.");
    }
    throw error;
  }
}

export async function deleteOperator(id: string, actor: AdminProfile) {
  if (actor.id === id) {
    throw new AppError(400, "You cannot delete your own account while signed in.");
  }
  if (id === ROOT_ADMIN_ID) {
    throw new AppError(400, "The primary admin account cannot be deleted here.");
  }
  const current = await adminOperatorRepository.findAdminOperatorById(id);
  if (!current) throw new AppError(404, "Employee not found");
  await adminOperatorRepository.deleteAdminOperator(id);
  return { ok: true as const };
}
