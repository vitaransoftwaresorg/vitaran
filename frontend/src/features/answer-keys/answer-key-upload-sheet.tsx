"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { documentAnswersHref } from "@/features/documents/constants";
import { programLabel } from "@/features/schools/constants";
import type { LearningProgram } from "@/types/program";
import { createAnswerKeyAction } from "./actions";
import { ANSWER_KEYS_PATH } from "./constants";
import type { DrivePath } from "./drive-path";

type AnswerKeyUploadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: DrivePath;
  curriculumProgram?: string;
  programs: LearningProgram[];
};

export function AnswerKeyUploadSheet({
  open,
  onOpenChange,
  path,
  curriculumProgram,
  programs,
}: AnswerKeyUploadSheetProps) {
  const programCode = path.program ?? curriculumProgram;
  const titleParts = [
    path.program
      ? programLabel(path.program, programs.find((program) => program.code === path.program)?.name)
      : null,
    path.testNumber ? `Test ${path.testNumber}` : null,
    path.classLevel ? `Class ${path.classLevel}` : null,
  ].filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add key</SheetTitle>
          {titleParts.length > 0 ? (
            <p className="text-sm text-neutral-500">{titleParts.join(" · ")}</p>
          ) : null}
        </SheetHeader>
        {open && path.testNumber && path.classLevel && programCode ? (
          <CreateForm
            key={`${programCode}-${path.schoolId ?? ""}-${path.testNumber}-${path.classLevel}`}
            program={programCode}
            schoolId={path.schoolId}
            testNumber={path.testNumber}
            classLevel={path.classLevel}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <p className="px-4 text-sm text-neutral-500">Open a test, then add a key for a class.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CreateForm({
  program,
  schoolId,
  testNumber,
  classLevel,
  onDone,
}: {
  program: string;
  schoolId?: string;
  testNumber: number;
  classLevel: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <p className="text-sm text-neutral-600">
        Opens a 100-question key. Pick A, B, C, D or ADD for each question, add explanations, then save.
      </p>
      <Button
        type="button"
        disabled={pending}
        className="h-11 w-full rounded-lg"
        onClick={() => {
          start(async () => {
            const result = await createAnswerKeyAction({
              program,
              type: schoolId ? "CUSTOMIZED" : "REGULAR",
              schoolId,
              testNumber,
              classLevel,
            });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            onDone();
            router.push(documentAnswersHref(ANSWER_KEYS_PATH, result.id));
          });
        }}
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" />
            Opening…
          </>
        ) : (
          <>
            <Plus />
            Add key
          </>
        )}
      </Button>
    </div>
  );
}
