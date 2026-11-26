import type { Metadata } from "next";
import { ScanBoard } from "@/features/scan/board";

export const metadata: Metadata = { title: "OMR Scan" };
export const maxDuration = 120;

export default function AdminOmrScanPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScanBoard portal="admin" />
    </div>
  );
}
