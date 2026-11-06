import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { ScanBoard } from "@/features/scan/board";

export const metadata: Metadata = { title: "OMR Scan" };
export const maxDuration = 120;

export default function TeacherOmrScanPage() {
  return (
    <>
      <PageHeader title="OMR Scan" />
      <ScanBoard portal="teacher" />
    </>
  );
}
