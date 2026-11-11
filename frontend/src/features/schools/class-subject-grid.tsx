"use client";

import { subjectLabel } from "@/features/schools/constants";
import type { Subject } from "@/types/school";
import { cn } from "@/lib/utils";

export type ClassSubjectColumn = {
  classLevel: number;
  subjects: Subject[];
};

export type SectionTeacherOption = {
  id: string;
  name: string;
  /** Free or owned by current teacher — can show CT checkbox. */
  available: boolean;
  checked: boolean;
};

type ClassSubjectGridProps = {
  columns: ClassSubjectColumn[];
  isSubjectChecked: (classLevel: number, subject: Subject) => boolean;
  onToggleSubject: (classLevel: number, subject: Subject, checked: boolean) => void;
  idPrefix: string;
  /** Sections for this program+class (empty = class-level CT mode). */
  sectionsForClass?: (classLevel: number) => SectionTeacherOption[];
  /** Class-level CT when no sections exist. */
  classTeacherToggle?: {
    isVisible: (classLevel: number) => boolean;
    isChecked: (classLevel: number) => boolean;
    onToggle: (classLevel: number, checked: boolean) => void;
  };
  /** Selected section per class (for dropdown). */
  selectedSectionId?: (classLevel: number) => string | null;
  onSelectSection?: (classLevel: number, sectionId: string) => void;
  onToggleSectionTeacher?: (sectionId: string, checked: boolean) => void;
};

function SubjectList({
  classLevel,
  subjects,
  idPrefix,
  isSubjectChecked,
  onToggleSubject,
}: {
  classLevel: number;
  subjects: Subject[];
  idPrefix: string;
  isSubjectChecked: (classLevel: number, subject: Subject) => boolean;
  onToggleSubject: (classLevel: number, subject: Subject, checked: boolean) => void;
}) {
  return (
    <ul className="space-y-2">
      {subjects.map((subject) => {
        const subjectId = `${idPrefix}-c${classLevel}-${subject}`;
        return (
          <li key={subject}>
            <label htmlFor={subjectId} className="flex cursor-pointer items-center gap-2.5">
              <input
                id={subjectId}
                type="checkbox"
                className="size-3.5 rounded border-neutral-300 accent-brand-800"
                checked={isSubjectChecked(classLevel, subject)}
                onChange={(event) =>
                  onToggleSubject(classLevel, subject, event.target.checked)
                }
              />
              <span className="text-sm font-medium text-neutral-800">
                {subjectLabel(subject)}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function ClassSubjectGrid({
  columns,
  isSubjectChecked,
  onToggleSubject,
  idPrefix,
  sectionsForClass,
  classTeacherToggle,
  selectedSectionId,
  onSelectSection,
  onToggleSectionTeacher,
}: ClassSubjectGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {columns.map(({ classLevel, subjects }) => {
        const active = subjects.some((subject) => isSubjectChecked(classLevel, subject));
        const sections = sectionsForClass?.(classLevel) ?? [];
        const hasSections = sections.length > 0;
        const selectedId = selectedSectionId?.(classLevel) ?? sections[0]?.id ?? null;
        const selected = sections.find((row) => row.id === selectedId) ?? null;
        const showClassCt =
          active && !hasSections && !!classTeacherToggle?.isVisible(classLevel);
        const showSectionCt =
          active && hasSections && !!selected && selected.available && !!onToggleSectionTeacher;
        const ctSections = sections.filter((row) => row.checked);

        return (
          <article
            key={classLevel}
            className={cn(
              "flex flex-col rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgb(25_28_95/0.04)]",
              active ? "border-brand-200 ring-1 ring-brand-100" : "border-neutral-200",
            )}
          >
            <header className="mb-3">
              <p className="text-sm font-bold tracking-tight text-neutral-950">
                Class {classLevel}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {hasSections ? "Section → subjects → class teacher" : "Subjects → class teacher"}
              </p>
            </header>

            {/* With sections: Section first, then subjects */}
            {hasSections ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor={`${idPrefix}-sec-${classLevel}`}
                    className="mb-1.5 block text-[10px] font-semibold tracking-wider text-neutral-500 uppercase"
                  >
                    Section
                  </label>
                  <select
                    id={`${idPrefix}-sec-${classLevel}`}
                    className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50/80 px-2.5 text-sm text-neutral-900 outline-none focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-100"
                    value={selectedId ?? ""}
                    onChange={(event) => onSelectSection?.(classLevel, event.currentTarget.value)}
                  >
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        Sec {section.name}
                        {section.checked ? " · CT" : !section.available ? " · taken" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-neutral-100 pt-3">
                  <p className="mb-2 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                    Subjects
                  </p>
                  <SubjectList
                    classLevel={classLevel}
                    subjects={subjects}
                    idPrefix={idPrefix}
                    isSubjectChecked={isSubjectChecked}
                    onToggleSubject={onToggleSubject}
                  />
                </div>

                {active ? (
                  <div className="mt-auto space-y-2 border-t border-brand-100 pt-3">
                    {showSectionCt ? (
                      <label
                        htmlFor={`${idPrefix}-ct-sec-${selected!.id}`}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg bg-brand-50/70 px-2.5 py-2"
                      >
                        <span className="text-xs font-semibold text-brand-900">
                          Class teacher · Sec {selected!.name}
                        </span>
                        <input
                          id={`${idPrefix}-ct-sec-${selected!.id}`}
                          type="checkbox"
                          className="size-3.5 rounded border-neutral-300 accent-brand-800"
                          checked={selected!.checked}
                          onChange={(event) =>
                            onToggleSectionTeacher?.(selected!.id, event.target.checked)
                          }
                        />
                      </label>
                    ) : selected && !selected.available ? (
                      <p className="rounded-lg bg-neutral-50 px-2.5 py-2 text-[11px] text-neutral-500">
                        Sec {selected.name} already has a class teacher.
                      </p>
                    ) : null}

                    {ctSections.length > 0 ? (
                      <p className="px-0.5 text-[11px] text-neutral-500">
                        Class teacher of: {ctSections.map((row) => row.name).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              /* No sections: subjects, then class teacher */
              <div className="flex flex-1 flex-col space-y-3">
                <div>
                  <p className="mb-2 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                    Subjects
                  </p>
                  <SubjectList
                    classLevel={classLevel}
                    subjects={subjects}
                    idPrefix={idPrefix}
                    isSubjectChecked={isSubjectChecked}
                    onToggleSubject={onToggleSubject}
                  />
                </div>

                {showClassCt && classTeacherToggle ? (
                  <label
                    htmlFor={`${idPrefix}-ct-${classLevel}`}
                    className="mt-auto flex cursor-pointer items-center justify-between gap-2 rounded-lg border-t border-brand-100 bg-brand-50/70 px-2.5 py-2"
                  >
                    <span className="text-xs font-semibold text-brand-900">Class teacher</span>
                    <input
                      id={`${idPrefix}-ct-${classLevel}`}
                      type="checkbox"
                      className="size-3.5 rounded border-neutral-300 accent-brand-800"
                      checked={classTeacherToggle.isChecked(classLevel)}
                      onChange={(event) =>
                        classTeacherToggle.onToggle(classLevel, event.target.checked)
                      }
                    />
                  </label>
                ) : null}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
