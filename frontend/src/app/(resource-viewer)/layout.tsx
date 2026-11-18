import { Toaster } from "@/components/ui/sonner";

/** Bare shell for full-page solution-book viewing (no site chrome). */
export default function ResourceViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster theme="light" position="top-right" richColors closeButton />
    </>
  );
}
