import { notFound } from "next/navigation";
import { PageHeader } from "@/features/admin/page-header";
import { updateProgramAction } from "@/features/programs/actions";
import { ProgramForm } from "@/features/programs/program-form";
import { getProgram } from "@/services/programs";

export default async function EditProgramPage({
  params,
}: PageProps<"/admin/programs/[id]/edit">) {
  const { id } = await params;
  const program = await getProgram(id);
  if (!program) notFound();

  return (
    <>
      <PageHeader title="Edit program" description={program.code} />
      <ProgramForm program={program} action={updateProgramAction.bind(null, program.id)} />
    </>
  );
}
