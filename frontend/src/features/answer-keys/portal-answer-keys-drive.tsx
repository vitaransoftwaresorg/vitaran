"use client";

import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { documentAnswersHref, wasEdited } from "@/features/documents/constants";
import { DriveBrowser, type DriveAction, type DriveCrumb, type DriveItem } from "@/features/documents/drive-browser";
import { documentsForProgram, tabProgramIds } from "@/features/documents/school-documents";
import { isRegularCatalog, portalPrograms } from "@/features/teachers-resources/portal-programs";
import type { PdfDocument } from "@/types/document";
import { classLabel, formatDate } from "@/utils/format";
import { answerKeyPdfHref, printPdf } from "./print-pdf";

type PortalAnswerKeysDriveProps = {
  programIds: string[];
  programNames?: Record<string, string>;
  /** Customized school — its own name replaces the regular catalog title. */
  ownerLabel?: string;
  documents: PdfDocument[];
  basePath: string;
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** School / teacher answer keys as a read-only drive: program → test → one key per class. */
export function PortalAnswerKeysDrive({
  programIds,
  programNames,
  ownerLabel,
  documents,
  basePath,
}: PortalAnswerKeysDriveProps) {
  const params = useSearchParams();
  const programs = portalPrograms(tabProgramIds(programIds, ownerLabel), programNames).map((program) =>
    ownerLabel && isRegularCatalog(program.id) ? { ...program, title: ownerLabel } : program,
  );
  const single = programs.length === 1;
  const program = programs.find((row) => row.id === params.get("program")) ?? (single ? programs[0] : undefined);
  const testParam = Number(params.get("test"));
  const testNumber = Number.isInteger(testParam) && testParam > 0 ? testParam : undefined;

  const href = (next: { program?: string; test?: number }) => {
    const query = new URLSearchParams();
    if (next.program && !single) query.set("program", next.program);
    if (next.test) query.set("test", String(next.test));
    return query.size ? `${basePath}?${query}` : basePath;
  };

  const keysFor = (programId: string) => documentsForProgram(documents, programId, programIds, ownerLabel);

  const fileItem = (doc: PdfDocument, name: string): DriveItem => {
    const view = documentAnswersHref(basePath, doc.id);
    const answers = doc.answerCount ?? 0;
    const actions: DriveAction[] = [{ label: "View answers", href: view, icon: "view" }];
    if (answers > 0) {
      actions.push(
        { label: "Download PDF", href: answerKeyPdfHref(basePath, doc.id, true), icon: "download", download: true },
        {
          label: "Print",
          icon: "print",
          onSelect: () => {
            toast.message("Preparing the answer key to print…");
            printPdf(answerKeyPdfHref(basePath, doc.id));
          },
        },
      );
    }
    return {
      id: doc.id,
      name,
      kind: "file",
      fileKind: "key",
      href: view,
      testId: doc.testId?.trim() ?? "",
      detail: answers > 0 ? plural(answers, "answer") : "Answers pending",
      modified: `${wasEdited(doc) ? "Updated" : "Published"} ${formatDate(doc.updatedAt)}`,
      actions,
    };
  };

  const breadcrumbs: DriveCrumb[] = [{ label: "Answer keys", href: basePath }];
  if (program && !single) breadcrumbs.push({ label: program.title, href: href({ program: program.id }) });
  if (program && testNumber) {
    breadcrumbs.push({ label: `Test ${testNumber}`, href: href({ program: program.id, test: testNumber }) });
  }

  let items: DriveItem[] = [];
  let emptyText = "No programs have been assigned to your school yet. Please contact Vitaran.";
  const programKeys = program ? keysFor(program.id) : [];

  if (!program) {
    items = programs.map((row) => {
      const count = keysFor(row.id).length;
      return {
        id: `program:${row.id}`,
        name: row.title,
        kind: "folder",
        href: href({ program: row.id }),
        detail: count > 0 ? plural(count, "answer key") : "Coming soon",
      };
    });
  } else if (!testNumber) {
    const tests = [...new Set(programKeys.map((doc) => doc.testNumber))].sort((a, b) => b - a);
    items = tests.map((test) => {
      const classes = programKeys
        .filter((doc) => doc.testNumber === test)
        .map((doc) => doc.classLevel)
        .sort((a, b) => a - b);
      return {
        id: `test:${test}`,
        name: `Test ${test}`,
        kind: "folder",
        href: href({ program: program.id, test }),
        detail: classes.length === 1 ? classLabel(classes[0]!) : `Classes ${classes.join(", ")}`,
      };
    });
    emptyText = "Answer keys for this program will be available here soon.";
  } else {
    items = programKeys
      .filter((doc) => doc.testNumber === testNumber)
      .sort((a, b) => a.classLevel - b.classLevel)
      .map((doc) => fileItem(doc, classLabel(doc.classLevel)));
    emptyText = "No answer keys in this test yet.";
  }

  const searchItems = (program ? programKeys : documents).map((doc) =>
    fileItem(doc, `Test ${doc.testNumber} · ${classLabel(doc.classLevel)}`),
  );

  return (
    <DriveBrowser
      breadcrumbs={breadcrumbs}
      items={items}
      searchItems={searchItems}
      emptyText={emptyText}
      searchPlaceholder="Search test ID or class"
    />
  );
}
