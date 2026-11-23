"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AdminOperator } from "@/types/admin-operator";
import {
  createAdminOperatorAction,
  deleteAdminOperatorAction,
  updateAdminOperatorAction,
} from "./admin-operator-actions";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AdminEmployeesPanelProps = {
  initial: AdminOperator[];
};

export function AdminEmployeesPanel({ initial }: AdminEmployeesPanelProps) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
  }

  function create() {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanName || !cleanEmail || !cleanPassword) {
      setError("Enter name, email, and password.");
      return;
    }
    if (!EMAIL.test(cleanEmail)) {
      setError("Enter a valid email.");
      return;
    }
    if (cleanPassword.length < 4) {
      setError("Use at least 4 characters for the password.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createAdminOperatorAction({
        name: cleanName,
        email: cleanEmail,
        password: cleanPassword,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRows((current) => [...current, result.data]);
      resetForm();
      toast.success(`${result.data.name} can sign in on /admin with these credentials`);
    });
  }

  function setActive(row: AdminOperator, active: boolean) {
    setBusyId(row.id);
    startTransition(async () => {
      const result = await updateAdminOperatorAction(row.id, {
        status: active ? "ACTIVE" : "DISABLED",
      });
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRows((current) => current.map((item) => (item.id === row.id ? result.data : item)));
      toast.success(active ? `${row.name} enabled` : `${row.name} disabled`);
    });
  }

  function remove(row: AdminOperator) {
    if (!window.confirm(`Remove ${row.name} (${row.email})? They will no longer be able to sign in.`)) {
      return;
    }
    setBusyId(row.id);
    startTransition(async () => {
      const result = await deleteAdminOperatorAction(row.id);
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setRows((current) => current.filter((item) => item.id !== row.id));
      toast.success(`${row.name} removed`);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-brand-950">Employee admin logins</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Same admin privileges as you. Each employee gets their own OMR scan queue, so
            different devices can upload PDFs at the same time.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="employee-name">Name</FieldLabel>
            <Input
              id="employee-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Anuradha"
              disabled={pending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="employee-email">Email</FieldLabel>
            <Input
              id="employee-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="employee@vitaran.com"
              disabled={pending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="employee-password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="employee-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 4 characters"
                disabled={pending}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
        </div>

        {error ? <FieldError className="mt-3">{error}</FieldError> : null}

        <div className="mt-4 flex justify-end">
          <Button type="button" disabled={pending} onClick={create} className="gap-1.5">
            {pending && !busyId ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Add employee
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-brand-200 bg-white shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]">
        <div className="border-b border-brand-100 px-5 py-3">
          <h2 className="text-sm font-bold text-brand-950">
            {rows.length} employee{rows.length === 1 ? "" : "s"}
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">
            No employees yet. Add one above so they can sign in at the admin login.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((row) => {
              const busy = pending && busyId === row.id;
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-950">{row.name}</p>
                    <p className="truncate text-xs text-neutral-500">{row.email}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
                      Password: {row.password || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={row.status === "ACTIVE"}
                      disabled={busy}
                      onCheckedChange={(checked) => setActive(row, checked)}
                      id={`employee-active-${row.id}`}
                    />
                    <label
                      htmlFor={`employee-active-${row.id}`}
                      className="text-xs font-semibold text-neutral-700"
                    >
                      {row.status === "ACTIVE" ? "Active" : "Disabled"}
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 text-red-700"
                    disabled={busy}
                    onClick={() => remove(row)}
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-2 text-xs text-neutral-500">
        <Plus className="mt-0.5 size-3.5 shrink-0" />
        Employees use the same admin login page and can do everything you can, including OMR scan
        on a separate device at the same time.
      </p>
    </div>
  );
}
