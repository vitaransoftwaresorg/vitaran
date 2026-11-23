"use server";

import { ApiError } from "@/services/api-client";
import {
  createAdminOperator,
  deleteAdminOperator,
  listAdminOperators,
  updateAdminOperator,
} from "@/services/admin-operators";
import type {
  CreateAdminOperatorInput,
  UpdateAdminOperatorInput,
} from "@/types/admin-operator";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function fail(error: unknown): { ok: false; message: string } {
  return {
    ok: false,
    message: error instanceof ApiError ? error.message : "Something went wrong.",
  };
}

export async function listAdminOperatorsAction(): Promise<Result<Awaited<ReturnType<typeof listAdminOperators>>>> {
  try {
    return { ok: true, data: await listAdminOperators() };
  } catch (error) {
    return fail(error);
  }
}

export async function createAdminOperatorAction(
  input: CreateAdminOperatorInput,
): Promise<Result<Awaited<ReturnType<typeof createAdminOperator>>>> {
  try {
    return { ok: true, data: await createAdminOperator(input) };
  } catch (error) {
    return fail(error);
  }
}

export async function updateAdminOperatorAction(
  id: string,
  input: UpdateAdminOperatorInput,
): Promise<Result<Awaited<ReturnType<typeof updateAdminOperator>>>> {
  try {
    return { ok: true, data: await updateAdminOperator(id, input) };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAdminOperatorAction(id: string): Promise<Result<{ ok: true }>> {
  try {
    return { ok: true, data: await deleteAdminOperator(id) };
  } catch (error) {
    return fail(error);
  }
}
