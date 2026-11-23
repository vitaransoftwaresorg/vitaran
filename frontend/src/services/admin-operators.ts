import "server-only";
import { adminApi } from "@/services/admin-api";
import type {
  AdminOperator,
  CreateAdminOperatorInput,
  UpdateAdminOperatorInput,
} from "@/types/admin-operator";

const BASE = "/admin/operators";

export function listAdminOperators() {
  return adminApi<AdminOperator[]>(BASE);
}

export function createAdminOperator(input: CreateAdminOperatorInput) {
  return adminApi<AdminOperator>(BASE, { method: "POST", body: input });
}

export function updateAdminOperator(id: string, input: UpdateAdminOperatorInput) {
  return adminApi<AdminOperator>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteAdminOperator(id: string) {
  return adminApi<{ ok: true }>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
