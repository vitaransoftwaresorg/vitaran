"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/features/documents/constants";
import { programLabel } from "@/features/schools/constants";
import type { LearningProgram } from "@/types/program";
import type { ResultSet } from "@/types/result";
import { updateResultAction, uploadResultAction } from "./actions";
import { classFileField, EXCEL_ACCEPT, EXCEL_MAX_BYTES } from "./constants";
import type { DrivePath, DriveSchool } from "./drive-path";
import type { ResultFormState } from "./schema";

type ResultUploadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: DrivePath;
  schools: DriveSchool[];
  programs: LearningProgram[];
  resultSet?: ResultSet;
};

export function ResultUploadSheet({
  open,
  onOpenChange,
  path,
  schools,
  programs,
  resultSet,
}: ResultUploadSheetProps) {
  const school = schools.find((item) => item.id === path.schoolId);
  const programCode = path.program ?? school?.offerings?.[0]?.code ?? school?.programs?.[0];
  const programName =
    school?.type === "CUSTOMIZED"
      ? school.offerings?.[0]?.name ??
        (programCode ? school.programLabels?.[programCode] : undefined) ??
        programCode
      : undefined;

  const titleParts = [
    path.program
      ? programLabel(path.program, programs.find((program) => program.code === path.program)?.name)
      : school?.name,
    school && path.program ? school.name : null,
    path.testNumber ? `Test ${path.testNumber}` : null,
    path.classLevel ? `Class ${path.classLevel}` : null,
  ].filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Upload</SheetTitle>
          {titleParts.length > 0 ? (
            <p className="text-sm text-neutral-500">{titleParts.join(" · ")}</p>
          ) : null}
        </SheetHeader>
        {open && path.schoolId && path.testNumber && path.classLevel ? (
          <UploadForm
            key={`${path.schoolId}-${path.program ?? ""}-${path.testNumber}-${path.classLevel}-${resultSet?.id ?? "new"}`}
            schoolId={path.schoolId}
            program={path.program ?? (school?.type === "CUSTOMIZED" ? undefined : programCode)}
            programName={school?.type === "CUSTOMIZED" && !path.program ? programName : undefined}
            testNumber={path.testNumber}
            classLevel={path.classLevel}
            resultSet={resultSet}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <p className="px-4 text-sm text-neutral-500">Open a school and test, then upload for a class.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function UploadForm({
  schoolId,
  program,
  programName,
  testNumber,
  classLevel,
  resultSet,
  onDone,
}: {
  schoolId: string;
  program?: string;
  programName?: string;
  testNumber: number;
  classLevel: number;
  resultSet?: ResultSet;
  onDone: () => void;
}) {
  const action = resultSet
    ? updateResultAction.bind(null, resultSet.id)
    : uploadResultAction;
  const [state, formAction, pending] = useActionState<ResultFormState, FormData>(action, undefined);
  const failed = state?.status === "error" ? state : undefined;
  const field = classFileField(classLevel);

  useEffect(() => {
    if (state?.status !== "success") return;
    toast.success("Uploaded");
    onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4 px-4 pb-4">
      <input type="hidden" name="schoolId" value={schoolId} />
      {program ? <input type="hidden" name="program" value={program} /> : null}
      {programName ? <input type="hidden" name="programName" value={programName} /> : null}
      <input type="hidden" name="testNumber" value={String(testNumber)} />
      <input type="hidden" name="testId" value={resultSet?.testId ?? `T-${testNumber}`} />

      {failed?.message ? (
        <Alert variant="destructive">
          <AlertDescription>{failed.message}</AlertDescription>
        </Alert>
      ) : null}

      <ExcelField
        name={field}
        errors={failed?.fieldErrors?.[field] ?? failed?.fieldErrors?.classes}
      />

      <Button type="submit" disabled={pending} className="h-11 w-full rounded-lg">
        {pending ? (
          <>
            <Loader2 className="animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload />
            Upload
          </>
        )}
      </Button>
    </form>
  );
}

function ExcelField({ name, errors }: { name: string; errors?: string[] }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const invalid = Boolean(errors?.length);

  function selectFile(next: File | null) {
    if (next) {
      if (!next.name.toLowerCase().endsWith(".xlsx")) {
        if (inputRef.current) inputRef.current.value = "";
        setFile(null);
        return;
      }
      if (next.size > EXCEL_MAX_BYTES) {
        if (inputRef.current) inputRef.current.value = "";
        setFile(null);
        return;
      }
    }
    setFile(next);
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-teal-200 bg-teal-50/50 px-4 py-6 text-center transition-colors",
          dragging && "border-teal-500 bg-teal-50",
          invalid && "border-destructive/50 bg-destructive/5",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          selectFile(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          name={name}
          accept={EXCEL_ACCEPT}
          aria-invalid={invalid || undefined}
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(event) => selectFile(event.currentTarget.files?.[0] ?? null)}
        />
        <span className="flex size-11 items-center justify-center rounded-xl bg-teal-700 text-white">
          <FileSpreadsheet className="size-5" strokeWidth={1.75} />
        </span>
        {file ? (
          <div className="relative z-10 flex max-w-full items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-teal-100">
            <span className="min-w-0 truncate text-sm font-medium text-teal-950">{file.name}</span>
            <span className="shrink-0 text-xs text-teal-600">{formatFileSize(file.size)}</span>
            <button
              type="button"
              className="inline-flex size-6 items-center justify-center rounded-md text-teal-400 hover:bg-teal-50 hover:text-teal-900"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (inputRef.current) inputRef.current.value = "";
                selectFile(null);
              }}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-teal-950">Drop Excel (.xlsx) or click to browse</p>
            <p className="text-xs text-teal-600">Up to 2 MB</p>
          </>
        )}
      </div>
      <FieldError>{errors?.[0]}</FieldError>
    </div>
  );
}
