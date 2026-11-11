"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
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
import { ClassSubjectGrid } from "@/features/schools/class-subject-grid";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import type { SchoolProgramOffering } from "@/types/program";
import type { SchoolSection } from "@/types/section";
import type { Subject } from "@/types/school";
import type { ClassTeacherSlot, TeacherDetail } from "@/types/teacher";
import { TEACHER_STATUS_LABELS } from "./constants";
import { capitalizeInput } from "@/lib/name-case";
import type { TeacherFormState, TeacherFormValues } from "./actions";

type TeacherFormProps = {
  teacher?: TeacherDetail;
  schoolPrograms: SchoolProgramOffering[];
  sections: SchoolSection[];
  classTeacherSlots: ClassTeacherSlot[];
  /** Encoded tokens this teacher already owns. */
  myClassTeacherTokens?: string[];
  action: (state: TeacherFormState, formData: FormData) => Promise<TeacherFormState>;
  cancelHref: string;
  successHref: string;
};

function encodeAssignment(programId: string, classLevel: number, subject: Subject) {
  return `${programId}:${classLevel}:${subject}`;
}

function encodeClassSlot(programId: string, classLevel: number) {
  return `class:${programId}:${classLevel}`;
}

function encodeSectionSlot(sectionId: string) {
  return `section:${sectionId}`;
}

function toValues(teacher?: TeacherDetail, myTokens: string[] = []): TeacherFormValues {
  return {
    name: teacher?.name ?? "",
    email: teacher?.email ?? "",
    phone: teacher?.phone ?? "",
    status: teacher?.status ?? "ACTIVE",
    password: teacher?.password ?? "",
    assignments:
      teacher?.assignments.map((item) =>
        encodeAssignment(item.programId, item.classLevel, item.subject),
      ) ?? [],
    classTeacherFor: myTokens,
  };
}

export function TeacherForm({
  teacher,
  schoolPrograms,
  sections,
  classTeacherSlots,
  myClassTeacherTokens = [],
  action,
  cancelHref,
  successHref,
}: TeacherFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const isEdit = !!teacher;
  const formKey =
    state?.status === "error" ? `error-${state.submittedAt}` : teacher?.id ?? "new";

  return (
    <TeacherFormFields
      key={formKey}
      teacher={teacher}
      schoolPrograms={schoolPrograms}
      sections={sections}
      classTeacherSlots={classTeacherSlots}
      myClassTeacherTokens={myClassTeacherTokens}
      formAction={formAction}
      pending={pending}
      state={state}
      cancelHref={cancelHref}
      successHref={successHref}
      isEdit={isEdit}
      onSuccess={(teacherId) => {
        toast.success(isEdit ? "Teacher updated" : "Teacher created");
        router.replace(successHref.replaceAll("{id}", teacherId));
      }}
    />
  );
}

