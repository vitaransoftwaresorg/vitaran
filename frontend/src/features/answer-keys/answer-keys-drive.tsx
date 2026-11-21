"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { documentAnswersHref, wasEdited } from "@/features/documents/constants";
import { DriveBrowser, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import {
  classLevelsForOwner,
  customizedProgramCode,
  programLabel,
  soleSchoolForCustomProgram,
  TYPE_LABELS,
} from "@/features/schools/constants";
import type { AnswerKey } from "@/types/answer-key";
import type { DeleteResult } from "@/types/document";
import type { LearningProgram } from "@/types/program";
import { formatDateTime } from "@/utils/format";
import { createAnswerKeyAction, deleteAnswerKeyAction } from "./actions";
import { enteredTestId } from "./test-id";
import { ANSWER_KEY_NOUN, ANSWER_KEYS_PATH } from "./constants";
import {
  DRIVE_TESTS,
  answerKeysFolderHref,
  writeAnswerKeysFolderTrail,
  type DrivePath,
  type DriveSchool,
} from "./drive-path";
import { answerKeyPdfHref, printPdf } from "./print-pdf";

export type { DrivePath, DriveSchool } from "./drive-path";

type AnswerKeysDriveProps = {
  items: AnswerKey[];
  programs: LearningProgram[];
  schools: DriveSchool[];
  path: DrivePath;
  publishAction: (id: string, published: boolean) => Promise<DeleteResult>;
};

function scopedItems(items: AnswerKey[], path: DrivePath) {
  return items.filter((item) => {
    if (path.schoolId) return item.school?.id === path.schoolId;
    if (path.program) return item.type === "REGULAR" && item.program === path.program;
    return false;
  });
}

function fileForClass(items: AnswerKey[], path: DrivePath, classLevel: number) {
  return scopedItems(items, path).find(
    (item) => item.testNumber === path.testNumber && item.classLevel === classLevel,
  );
}

export function AnswerKeysDrive({
  items,
  programs,
  schools,
  path,
  publishAction,
}: AnswerKeysDriveProps) {
  const router = useRouter();
  const [creatingClass, setCreatingClass] = useState<number | null>(null);
  const [, startCreating] = useTransition();
  const customizedOnly = schools.filter((school) => school.type === "CUSTOMIZED");
  const selectedProgram = programs.find((program) => program.code === path.program);
  const customProgram = selectedProgram?.type === "CUSTOMIZED";
  const soleSchool = soleSchoolForCustomProgram(selectedProgram, customizedOnly);
  const schoolId = path.schoolId ?? soleSchool?.id;
  const programName = (code: string) =>
    programLabel(code, programs.find((program) => program.code === code)?.name);
  const link = (next: DrivePath) => answerKeysFolderHref(next, programs);
  const drivePath: DrivePath = { ...path, schoolId };

  const currentSchool =
    schools.find((school) => school.id === schoolId) ??
    items.find((item) => item.school?.id === schoolId)?.school;

  const schoolForFolder = schools.find((school) => school.id === schoolId);
  const customCode = customizedProgramCode(schoolForFolder, programs);
  const curriculumProgram =
    (selectedProgram?.type === "CUSTOMIZED" ? path.program : undefined) ??
    customCode ??
    path.program ??
    schoolForFolder?.programs?.find((code) =>
      programs.some((program) => program.code === code && program.type === "CUSTOMIZED"),
    ) ??
    schoolForFolder?.programs?.[0] ??
    programs.find((program) => program.type === "CUSTOMIZED")?.code ??
    programs[0]?.code;

  const breadcrumbs: DriveCrumb[] = [{ label: "Answer keys", href: ANSWER_KEYS_PATH }];
  if (schoolId && (schoolForFolder?.type === "CUSTOMIZED" || customProgram)) {
    breadcrumbs.push({
      label: currentSchool?.name ?? "School",
      href: link({ program: path.program ?? customCode, schoolId }),
    });
  } else if (path.program) {
    breadcrumbs.push({
      label: programName(path.program),
      href: link({ program: path.program }),
    });
  }
  if (path.testNumber) {
    breadcrumbs.push({
      label: `Test ${path.testNumber}`,
      href: link({ program: path.program, schoolId, testNumber: path.testNumber }),
    });
  }

  useEffect(() => {
    writeAnswerKeysFolderTrail(`${window.location.pathname}${window.location.search}`, breadcrumbs.slice(1));
    // path/schoolId drive the breadcrumb contents for this folder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, schoolId]);

  const atRoot = !path.program && !path.schoolId;
  const inCustomSchools = Boolean(customProgram && path.program && !schoolId);
  const inTests = !atRoot && !inCustomSchools && path.testNumber === undefined;
  const inTest = path.testNumber !== undefined && !inCustomSchools;

  const addKey = (classLevel: number) => {
    if (!curriculumProgram || path.testNumber === undefined) return;
    setCreatingClass(classLevel);
    startCreating(async () => {
      const result = await createAnswerKeyAction({
        program: curriculumProgram,
        type: customProgram || schoolId ? "CUSTOMIZED" : "REGULAR",
        schoolId,
        testNumber: path.testNumber!,
        classLevel,
      });
      setCreatingClass(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.push(
        documentAnswersHref(
          ANSWER_KEYS_PATH,
          result.id,
          link({ program: path.program, schoolId, testNumber: path.testNumber }),
        ),
      );
    });
  };

  const driveItems: DriveItem[] = [];

  if (atRoot) {
    // Regular keys are shared by program. Customized keys follow the school roster
    // (one folder per customized school) — never list catalog custom programs separately.
    driveItems.push(
      ...programs
        .filter((program) => (program.type ?? "REGULAR") === "REGULAR")
        .map((program) => ({
          id: `program:${program.code}`,
          name: programLabel(program.code, program.name),
          kind: "folder" as const,
          href: link({ program: program.code }),
          detail: TYPE_LABELS.REGULAR,
        })),
      ...[...customizedOnly]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((school) => ({
          id: `school:${school.id}`,
          name: school.name,
          kind: "folder" as const,
          href: link({
            schoolId: school.id,
            program: customizedProgramCode(school, programs),
          }),
          detail: TYPE_LABELS.CUSTOMIZED,
        })),
    );
  } else if (inCustomSchools) {
    // Legacy URL: customized program without school — pick from school roster.
    driveItems.push(
      ...customizedOnly
        .filter((school) => school.programs?.includes(path.program!))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((school) => ({
          id: school.id,
          name: school.name,
          kind: "folder" as const,
          href: link({ program: path.program, schoolId: school.id }),
          detail: school.code,
        })),
    );
  } else if (inTests) {
    driveItems.push(
      ...DRIVE_TESTS.map((testNumber) => {
        const count = scopedItems(items, drivePath).filter(
          (item) => item.testNumber === testNumber && (item.answerCount ?? 0) > 0,
        ).length;
        return {
          id: String(testNumber),
          name: `Test ${testNumber}`,
          kind: "folder" as const,
          href: link({ ...drivePath, testNumber }),
          detail: count > 0 ? `${count} added` : "Empty",
        };
      }),
    );
  } else if (inTest) {
    driveItems.push(
      ...classLevelsForOwner(
        drivePath,
        programs,
        schools,
        scopedItems(items, drivePath)
          .filter((item) => item.testNumber === path.testNumber)
          .map((item) => item.classLevel),
      ).map((classLevel) => {
        const file = fileForClass(items, drivePath, classLevel);
        const filled = file?.answerCount ?? 0;
        // Unsaved editor shells stay as drafts until answers are saved.
        if (!file || filled === 0) {
          const draftHref = file
            ? documentAnswersHref(ANSWER_KEYS_PATH, file.id, link(drivePath))
            : undefined;
          return {
            id: file?.id ?? `class:${classLevel}`,
            name: `Class ${classLevel}`,
            kind: "empty" as const,
            detail: file ? "Draft — save answers to keep" : "No key yet",
            createLabel: file ? "Continue" : "Add key",
            creating: creatingClass === classLevel,
            testId: "",
            onCreate: () => {
              if (draftHref) {
                router.push(draftHref);
                return;
              }
              addKey(classLevel);
            },
          };
        }

        const href = documentAnswersHref(ANSWER_KEYS_PATH, file.id, link(drivePath));
        const publishLabel = `Class ${classLevel} answer key`;
        const actions = [
          { label: "View", href, icon: "view" as const },
          { label: "Update", href, icon: "edit" as const },
          ...(filled > 0
            ? [
                {
                  label: "Download PDF",
                  href: answerKeyPdfHref(ANSWER_KEYS_PATH, file.id, true),
                  icon: "download" as const,
                  download: true,
                },
                {
                  label: "Print",
                  icon: "print" as const,
                  onSelect: () => {
                    toast.message("Preparing the answer key to print…");
                    printPdf(answerKeyPdfHref(ANSWER_KEYS_PATH, file.id));
                  },
                },
              ]
            : []),
        ];
        return {
          id: file.id,
          name: `Class ${classLevel}`,
          kind: "file" as const,
          fileKind: "key" as const,
          href,
          testId: enteredTestId(file.testId),
          detail: file.published ? `${filled} answers · Published` : `${filled} answers · Hidden`,
          modified: wasEdited(file) ? formatDateTime(file.updatedAt) : undefined,
          published: file.published,
          publishLabel,
          onPublish: publishAction.bind(null, file.id),
          onDelete: () => deleteAnswerKeyAction(file.id),
          deleteNoun: ANSWER_KEY_NOUN,
          actions,
        };
      }),
    );
  }

  const emptyText = inCustomSchools
    ? "No schools in this program"
    : inTest
      ? "No classes in this test"
      : "No programs yet";

  const searchItems: DriveItem[] = items.flatMap((file) => {
    // Hide unsaved drafts from search — they are not real keys yet.
    if ((file.answerCount ?? 0) === 0) return [];
    const testId = enteredTestId(file.testId);
    if (!testId) return [];
    const folder = link({
      program: file.type === "REGULAR" ? file.program : path.program,
      schoolId: file.school?.id ?? schoolId,
      testNumber: file.testNumber,
    });
    const href = documentAnswersHref(ANSWER_KEYS_PATH, file.id, folder);
    const label = inTest
      ? `Class ${file.classLevel} answer key`
      : `Test ${file.testNumber} · Class ${file.classLevel} answer key`;
    const answers = file.answerCount ?? 0;
    return [
      {
        id: file.id,
        name: inTest ? `Class ${file.classLevel}` : `Test ${file.testNumber} · Class ${file.classLevel}`,
        kind: "file" as const,
        fileKind: "key" as const,
        href,
        testId,
        detail: file.published
          ? `${answers} answers · Published`
          : `${answers} answers · Hidden`,
        publishLabel: label,
        onDelete: () => deleteAnswerKeyAction(file.id),
        deleteNoun: ANSWER_KEY_NOUN,
        actions: [
          { label: "View", href, icon: "view" as const },
          { label: "Update", href, icon: "edit" as const },
          ...(answers > 0
            ? [
                {
                  label: "Download PDF",
                  href: answerKeyPdfHref(ANSWER_KEYS_PATH, file.id, true),
                  icon: "download" as const,
                  download: true,
                },
                {
                  label: "Print",
                  icon: "print" as const,
                  onSelect: () => {
                    toast.message("Preparing the answer key to print…");
                    printPdf(answerKeyPdfHref(ANSWER_KEYS_PATH, file.id));
                  },
                },
              ]
            : []),
        ],
      },
    ];
  });

  return (
    <DriveBrowser
      breadcrumbs={breadcrumbs}
      items={driveItems}
      searchItems={searchItems}
      emptyText={emptyText}
      searchPlaceholder="Search in this folder"
    />
  );
}
