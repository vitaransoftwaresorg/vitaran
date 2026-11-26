import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { readFormValues, type SchoolFormValues } from "./schema";
import type { Subject } from "@/types/school";
import type { SectionInput } from "@/types/section";

const DRAFT_KEY = "vitaran:school-registration-draft";

const examPatternSchema = z.enum(["MPCB", "PCB", "MPC"]);

const sectionCreateSchema = z.object({
  classLevel: z.number().int().min(1).max(12),
  name: z.string().nullable().optional(),
  programId: z.string().min(1),
  studentCount: z.number().int().min(1).optional().default(5000),
  examPattern: examPatternSchema,
  programName: z.string().optional().default(""),
  subjects: z.array(z.string()).optional().default([]),
  draftId: z.string().optional(),
});

const draftSchema = z.object({
  values: z
    .object({
      offerings: z.array(z.string()).optional(),
      customClasses: z.array(z.string()).optional(),
    })
    .catchall(z.string()),
  pendingSectionCreates: z.array(sectionCreateSchema).optional().default([]),
  pendingSectionDeletes: z.array(z.string()).optional().default([]),
});

export type DraftSectionCreate = SectionInput & {
  draftId: string;
  programName: string;
  subjects: Subject[];
};

export type SchoolRegistrationDraft = {
  values: SchoolFormValues;
  pendingSectionCreates: DraftSectionCreate[];
  pendingSectionDeletes: string[];
};

const subscribe = () => () => {};

function readRawDraft(): string | null {
  try {
    return sessionStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

function parseDraft(raw: string | null | undefined): SchoolRegistrationDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;

    // Legacy drafts were a flat SchoolFormValues object.
    if (parsed && typeof parsed === "object" && !("values" in parsed)) {
      const legacy = z
        .object({
          offerings: z.array(z.string()).optional(),
          customClasses: z.array(z.string()).optional(),
        })
        .catchall(z.string())
        .safeParse(parsed);
      if (!legacy.success) return null;
      return {
        values: legacy.data as SchoolFormValues,
        pendingSectionCreates: [],
        pendingSectionDeletes: [],
      };
    }

    const result = draftSchema.safeParse(parsed);
    if (!result.success) return null;

    return {
      values: result.data.values as SchoolFormValues,
      pendingSectionCreates: result.data.pendingSectionCreates.map((row, index) => ({
        classLevel: row.classLevel,
        name: row.name,
        programId: row.programId,
        studentCount: row.studentCount,
        examPattern: row.examPattern,
        programName: row.programName || "",
        subjects: (row.subjects ?? []) as Subject[],
        draftId: row.draftId || `draft-restored-${index}-${row.programId}-${row.classLevel}`,
      })),
      pendingSectionDeletes: result.data.pendingSectionDeletes,
    };
  } catch {
    return null;
  }
}

export function saveSchoolDraft(
  form: HTMLFormElement,
  classDrafts?: {
    creates: DraftSectionCreate[];
    deleteSectionIds: string[];
  },
) {
  try {
    const formData = new FormData(form);
    // Include password so a refresh during multi-step register does not wipe it.
    const values = readFormValues(formData);

    let creates = classDrafts?.creates ?? [];
    let deletes = classDrafts?.deleteSectionIds ?? [];

    if (!classDrafts) {
      try {
        const rawCreates = String(formData.get("pendingSectionCreates") ?? "").trim();
        const rawDeletes = String(formData.get("pendingSectionDeletes") ?? "").trim();
        if (rawCreates) {
          const parsed = z.array(sectionCreateSchema).safeParse(JSON.parse(rawCreates));
          if (parsed.success) {
            creates = parsed.data.map((row, index) => ({
              classLevel: row.classLevel,
              name: row.name,
              programId: row.programId,
              studentCount: row.studentCount,
              examPattern: row.examPattern,
              programName: row.programName || "",
              subjects: (row.subjects ?? []) as Subject[],
              draftId: row.draftId || `draft-restored-${index}-${row.programId}-${row.classLevel}`,
            }));
          }
        }
        if (rawDeletes) {
          const parsed = z.array(z.string()).safeParse(JSON.parse(rawDeletes));
          if (parsed.success) deletes = parsed.data;
        }
      } catch {
        // Keep empty creates/deletes when hidden inputs are invalid.
      }
    }

    const payload: SchoolRegistrationDraft = {
      values,
      pendingSectionCreates: creates,
      pendingSectionDeletes: deletes,
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be full or blocked; the draft is a convenience only.
  }
}

export function clearSchoolDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // See saveSchoolDraft.
  }
}

/** `loading` is true only while server-rendering, where sessionStorage is unavailable. */
export function useSchoolDraft(enabled: boolean) {
  const raw = useSyncExternalStore(
    subscribe,
    () => (enabled ? readRawDraft() : null),
    () => (enabled ? undefined : null),
  );
  const draft = useMemo(() => parseDraft(raw), [raw]);

  return {
    loading: raw === undefined,
    values: draft?.values ?? null,
    pendingSectionCreates: draft?.pendingSectionCreates ?? [],
    pendingSectionDeletes: draft?.pendingSectionDeletes ?? [],
  };
}