function TeacherFormFields({
  teacher,
  schoolPrograms,
  sections,
  classTeacherSlots,
  myClassTeacherTokens = [],
  formAction,
  pending,
  state,
  cancelHref,
  successHref,
  isEdit,
  onSuccess,
}: Omit<TeacherFormProps, "action"> & {
  formAction: (payload: FormData) => void;
  pending: boolean;
  state: TeacherFormState;
  isEdit: boolean;
  onSuccess: (teacherId: string) => void;
}) {
  void successHref;
  const values =
    state?.status === "error" ? state.values : toValues(teacher, myClassTeacherTokens);
  const [assignments, setAssignments] = useState(values.assignments);
  const [classTeacherFor, setClassTeacherFor] = useState(values.classTeacherFor);
  const [selectedSectionByClass, setSelectedSectionByClass] = useState<Record<string, string>>(
    {},
  );
  const [selectedIds, setSelectedIds] = useState(() => {
    const ids = new Set<string>();
    for (const token of values.assignments) {
      const programId = token.split(":")[0];
      if (programId) ids.add(programId);
    }
    return ids;
  });
  const [baseline] = useState(() => ({
    assignments: values.assignments.slice().sort().join("|"),
    classTeacherFor: values.classTeacherFor.slice().sort().join("|"),
  }));
  const [profileDirty, setProfileDirty] = useState(false);
  const dirty =
    profileDirty ||
    assignments.slice().sort().join("|") !== baseline.assignments ||
    classTeacherFor.slice().sort().join("|") !== baseline.classTeacherFor;

  const { formRef, markClean, guardCancelClick, dialog } = useUnsavedChanges(isEdit && dirty);
  const errors = state?.status === "error" ? state.fieldErrors : undefined;

  const occupiedClassByOther = useMemo(() => {
    const map = new Map<string, ClassTeacherSlot>();
    for (const slot of classTeacherSlots) {
      if (slot.kind !== "class") continue;
      if (teacher && slot.teacherId === teacher.id) continue;
      map.set(`${slot.programId}:${slot.classLevel}`, slot);
    }
    return map;
  }, [classTeacherSlots, teacher]);

  const occupiedSectionByOther = useMemo(() => {
    const map = new Map<string, ClassTeacherSlot>();
    for (const slot of classTeacherSlots) {
      if (slot.kind !== "section") continue;
      if (teacher && slot.teacherId === teacher.id) continue;
      map.set(slot.sectionId, slot);
    }
    return map;
  }, [classTeacherSlots, teacher]);

  const sectionsByProgramClass = useMemo(() => {
    const map = new Map<string, SchoolSection[]>();
    for (const section of sections) {
      const key = `${section.programId}:${section.classLevel}`;
      const list = map.get(key) ?? [];
      list.push(section);
      map.set(key, list);
    }
    return map;
  }, [sections]);

  const selectedPrograms = useMemo(
    () => schoolPrograms.filter((row) => selectedIds.has(row.programId)),
    [schoolPrograms, selectedIds],
  );

  useEffect(() => {
    if (state?.status === "success") {
      markClean();
      onSuccess(state.teacherId);
    } else if (state?.status === "error" && state.message && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, markClean, onSuccess]);

  const clearCtForClass = (programId: string, classLevel: number) => {
    const sectionIds = new Set(
      (sectionsByProgramClass.get(`${programId}:${classLevel}`) ?? []).map((row) => row.id),
    );
    setClassTeacherFor((slots) =>
      slots.filter((token) => {
        if (token === encodeClassSlot(programId, classLevel)) return false;
        if (token.startsWith("section:")) {
          return !sectionIds.has(token.slice("section:".length));
        }
        return true;
      }),
    );
  };

  const setToken = (programId: string, classLevel: number, subject: Subject, checked: boolean) => {
    const token = encodeAssignment(programId, classLevel, subject);
    setAssignments((prev) => {
      const next = checked
        ? [...prev.filter((item) => item !== token), token]
        : prev.filter((item) => item !== token);
      const stillHasClass = next.some((item) => item.startsWith(`${programId}:${classLevel}:`));
      if (!stillHasClass) clearCtForClass(programId, classLevel);
      return next;
    });
  };

  if (schoolPrograms.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Enrol this school in at least one program with classes before creating teachers.
      </div>
    );
  }

  return (
    <>
      <Form
        ref={formRef}
        action={formAction}
        noValidate
        className="space-y-4 overflow-clip rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5"
        onChange={() => {
          if (isEdit) setProfileDirty(true);
        }}
      >
        {assignments.map((value) => (
          <input key={value} type="hidden" name="assignments" value={value} />
        ))}
        {classTeacherFor.map((value) => (
          <input key={value} type="hidden" name="classTeacherFor" value={value} />
        ))}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Field data-invalid={errors?.name ? true : undefined} className="lg:col-span-3">
            <FieldLabel htmlFor="name">Full name *</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={values.name}
              autoCapitalize="words"
              onChange={(e) => capitalizeInput(e.currentTarget)}
            />
            {errors?.name && <FieldError>{errors.name[0]}</FieldError>}
          </Field>
          <Field data-invalid={errors?.status ? true : undefined} className="lg:col-span-3">
            <FieldLabel htmlFor="status">Status *</FieldLabel>
            <Select
              name="status"
              items={Object.entries(TEACHER_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              defaultValue={values.status}
              onValueChange={() => {
                if (isEdit) setProfileDirty(true);
              }}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TEACHER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field data-invalid={errors?.email ? true : undefined} className="lg:col-span-2">
            <FieldLabel htmlFor="email">Email *</FieldLabel>
            <Input id="email" name="email" type="email" defaultValue={values.email} />
            {errors?.email && <FieldError>{errors.email[0]}</FieldError>}
          </Field>
          <Field data-invalid={errors?.phone ? true : undefined} className="lg:col-span-2">
            <FieldLabel htmlFor="phone">Phone *</FieldLabel>
            <Input
              id="phone"
              name="phone"
              inputMode="numeric"
              maxLength={10}
              defaultValue={values.phone}
            />
            {errors?.phone && <FieldError>{errors.phone[0]}</FieldError>}
          </Field>
          <Field data-invalid={errors?.password ? true : undefined} className="lg:col-span-2">
            <FieldLabel htmlFor="password">{isEdit ? "Password" : "Password *"}</FieldLabel>
            <Input
              id="password"
              name="password"
              type="text"
              defaultValue={values.password}
              autoComplete="off"
              spellCheck={false}
              placeholder={isEdit ? "Leave blank to keep current" : undefined}
            />
            {errors?.password && <FieldError>{errors.password[0]}</FieldError>}
          </Field>
        </div>

        <section className="space-y-3 border-t border-neutral-200 pt-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-950">Programs & classes *</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              No sections → subjects, then class teacher. With sections → section, then subjects, then
              class teacher.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {schoolPrograms.map((row) => {
              const id = `teacher-program-${row.programId}`;
              return (
                <label
                  key={row.programId}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <input
                    id={id}
                    type="checkbox"
                    className="size-3.5 rounded border-neutral-300 accent-brand-800"
                    checked={selectedIds.has(row.programId)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(row.programId);
                        else next.delete(row.programId);
                        return next;
                      });
                      if (!checked) {
                        setAssignments((prev) =>
                          prev.filter((token) => !token.startsWith(`${row.programId}:`)),
                        );
                        const programSectionIds = new Set(
                          sections.filter((s) => s.programId === row.programId).map((s) => s.id),
                        );
                        setClassTeacherFor((prev) =>
                          prev.filter((token) => {
                            if (token.startsWith(`class:${row.programId}:`)) return false;
                            if (token.startsWith("section:")) {
                              return !programSectionIds.has(token.slice("section:".length));
                            }
                            return true;
                          }),
                        );
                      }
                    }}
                  />
                  <span className="text-sm font-medium text-neutral-900">{row.programName}</span>
                </label>
              );
            })}
          </div>

          {selectedPrograms.map((offering) => (
            <div key={offering.programId} className="space-y-2">
              <h4 className="border-b border-neutral-200 pb-1.5 text-xs font-bold tracking-wide text-neutral-950 uppercase">
                {offering.programName}
              </h4>
              <ClassSubjectGrid
                idPrefix={`teacher-${offering.programId}`}
                columns={offering.classes.map((row) => ({
                  classLevel: row.classLevel,
                  subjects: row.subjects,
                }))}
                isSubjectChecked={(classLevel, subject) =>
                  assignments.includes(encodeAssignment(offering.programId, classLevel, subject))
                }
                onToggleSubject={(classLevel, subject, checked) =>
                  setToken(offering.programId, classLevel, subject, checked)
                }
                sectionsForClass={(classLevel) => {
                  const list =
                    sectionsByProgramClass.get(`${offering.programId}:${classLevel}`) ?? [];
                  return list.map((section) => ({
                    id: section.id,
                    name: section.name,
                    available: !occupiedSectionByOther.has(section.id),
                    checked: classTeacherFor.includes(encodeSectionSlot(section.id)),
                  }));
                }}
                selectedSectionId={(classLevel) => {
                  const key = `${offering.programId}:${classLevel}`;
                  const list = sectionsByProgramClass.get(key) ?? [];
                  return selectedSectionByClass[key] ?? list[0]?.id ?? null;
                }}
                onSelectSection={(classLevel, sectionId) => {
                  const key = `${offering.programId}:${classLevel}`;
                  setSelectedSectionByClass((prev) => ({ ...prev, [key]: sectionId }));
                }}
                onToggleSectionTeacher={(sectionId, checked) => {
                  const token = encodeSectionSlot(sectionId);
                  setClassTeacherFor((prev) =>
                    checked
                      ? [...prev.filter((item) => item !== token), token]
                      : prev.filter((item) => item !== token),
                  );
                }}
                classTeacherToggle={{
                  isVisible: (classLevel) => {
                    const hasSubject = assignments.some((token) =>
                      token.startsWith(`${offering.programId}:${classLevel}:`),
                    );
                    if (!hasSubject) return false;
                    const hasSections =
                      (sectionsByProgramClass.get(`${offering.programId}:${classLevel}`) ?? [])
                        .length > 0;
                    if (hasSections) return false;
                    return !occupiedClassByOther.has(`${offering.programId}:${classLevel}`);
                  },
                  isChecked: (classLevel) =>
                    classTeacherFor.includes(encodeClassSlot(offering.programId, classLevel)),
                  onToggle: (classLevel, checked) => {
                    const key = encodeClassSlot(offering.programId, classLevel);
                    setClassTeacherFor((prev) =>
                      checked
                        ? [...prev.filter((item) => item !== key), key]
                        : prev.filter((item) => item !== key),
                    );
                  },
                }}
              />
            </div>
          ))}

          {errors?.assignments && <FieldError>{errors.assignments[0]}</FieldError>}
        </section>

        <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-4">
          <Link
            href={cancelHref}
            className={buttonVariants({ variant: "ghost" })}
            onClick={isEdit ? guardCancelClick(cancelHref) : undefined}
          >
            Cancel
          </Link>
          {(!isEdit || dirty) && (
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              {isEdit ? "Save changes" : "Create teacher"}
            </Button>
          )}
        </footer>
      </Form>
      {dialog}
    </>
  );
}
