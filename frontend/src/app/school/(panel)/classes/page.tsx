import { SchoolClassesBoard } from "@/features/teachers/school-classes-board";
import { verifySchoolSession } from "@/features/school-auth/session";

export default async function SchoolClassesPage() {
  await verifySchoolSession();
  return <SchoolClassesBoard />;
}
