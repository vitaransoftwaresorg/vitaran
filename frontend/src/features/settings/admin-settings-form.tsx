"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, Plus, Settings2, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AdminSettingsFormProps = {
  initial: AppSettings;
};

function emptySme(): SmeContact {
  return { name: "", subject: "MATHEMATICS", email: "" };
}

function subjectItems(subject: string) {
  const known = SUBJECT_OPTIONS.includes(subject as (typeof SUBJECT_OPTIONS)[number]);
  const options = known ? [...SUBJECT_OPTIONS] : [subject, ...SUBJECT_OPTIONS];
  return options.map((value) => ({ value, label: subjectLabel(value) }));
}

export function AdminSettingsForm({ initial }: AdminSettingsFormProps) {
  const [maintenanceMode, setMaintenanceMode] = useState(initial.maintenanceMode);
  const [teacherResourcesPublic, setTeacherResourcesPublic] = useState(
    initial.teacherResourcesPublic,
  );
  const [vitaranEmails, setVitaranEmails] = useState<string[]>(
    initial.vitaranEmails.length > 0 ? initial.vitaranEmails : [""],
  );
  const [smeContacts, setSmeContacts] = useState<SmeContact[]>(initial.smeContacts);
  const [drafts, setDrafts] = useState<SmeContact[]>([emptySme()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateDraft(index: number, patch: Partial<SmeContact>) {
    setDrafts((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addDraftRows(count = 1) {
    setDrafts((current) => [...current, ...Array.from({ length: count }, () => emptySme())]);
  }

  function appendDraftsToList() {
    const cleaned = drafts
      .map((row) => ({
        name: row.name.trim(),
        subject: row.subject.trim().toUpperCase(),
        email: row.email.trim().toLowerCase(),
      }))
      .filter((row) => row.name || row.email);

    if (cleaned.length === 0) {
      setError("Enter at least one SME with a name and email.");
      return;
    }
    for (const row of cleaned) {
      if (!row.name || !row.email || !row.subject) {
        setError("Each SME needs a name, subject, and email.");
        return;
      }
      if (!EMAIL.test(row.email)) {
        setError(`Enter a valid SME email (${row.email}).`);
        return;
      }
    }

    const existing = new Set(smeContacts.map((row) => `${row.email}|${row.subject}`));
    const fresh = cleaned.filter((row) => !existing.has(`${row.email}|${row.subject}`));
    if (fresh.length === 0) {
      setError("Those SMEs are already in the list.");
      return;
    }

    setError(null);
    setSmeContacts((current) => [...current, ...fresh]);
    setDrafts([emptySme()]);
    toast.success(
      fresh.length === 1 ? "SME added to the list" : `${fresh.length} SMEs added to the list`,
    );
  }

  function submit() {
    const inboxes = [
      ...new Set(vitaranEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    ];
    const badInbox = inboxes.find((email) => !EMAIL.test(email));
    if (badInbox) {
      setError(`Enter a valid Vitaran email (${badInbox}).`);
      return;
    }

    const pendingDrafts = drafts
      .map((row) => ({
        name: row.name.trim(),
        subject: row.subject.trim().toUpperCase(),
        email: row.email.trim().toLowerCase(),
      }))
      .filter((row) => row.name || row.email);

    for (const row of pendingDrafts) {
      if (!row.name || !row.email || !row.subject) {
        setError("Finish or clear the Add SMEs rows before saving.");
        return;
      }
      if (!EMAIL.test(row.email)) {
        setError(`Enter a valid SME email (${row.email}).`);
        return;
      }
    }

    const merged = [...smeContacts];
    const existing = new Set(merged.map((row) => `${row.email}|${row.subject}`));
    for (const row of pendingDrafts) {
      if (!existing.has(`${row.email}|${row.subject}`)) {
        merged.push(row);
        existing.add(`${row.email}|${row.subject}`);
      }
    }

    setError(null);
    startTransition(async () => {
      const result = await saveAdminSettingsAction({
        maintenanceMode,
        teacherResourcesPublic,
        vitaranEmails: inboxes,
        smeContacts: merged,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSmeContacts(result.settings.smeContacts);
      setDrafts([emptySme()]);
      setVitaranEmails(
        result.settings.vitaranEmails.length > 0 ? result.settings.vitaranEmails : [""],
      );
      setMaintenanceMode(result.settings.maintenanceMode);
      setTeacherResourcesPublic(result.settings.teacherResourcesPublic);
      toast.success("Settings saved");
    });
  }

  const saveBar = (
    <>
      {error ? <FieldError>{error}</FieldError> : null}
      <div className="flex justify-end">
        <Button type="button" disabled={pending} onClick={submit} className="gap-1.5">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save settings
        </Button>
      </div>
    </>
  );

  return (
    <Tabs defaultValue="general" className="gap-5">
      <div className="overflow-x-auto border-b border-brand-100">
        <TabsList variant="line" className="h-10 gap-4">
          <TabsTrigger value="general" className="px-1">
            <Settings2 />
            General
          </TabsTrigger>
          <TabsTrigger value="emails" className="px-1">
            <Mail />
            Objection emails
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="general" className="space-y-6">
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

        <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-brand-950">Teacher resources</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Public: anyone can open Teachers Resources on the website. Private: login
                required (school or teacher portal).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={teacherResourcesPublic}
                onCheckedChange={setTeacherResourcesPublic}
                disabled={pending}
                id="teacher-resources-public"
              />
              <label
                htmlFor="teacher-resources-public"
                className="text-sm font-semibold text-neutral-800"
              >
                {teacherResourcesPublic ? "Public" : "Private"}
              </label>
            </div>
          </div>
        </section>
        {saveBar}
      </TabsContent>

      <TabsContent value="emails" className="space-y-6">
        <section className="space-y-4 rounded-xl border border-brand-200 bg-white p-5 shadow-[0_4px_16px_-8px_rgb(25_28_95/0.12)]">
          <div>
            <h2 className="text-sm font-bold text-brand-950">Objection emails</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Every objection goes to all Vitaran inboxes. Matching subject SMEs are also emailed.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                Vitaran emails
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setVitaranEmails((current) => [...current, ""])}
              >
                <Plus className="size-3.5" />
                Add email
              </Button>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {vitaranEmails.map((email, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Input
                    type="email"
                    aria-label={`Vitaran email ${index + 1}`}
                    value={email}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setVitaranEmails((current) =>
                        current.map((row, i) => (i === index ? value : row)),
                      );
                    }}
                    placeholder="objections@vitaranlearning.com"
                    disabled={pending}
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setVitaranEmails((current) =>
                        current.length > 1 ? current.filter((_, i) => i !== index) : [""],
                      )
                    }
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700"
                    aria-label="Remove email"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4 border-t border-brand-100 pt-4">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                Add SMEs
              </h3>
              <p className="mt-1 text-sm text-neutral-600">
                Fill one or more rows, then add them to the list. Save settings to keep them.
              </p>
            </div>

            <ul className="space-y-3">
              {drafts.map((row, index) => (
                <li
                  key={index}
                  className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.2fr)_auto]"
                >
                  <Field>
                    <FieldLabel>Name</FieldLabel>
                    <Input
                      value={row.name}
                      onChange={(e) => updateDraft(index, { name: e.currentTarget.value })}
                      placeholder="SME name"
                      disabled={pending}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Subject</FieldLabel>
                    <Select
                      items={subjectItems(row.subject)}
                      value={row.subject}
                      onValueChange={(value) =>
                        updateDraft(index, { subject: String(value ?? row.subject) })
                      }
                      disabled={pending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectItems(row.subject).map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
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
                      onChange={(e) => updateDraft(index, { email: e.currentTarget.value })}
                      placeholder="sme@example.com"
                      disabled={pending}
                    />
                  </Field>
                  <button
                    type="button"
                    disabled={pending || drafts.length === 1}
                    onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                    className={cn(
                      "mt-6 inline-flex size-9 items-center justify-center self-start rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40",
                    )}
                    aria-label="Remove draft row"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => addDraftRows(1)}
              >
                <Plus className="size-3.5" />
                Another row
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => addDraftRows(3)}
              >
                <Plus className="size-3.5" />
                Add 3 rows
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={appendDraftsToList}>
                Add to list
              </Button>
            </div>
          </div>

          <div className="space-y-3 border-t border-brand-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
                Added SMEs
              </h3>
              <span className="text-xs font-medium text-neutral-500 tabular-nums">
                {smeContacts.length} {smeContacts.length === 1 ? "SME" : "SMEs"}
              </span>
            </div>

            {smeContacts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-6 text-center text-sm text-neutral-500">
                No SMEs added yet. Use Add SMEs above, then Save settings.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                    <tr>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Subject</th>
                      <th className="px-3 py-2.5">Email</th>
                      <th className="px-3 py-2.5 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {smeContacts.map((row, index) => (
                      <tr
                        key={`${row.email}-${row.subject}-${index}`}
                        className="border-b border-neutral-100 last:border-0"
                      >
                        <td className="px-3 py-2.5 font-medium text-neutral-950">{row.name}</td>
                        <td className="px-3 py-2.5 text-neutral-700">{subjectLabel(row.subject)}</td>
                        <td className="px-3 py-2.5 text-neutral-700">{row.email}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              setSmeContacts((current) => current.filter((_, i) => i !== index))
                            }
                            className="inline-flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Remove ${row.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {saveBar}
      </TabsContent>
    </Tabs>
  );
}
