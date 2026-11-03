"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  resetSchoolPasswordAction,
  sendSchoolCredentialsAction,
} from "@/features/schools/actions";
import { CopyButton } from "@/features/schools/copy-button";
import {
  resetStudentPasswordAction,
  sendStudentCredentialsAction,
} from "@/features/students/actions";
import {
  resetAdminStudentPasswordAction,
  sendAdminStudentCredentialsAction,
} from "@/features/students/admin-student-actions";
import {
  resetAdminTeacherPasswordAction,
  resetSchoolTeacherPasswordAction,
  sendAdminTeacherCredentialsAction,
  sendSchoolTeacherCredentialsAction,
} from "@/features/teachers/actions";

type MailResult = { ok: true; to: string } | { ok: false; message: string };

type CredentialTarget =
  | { kind: "school"; id: string }
  | { kind: "admin-teacher"; id: string }
  | { kind: "school-teacher"; id: string }
  | { kind: "school-student"; id: string }
  | { kind: "admin-student"; id: string };

type CredentialMailBarProps = {
  loginEmail: string;
  loginPhone?: string | null;
  /** Shown instead of email when set (e.g. student registration number). */
  loginLabel?: string;
  loginValue?: string | null;
  password: string | null;
  setPasswordHref?: string;
  onSetPassword?: () => void;
  /** Who receives the mail (shown in copy). */
  recipientLabel: string;
  target: CredentialTarget;
};

function suggestPassword() {
  const chunk = Math.random().toString(36).slice(2, 6);
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${chunk}${digits}`;
}

async function sendCredentials(target: CredentialTarget): Promise<MailResult> {
  if (target.kind === "school") return sendSchoolCredentialsAction(target.id);
  if (target.kind === "admin-teacher") return sendAdminTeacherCredentialsAction(target.id);
  if (target.kind === "school-student") return sendStudentCredentialsAction(target.id);
  if (target.kind === "admin-student") return sendAdminStudentCredentialsAction(target.id);
  return sendSchoolTeacherCredentialsAction(target.id);
}

async function resetPassword(target: CredentialTarget, password: string): Promise<MailResult> {
  if (target.kind === "school") return resetSchoolPasswordAction(target.id, password);
  if (target.kind === "admin-teacher") return resetAdminTeacherPasswordAction(target.id, password);
  if (target.kind === "school-student") return resetStudentPasswordAction(target.id, password);
  if (target.kind === "admin-student") return resetAdminStudentPasswordAction(target.id, password);
  return resetSchoolTeacherPasswordAction(target.id, password);
}

/** Footer with visible credentials plus Send / Reset password actions. */
export function CredentialMailBar({
  loginEmail,
  loginPhone,
  loginLabel,
  loginValue,
  password,
  setPasswordHref,
  onSetPassword,
  recipientLabel,
  target,
}: CredentialMailBarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const send = () =>
    startTransition(async () => {
      const result = await sendCredentials(target);
      if (result.ok) toast.success(`Credentials emailed to ${result.to}`);
      else toast.error(result.message);
    });

  const openReset = () => {
    setNewPassword(suggestPassword());
    setResetOpen(true);
  };

  const confirmReset = () => {
    const next = newPassword.trim();
    if (next.length < 4) {
      toast.error("Use at least 4 characters for the password.");
      return;
    }
    startTransition(async () => {
      const result = await resetPassword(target, next);
      if (result.ok) {
        toast.success(`New password emailed to ${result.to}`);
        setResetOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <>
      <footer className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-neutral-500 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.18)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {loginLabel && loginValue ? (
            <span>
              {loginLabel}: <span className="font-semibold text-neutral-950">{loginValue}</span>
            </span>
          ) : (
            <span>
              Login email: <span className="font-semibold text-neutral-950">{loginEmail || "—"}</span>
            </span>
          )}
          {loginEmail && loginLabel ? (
            <>
              <span aria-hidden>·</span>
              <span>
                Email: <span className="font-semibold text-neutral-950">{loginEmail}</span>
              </span>
            </>
          ) : null}
          {loginPhone ? (
            <>
              <span aria-hidden>·</span>
              <span>
                Phone: <span className="font-semibold text-neutral-950">{loginPhone}</span>
              </span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            Password:
            {password ? (
              <>
                <span className="font-mono font-semibold text-neutral-950">{password}</span>
                <CopyButton value={password} label="Password" />
              </>
            ) : onSetPassword ? (
              <button
                type="button"
                onClick={onSetPassword}
                className="font-semibold text-neutral-950 underline underline-offset-4"
              >
                Set password
              </button>
            ) : setPasswordHref ? (
              <Link
                href={setPasswordHref}
                className="font-semibold text-neutral-950 underline underline-offset-4"
              >
                Set password
              </Link>
            ) : (
              <span className="font-semibold text-neutral-950">—</span>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !password || !loginEmail}
            onClick={send}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Mail />}
            Send credentials
          </Button>
          <Button type="button" size="sm" disabled={pending || !loginEmail} onClick={openReset}>
            <KeyRound />
            Reset password
          </Button>
        </div>
      </footer>

      <AlertDialog open={resetOpen} onOpenChange={(open) => !pending && setResetOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset password</AlertDialogTitle>
            <AlertDialogDescription>
              Set a new password for this {recipientLabel}. We&apos;ll email it to{" "}
              <span className="font-medium text-foreground">{loginEmail}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Field>
            <FieldLabel htmlFor="reset-password">New password</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="reset-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={pending}
                onClick={() => setNewPassword(suggestPassword())}
                aria-label="Suggest password"
              >
                <RefreshCw />
              </Button>
            </div>
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={pending} onClick={confirmReset}>
              {pending ? <Loader2 className="animate-spin" /> : <Mail />}
              Save &amp; email
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
