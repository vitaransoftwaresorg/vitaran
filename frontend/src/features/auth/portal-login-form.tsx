"use client";

import { useActionState, useId, useState } from "react";
import Form from "next/form";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ForgotPasswordForm } from "./forgot-password-form";
import { GoogleSignInButton } from "./google-sign-in-button";
import { portalLogin } from "./portal-login";
import type { LoginFormState } from "./schema";

const INPUT_CLASSES = "h-11 rounded-xl px-3.5";

export function PortalLoginForm({
  googleError,
  compact = false,
}: {
  googleError?: string | null;
  /** Header dropdown: form only, no marketing copy. */
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [identifier, setIdentifier] = useState("");
  const [forgotHint, setForgotHint] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [state, formAction, pending] = useActionState<LoginFormState, FormData>(
    portalLogin,
    undefined,
  );
  const id = useId();
  const identifierId = `${id}-identifier`;
  const passwordId = `${id}-password`;
  const identifierError = state?.fieldErrors?.identifier?.[0];
  const passwordError = state?.fieldErrors?.password?.[0];

  function startForgotPassword() {
    const value = identifier.trim();
    if (!value) {
      setForgotHint("Enter your login email above first, then click Forgot password.");
      return;
    }
    if (!value.includes("@")) {
      setForgotHint("Forgot password needs your login email (not a phone number). Enter it above.");
      return;
    }
    setForgotHint(null);
    setForgotEmail(value.toLowerCase());
    setMode("forgot");
  }

  if (mode === "forgot") {
    return (
      <ForgotPasswordForm
        initialEmail={forgotEmail}
        autoRequest
        onBackToLogin={() => setMode("login")}
        description={
          compact
            ? undefined
            : "Using the email from the sign-in form. We only send a code if it matches a school or teacher account."
        }
      />
    );
  }

  return (
    <div className={cn(!compact && "rounded-3xl bg-white p-7 shadow-2xl")}>
      {!compact ? (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-neutral-950">Portal sign in</h2>
        </div>
      ) : null}

      <Form key={state?.submittedAt ?? "login"} action={formAction} noValidate>
        <FieldGroup>
          {(state?.message || googleError) && (
            <Alert variant="destructive" className="rounded-xl border-destructive/20 bg-destructive/5">
              <AlertCircle />
              <AlertDescription>{state?.message ?? googleError}</AlertDescription>
            </Alert>
          )}
          {forgotHint && (
            <Alert className="rounded-xl border-amber-200 bg-amber-50 text-amber-950">
              <AlertCircle />
              <AlertDescription>{forgotHint}</AlertDescription>
            </Alert>
          )}

          <Field data-invalid={identifierError ? true : undefined}>
            <FieldLabel htmlFor={identifierId}>Email or phone number</FieldLabel>
            <Input
              id={identifierId}
              name="identifier"
              type="text"
              required
              autoComplete="username"
              autoFocus
              placeholder="you@example.com"
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                if (forgotHint) setForgotHint(null);
              }}
              aria-invalid={identifierError ? true : undefined}
              className={INPUT_CLASSES}
            />
            <FieldError>{identifierError}</FieldError>
          </Field>

          <Field data-invalid={passwordError ? true : undefined}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor={passwordId}>Password</FieldLabel>
              <button
                type="button"
                className="text-xs font-medium text-brand-800 hover:underline"
                onClick={startForgotPassword}
              >
                Forgot password?
              </button>
            </div>
            <Input
              id={passwordId}
              name="password"
              type="text"
              required
              autoComplete="current-password"
              spellCheck={false}
              placeholder="Enter your password"
              aria-invalid={passwordError ? true : undefined}
              className={INPUT_CLASSES}
            />
            <FieldError>{passwordError}</FieldError>
          </Field>

          <Button type="submit" disabled={pending} className="group h-11 w-full rounded-full text-sm font-semibold">
            {pending ? (
              <>
                <Loader2 className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </FieldGroup>
      </Form>
      <div className="mt-5 space-y-5">
        <p className="relative text-center text-xs font-medium text-neutral-400">
          <span className="absolute inset-x-0 top-1/2 border-t border-neutral-200" />
          <span className="relative bg-white px-2">or</span>
        </p>
        <GoogleSignInButton />
      </div>
    </div>
  );
}
