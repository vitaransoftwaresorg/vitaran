"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { subjectLabel } from "@/features/schools/constants";
import { cn } from "@/lib/utils";
import type { AppSettings, SmeContact } from "@/types/settings";
import { saveAdminSettingsAction } from "./actions";

const SUBJECT_OPTIONS = [
  "MATHEMATICS",
  "PHYSICS",
  "CHEMISTRY",
  "BIOLOGY",
  "SCIENCE",
  "ENGLISH",
] as const;

type AdminSettingsFormProps = {
  initial: AppSettings;
};

function emptySme(): SmeContact {
  return { name: "", subject: "MATHEMATICS", email: "" };
}

export function AdminSettingsForm({ initial }: AdminSettingsFormProps) {
  const [maintenanceMode, setMaintenanceMode] = useState(initial.maintenanceMode);
  const [vitaranEmail, setVitaranEmail] = useState(initial.vitaranEmail ?? "");
  const [smeContacts, setSmeContacts] = useState<SmeContact[]>(
    initial.smeContacts.length > 0 ? initial.smeContacts : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateSme(index: number, patch: Partial<SmeContact>) {
    setSmeContacts((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function submit() {
    const cleaned = smeContacts
      .map((row) => ({
        name: row.name.trim(),
        subject: row.subject.trim().toUpperCase(),
        email: row.email.trim().toLowerCase(),
      }))
      .filter((row) => row.name || row.email);

    for (const row of cleaned) {
      if (!row.name || !row.email || !row.subject) {
        setError("Each SME needs a name, subject, and email.");
        return;
      }
    }

    setError(null);
    startTransition(async () => {
      const result = await saveAdminSettingsAction({
        maintenanceMode,
        vitaranEmail: vitaranEmail.trim() || null,
        smeContacts: cleaned,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSmeContacts(result.settings.smeContacts);
      setVitaranEmail(result.settings.vitaranEmail ?? "");
      setMaintenanceMode(result.settings.maintenanceMode);
      toast.success("Settings saved");
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-brand-950">Maintenance mode</h2>
            <p className="mt-1 text-sm text-neutral-600">
              When on, school and teacher portals cannot use the app.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={maintenanceMode}
              onCheckedChange={setMaintenanceMode}
              disabled={pending}
              id="maintenance-mode"
            />
            <label htmlFor="maintenance-mode" className="text-sm font-semibold text-neutral-800">
              {maintenanceMode ? "On" : "Off"}
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-brand-200 bg-white p-5 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]">
        <div>
          <h2 className="text-sm font-bold text-brand-950">Objection emails</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Every objection goes to the Vitaran inbox. Matching subject SMEs are also emailed.
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="vitaran-email">Vitaran email</FieldLabel>
          <Input
            id="vitaran-email"
            type="email"
            value={vitaranEmail}
            onChange={(e) => setVitaranEmail(e.currentTarget.value)}
            placeholder="objections@vitaranlearning.com"
            disabled={pending}
          />
        </Field>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Subject SMEs
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setSmeContacts((current) => [...current, emptySme()])}
            >
              <Plus className="size-3.5" />
              Add SME
            </Button>
          </div>

          {smeContacts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-6 text-center text-sm text-neutral-500">
              No subject SMEs yet. Add one to route objections by subject.
            </p>
          ) : (
            <ul className="space-y-3">
              {smeContacts.map((row, index) => (
                <li
                  key={index}
                  className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.2fr)_auto]"
                >
                  <Field>
                    <FieldLabel>Name</FieldLabel>
                    <Input
                      value={row.name}
                      onChange={(e) => updateSme(index, { name: e.currentTarget.value })}
                      placeholder="SME name"
                      disabled={pending}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Subject</FieldLabel>
                    <Select
                      items={
                        SUBJECT_OPTIONS.includes(row.subject as (typeof SUBJECT_OPTIONS)[number])
                          ? SUBJECT_OPTIONS.map((subject) => ({
                              value: subject,
                              label: subjectLabel(subject),
                            }))
                          : [
                              { value: row.subject, label: subjectLabel(row.subject) },
                              ...SUBJECT_OPTIONS.map((subject) => ({
                                value: subject,
                                label: subjectLabel(subject),
                              })),
                            ]
                      }
                      value={row.subject}
                      onValueChange={(value) =>
                        updateSme(index, { subject: String(value ?? row.subject) })
                      }
                      disabled={pending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(SUBJECT_OPTIONS.includes(row.subject as (typeof SUBJECT_OPTIONS)[number])
                          ? [...SUBJECT_OPTIONS]
                          : [row.subject, ...SUBJECT_OPTIONS]
                        ).map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subjectLabel(subject)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Email</FieldLabel>
                    <Input
                      type="email"
                      value={row.email}
                      onChange={(e) => updateSme(index, { email: e.currentTarget.value })}
                      placeholder="sme@example.com"
                      disabled={pending}
                    />
                  </Field>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setSmeContacts((current) => current.filter((_, i) => i !== index))
                    }
                    className={cn(
                      "mt-6 inline-flex size-9 items-center justify-center self-start rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700",
                    )}
                    aria-label="Remove SME"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {error ? <FieldError>{error}</FieldError> : null}

      <div className="flex justify-end">
        <Button type="button" disabled={pending} onClick={submit} className="gap-1.5">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save settings
        </Button>
      </div>
    </div>
  );
}
