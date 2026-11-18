import { Toaster } from "@/components/ui/sonner";
import { verifyTeacherSession } from "@/features/teacher-auth/session";

/** Full-page resource viewer — authenticated, no sidebar. */
export default async function TeacherResourceViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifyTeacherSession();
  return (
    <>
      {children}
      <Toaster theme="light" position="top-right" richColors closeButton />
    </>
  );
}
