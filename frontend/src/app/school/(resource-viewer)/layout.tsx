import { Toaster } from "@/components/ui/sonner";
import { verifySchoolSession } from "@/features/school-auth/session";

/** Full-page resource viewer — authenticated, no sidebar. */
export default async function SchoolResourceViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifySchoolSession();
  return (
    <>
      {children}
      <Toaster theme="light" position="top-right" richColors closeButton />
    </>
  );
}
