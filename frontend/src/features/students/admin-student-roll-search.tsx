"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { findAdminStudentByRollAction } from "./admin-student-actions";

type AdminStudentRollSearchProps = {
  /** When set, search is limited to that school. */
  schoolId?: string;
  className?: string;
};

/** Top-of-page jump to a student by registration number. */
export function AdminStudentRollSearch({ schoolId, className }: AdminStudentRollSearchProps) {
  const router = useRouter();
  const [roll, setRoll] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const value = roll.replace(/\D/g, "").slice(0, 7);
    setRoll(value);
    if (!/^\d{7}$/.test(value)) {
      setError("Enter the 7-digit registration number");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await findAdminStudentByRollAction(value, schoolId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/admin/schools/students/${result.id}`);
    });
  }

  return (
    <form
      className={cn("flex w-fit max-w-full flex-col gap-1", className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex gap-2">
        {/* 7-digit Reg No — keep the field compact (no flex grow). */}
        <InputGroup className="h-9 w-[9.6rem] shrink-0 bg-white sm:w-[10.24rem]">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            inputMode="numeric"
            maxLength={7}
            value={roll}
            placeholder="Reg No"
            aria-label="Search by registration number"
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setRoll(event.currentTarget.value.replace(/\D/g, "").slice(0, 7));
              setError(null);
            }}
          />
        </InputGroup>
        <Button type="submit" size="sm" className="h-9 shrink-0 gap-1.5" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Open
        </Button>
      </div>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </form>
  );
}
