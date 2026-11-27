"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES, TYPE_LABELS } from "@/features/schools/constants";
import { SchoolFormStepper } from "@/features/schools/school-form-stepper";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { cn } from "@/lib/utils";
import type { HeadOffice } from "@/types/head-office";
import type { SchoolSummary } from "@/types/school";
import { type HeadOfficeFormState, type HeadOfficeFormValues } from "./actions";

const NEUTRAL_THEME =
  "text-neutral-950 [--primary:var(--color-neutral-950)] [--primary-foreground:var(--color-white)] [--foreground:var(--color-neutral-950)] [--muted:var(--color-neutral-100)] [--muted-foreground:var(--color-neutral-500)] [--border:var(--color-neutral-200)] [--input:var(--color-neutral-300)] [--ring:var(--color-neutral-400)]";

const ROOMY_CONTROLS =
  "[&_[data-slot=input]]:h-10 [&_[data-slot=input]]:px-3 [&_[data-slot=select-trigger]]:h-10! [&_[data-slot=select-trigger]]:px-3";

const FORM_STEPS = [
  { id: "office", title: "Office", fields: [] as const },
  { id: "schools", title: "Schools", fields: [] as const },
] as const;

const stateItems = INDIAN_STATES.map((value) => ({ value, label: value }));

const STEP1_FIELDS: Array<keyof HeadOfficeFormValues> = [
  "name",
  "contactName",
  "contactEmail",
  "contactPhone",
  "password",
  "addressLine",
  "city",
  "state",
  "pincode",
  "notes",
];

type HeadOfficeFormProps = {
  office?: HeadOffice;
  /** Next 6-digit code for create — assigned automatically. */
  nextCode?: string;
  schools: SchoolSummary[];
  action: (state: HeadOfficeFormState, formData: FormData) => Promise<HeadOfficeFormState>;
};

function toValues(office?: HeadOffice, nextCode = ""): HeadOfficeFormValues {
  return {
    name: office?.name ?? "",
    code: office?.code ?? nextCode,
    contactName: office?.contactName ?? "",
    contactEmail: office?.contactEmail ?? "",
    contactPhone: office?.contactPhone ?? "",
    addressLine: office?.addressLine ?? "",
    city: office?.city ?? "",
    state: office?.state ?? "",
    pincode: office?.pincode ?? "",
    notes: office?.notes ?? "",
    password: "",
    schoolIds: office?.schools.map((school) => school.id) ?? [],
  };
}

type ClientErrors = Partial<Record<keyof HeadOfficeFormValues, string>>;

function validateOfficeDetails(input: {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  password: string;
}): ClientErrors {
  const next: ClientErrors = {};
  const name = input.name.trim();
  if (!name) next.name = "Enter the office name.";
  else if (name.length < 2) next.name = "Enter at least 2 characters.";

  const contactName = input.contactName.trim();
  if (!contactName) next.contactName = "Enter the contact name.";
  else if (contactName.length < 2) next.contactName = "Enter at least 2 characters.";

  const contactEmail = input.contactEmail.trim();
  if (!contactEmail) next.contactEmail = "Enter a valid email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    next.contactEmail = "Enter a valid email.";
  }

  const contactPhone = input.contactPhone.trim();
  if (!contactPhone) next.contactPhone = "Enter a phone number.";
  else if (!/^\d{10}$/.test(contactPhone)) next.contactPhone = "Enter a 10-digit phone number.";

  const password = input.password.trim();
  if (!password) next.password = "Enter a portal password.";
  else if (password.length < 4) next.password = "Use at least 4 characters.";

  const addressLine = input.addressLine.trim();
  if (!addressLine) next.addressLine = "Enter the address.";
  else if (addressLine.length < 3) next.addressLine = "Enter at least 3 characters.";

  const city = input.city.trim();
  if (!city) next.city = "Enter the city.";
  else if (city.length < 2) next.city = "Enter at least 2 characters.";

  if (!input.state.trim()) next.state = "Select a state.";

  const pincode = input.pincode.trim();
  if (!pincode) next.pincode = "Enter a 6-digit pincode.";
  else if (!/^\d{6}$/.test(pincode)) next.pincode = "Enter a 6-digit pincode.";

  if (input.notes.trim().length > 1000) next.notes = "Keep notes under 1000 characters.";

  return next;
}

