import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { ScanBoard } from "@/features/scan/board";
import { listScansOrEmpty } from "@/services/scans";

export const metadata: Metadata = { title: "OMR Scan" };
export const maxDuration = 120;

export default async function SchoolOmrScanPage() {
  const scans = await listScansOrEmpty("school");
  return (
    <>
      <PageHeader title="OMR Scan" />
      <ScanBoard portal="school" initial={scans} />
    </>
  );
}
