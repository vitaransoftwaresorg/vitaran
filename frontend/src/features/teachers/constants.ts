import type { TeacherStatus } from "@/types/teacher";

export const TEACHER_STATUS_LABELS: Record<TeacherStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

/** Classes 1–12; never hardcode a subset in the UI. */
export const CLASS_LEVELS = Array.from({ length: 12 }, (_, index) => index + 1);