export function HeadOfficeForm({ office, nextCode, schools, action }: HeadOfficeFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = state?.status === "error" ? state.values : toValues(office, nextCode);
  const isEdit = Boolean(office);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [name, setName] = useState(values.name);
  const code = office?.code ?? nextCode ?? values.code;
  const [contactName, setContactName] = useState(values.contactName);
  const [contactEmail, setContactEmail] = useState(values.contactEmail);
  const [contactPhone, setContactPhone] = useState(values.contactPhone);
  const [addressLine, setAddressLine] = useState(values.addressLine);
  const [city, setCity] = useState(values.city);
  const [stateName, setStateName] = useState(values.state);
  const [pincode, setPincode] = useState(values.pincode);
  const [notes, setNotes] = useState(values.notes);
  const [password, setPassword] = useState(values.password);
  const [schoolIds, setSchoolIds] = useState(values.schoolIds);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<ClientErrors>({});
  const [dirty, setDirty] = useState(false);
  /** Enter in school search / checkbox focus must not create the office — only Submit. */
  const submitIntentRef = useRef(false);
  const serverErrors = state?.status === "error" ? state.fieldErrors : undefined;
  const errors = useMemo(() => {
    const merged: Partial<Record<keyof HeadOfficeFormValues, string[]>> = {
      ...serverErrors,
    };
    for (const [key, message] of Object.entries(clientErrors) as Array<
      [keyof HeadOfficeFormValues, string]
    >) {
      if (message) merged[key] = [message];
    }
    return merged;
  }, [serverErrors, clientErrors]);
  const cancelHref = office ? `/admin/head-offices/${office.id}` : "/admin/head-offices";
  const isLast = step === FORM_STEPS.length - 1;
  const unsaved = useUnsavedChanges(dirty && !pending);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isEdit) {
      if (!dirty) {
        event.preventDefault();
        return;
      }
      unsaved.markClean();
      return;
    }
    if (!submitIntentRef.current) {
      event.preventDefault();
      return;
    }
    submitIntentRef.current = false;
    unsaved.markClean();
  }

  function clearFieldError(field: keyof HeadOfficeFormValues) {
    setClientErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  useEffect(() => {
    if (state?.status === "success") {
      toast.success(isEdit ? "Head office updated" : "Head office created");
      router.push(`/admin/head-offices/${state.officeId}`);
      router.refresh();
    }
  }, [state, isEdit, router]);

  useEffect(() => {
    if (state?.status !== "error" || !errors || isEdit) return;
    const hasStep1Error = STEP1_FIELDS.some((field) => Boolean(errors[field]?.[0]));
    setStep(hasStep1Error ? 0 : 1);
  }, [state, errors, isEdit]);

  const filteredSchools = useMemo(() => {
    const needle = schoolQuery.trim().toLowerCase();
    const sorted = [...schools].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return sorted;
    return sorted.filter(
      (school) =>
        school.name.toLowerCase().includes(needle) ||
        school.code.toLowerCase().includes(needle) ||
        school.city.toLowerCase().includes(needle),
    );
  }, [schools, schoolQuery]);

  function markDirty() {
    setDirty(true);
  }

  function toggleSchool(id: string, checked: boolean) {
    markDirty();
    setSchoolIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
  }

  function goToStep(index: number) {
    if (index > maxReached && index > step) return;
    setStepError(null);
    setStep(index);
  }

  function goNext() {
    const nextErrors = validateOfficeDetails({
      name,
      contactName,
      contactEmail,
      contactPhone,
      addressLine,
      city,
      state: stateName,
      pincode,
      notes,
      password,
    });
    if (Object.keys(nextErrors).length > 0) {
      setClientErrors(nextErrors);
      setStepError("Check the highlighted fields.");
      const first = (
        [
          "name",
          "contactName",
          "contactPhone",
          "contactEmail",
          "password",
          "addressLine",
          "city",
          "state",
          "pincode",
          "notes",
        ] as const
      ).find((field) => nextErrors[field]);
      if (first) {
        requestAnimationFrame(() => {
          document.getElementById(first)?.focus();
        });
      }
      return;
    }
    setClientErrors({});
    setStepError(null);
    setMaxReached((current) => Math.max(current, 1));
    setStep(1);
  }

  function fieldError(name: keyof HeadOfficeFormValues) {
    return errors?.[name]?.[0] ? <FieldError>{errors[name]?.[0]}</FieldError> : null;
  }

  function invalid(name: keyof HeadOfficeFormValues) {
    return errors?.[name] ? true : undefined;
  }

  const officeFields = (
    <div className="grid gap-4 md:grid-cols-2">
      <Field data-invalid={invalid("name")}>
        <FieldLabel htmlFor="name">Office Name *</FieldLabel>
        <Input
          id="name"
          name="name"
          value={name}
          aria-invalid={invalid("name")}
          onChange={(event) => {
            markDirty();
            clearFieldError("name");
            setName(event.target.value);
          }}
          placeholder="e.g. Vitaran Hyderabad HO"
          autoComplete="organization"
          required
        />
        {fieldError("name")}
      </Field>
      <Field>
        <FieldLabel htmlFor="code">Office Code</FieldLabel>
        <Input
          id="code"
          name="code"
          value={code}
          readOnly
          autoComplete="off"
          spellCheck={false}
          className="font-mono bg-neutral-50"
        />
        <p className="text-xs text-neutral-500">
          {isEdit ? "Assigned when the office was created." : "Auto-generated 6-digit code."}
        </p>
        {fieldError("code")}
      </Field>
      <Field data-invalid={invalid("contactName")}>
        <FieldLabel htmlFor="contactName">Contact Name *</FieldLabel>
        <Input
          id="contactName"
          name="contactName"
          value={contactName}
          aria-invalid={invalid("contactName")}
          onChange={(event) => {
            markDirty();
            clearFieldError("contactName");
            setContactName(event.target.value);
          }}
          required
        />
        {fieldError("contactName")}
      </Field>
      <Field data-invalid={invalid("contactPhone")}>
        <FieldLabel htmlFor="contactPhone">Contact Phone *</FieldLabel>
        <Input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={contactPhone}
          aria-invalid={invalid("contactPhone")}
          onChange={(event) => {
            markDirty();
            clearFieldError("contactPhone");
            setContactPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
          }}
          placeholder="9876543210"
          required
        />
        {fieldError("contactPhone")}
      </Field>
      <Field data-invalid={invalid("contactEmail")} className="md:col-span-2">
        <FieldLabel htmlFor="contactEmail">Contact Email *</FieldLabel>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          value={contactEmail}
          aria-invalid={invalid("contactEmail")}
          onChange={(event) => {
            markDirty();
            clearFieldError("contactEmail");
            setContactEmail(event.target.value);
          }}
          required
        />
        {fieldError("contactEmail")}
      </Field>
      <Field data-invalid={invalid("password")} className="md:col-span-2">
        <FieldLabel htmlFor="password">Portal Password *</FieldLabel>
        <Input
          id="password"
          name="password"
          type="text"
          value={password}
          aria-invalid={invalid("password")}
          autoComplete="off"
          spellCheck={false}
          placeholder="Set a login password"
          onChange={(event) => {
            markDirty();
            clearFieldError("password");
            setPassword(event.target.value);
          }}
          required
        />
        {fieldError("password")}
      </Field>
      <Field data-invalid={invalid("addressLine")} className="md:col-span-2">
        <FieldLabel htmlFor="addressLine">Address *</FieldLabel>
        <Input
          id="addressLine"
          name="addressLine"
          value={addressLine}
          aria-invalid={invalid("addressLine")}
          onChange={(event) => {
            markDirty();
            clearFieldError("addressLine");
            setAddressLine(event.target.value);
          }}
          required
        />
        {fieldError("addressLine")}
      </Field>
      <Field data-invalid={invalid("city")}>
        <FieldLabel htmlFor="city">City *</FieldLabel>
        <Input
          id="city"
          name="city"
          value={city}
          aria-invalid={invalid("city")}
          onChange={(event) => {
            markDirty();
            clearFieldError("city");
            setCity(event.target.value);
          }}
          required
        />
        {fieldError("city")}
      </Field>
      <Field data-invalid={invalid("state")}>
        <FieldLabel htmlFor="state">State *</FieldLabel>
        <Select
          name="state"
          items={stateItems}
          value={stateName || null}
          onValueChange={(next) => {
            if (next == null) return;
            markDirty();
            clearFieldError("state");
            setStateName(String(next));
          }}
        >
          <SelectTrigger id="state" className="w-full" aria-invalid={invalid("state")}>
            <SelectValue placeholder="Select a state" />
          </SelectTrigger>
          <SelectContent>
            {stateItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldError("state")}
      </Field>
      <Field data-invalid={invalid("pincode")}>
        <FieldLabel htmlFor="pincode">Pincode *</FieldLabel>
        <Input
          id="pincode"
          name="pincode"
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          aria-invalid={invalid("pincode")}
          onChange={(event) => {
            markDirty();
            clearFieldError("pincode");
            setPincode(event.target.value.replace(/\D/g, "").slice(0, 6));
          }}
          required
        />
        {fieldError("pincode")}
      </Field>
      <Field data-invalid={invalid("notes")} className="md:col-span-2">
        <FieldLabel htmlFor="notes">Notes</FieldLabel>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          value={notes}
          aria-invalid={invalid("notes")}
          onChange={(event) => {
            markDirty();
            clearFieldError("notes");
            setNotes(event.target.value);
          }}
          placeholder="Optional"
        />
        {fieldError("notes")}
      </Field>
    </div>
  );

  const schoolsFields = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-neutral-600">
          Select schools for this head office ({schoolIds.length} selected).
        </p>
        <label className="relative block w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={schoolQuery}
            onChange={(event) => setSchoolQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter would otherwise submit the create form.
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder="Search schools"
            className="h-10 pr-3 pl-9!"
            aria-label="Search schools"
          />
        </label>
      </div>
      {fieldError("schoolIds")}
      {schools.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
          No schools registered yet. You can save the office and add schools later.
        </p>
      ) : filteredSchools.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
          No schools match “{schoolQuery}”.
        </p>
      ) : (
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-neutral-200 p-2">
          {filteredSchools.map((school) => {
            const checked = schoolIds.includes(school.id);
            return (
              <label
                key={school.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-neutral-50",
                  checked && "bg-neutral-100",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border-neutral-300"
                  checked={checked}
                  onChange={(event) => toggleSchool(school.id, event.target.checked)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-neutral-950">{school.name}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {school.code} · {TYPE_LABELS[school.type]} · {school.city}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );

  const errorMessage =
    stepError ?? (state?.status === "error" ? state.message : undefined);

  return (
    <>
      <Form
        ref={unsaved.formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className={cn("scroll-mt-20 space-y-4", NEUTRAL_THEME, ROOMY_CONTROLS)}
        noValidate
      >
        {schoolIds.map((id) => (
          <input key={id} type="hidden" name="schoolIds" value={id} />
        ))}

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-clip rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {!isEdit ? (
            <div className="border-b border-neutral-200 px-5 py-5 md:px-8">
              <SchoolFormStepper
                steps={FORM_STEPS}
                current={step}
                reachable={Math.max(maxReached, step)}
                onSelect={goToStep}
              />
            </div>
          ) : null}

          <div className="overflow-clip">
            <div className={cn("p-5 md:p-8", isEdit && "space-y-8")}>
              {isEdit ? (
                <>
                  <FormSection title="Office details">{officeFields}</FormSection>
                  <FormSection title="Schools">{schoolsFields}</FormSection>
                </>
              ) : (
                <>
                  <div hidden={step !== 0} className="space-y-6">
                    {officeFields}
                  </div>
                  <div hidden={step !== 1} className="space-y-6">
                    {schoolsFields}
                  </div>
                </>
              )}
            </div>

            {isEdit ? (
              <footer className="sticky bottom-0 z-10 flex min-h-17 items-center justify-between gap-2 border-t border-neutral-200 bg-white/95 px-5 py-3 backdrop-blur md:px-8">
                <Link
                  href={cancelHref}
                  className={buttonVariants({ variant: "ghost" })}
                  onClick={unsaved.guardCancelClick(cancelHref)}
                >
                  Cancel
                </Link>
                {dirty ? (
                  <Button
                    type="submit"
                    disabled={pending}
                    onClick={() => {
                      submitIntentRef.current = true;
                    }}
                  >
                    {pending ? <Loader2 className="animate-spin" /> : <Save />}
                    Save changes
                  </Button>
                ) : null}
              </footer>
            ) : (
              <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-4 md:px-8">
                <Link
                  href={cancelHref}
                  className={buttonVariants({ variant: "ghost" })}
                  onClick={unsaved.guardCancelClick(cancelHref)}
                >
                  Cancel
                </Link>
                <div className="flex gap-2">
                  {step > 0 ? (
                    <Button type="button" variant="outline" onClick={() => goToStep(step - 1)}>
                      <ArrowLeft />
                      Back
                    </Button>
                  ) : null}
                  {!isLast ? (
                    <Button type="button" onClick={goNext}>
                      Continue
                      <ArrowRight />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={pending}
                      onClick={() => {
                        submitIntentRef.current = true;
                      }}
                    >
                      {pending ? <Loader2 className="animate-spin" /> : <Save />}
                      Submit
                    </Button>
                  )}
                </div>
              </footer>
            )}
          </div>
        </div>
      </Form>
      {unsaved.dialog}
    </>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3
      data-slot="section-heading"
      className="border-b border-neutral-200 pb-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase"
    >
      {children}
    </h3>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}
