import { PageHeader } from "@/features/admin/page-header";
import { createProgramAction } from "@/features/programs/actions";
import { ProgramForm } from "@/features/programs/program-form";

export default function NewProgramPage() {
  return (
    <>
      <PageHeader title="Add program" description="Name, type, code, class range and subjects." />
      <ProgramForm action={createProgramAction} />
    </>
  );
}
