import type { Metadata } from "next";
import { ScanBoard } from "@/features/scan/board";

export const metadata: Metadata = { title: "OMR Scan" };
export const maxDuration = 120;

export default function SchoolOmrScanPage() {
  return <ScanBoard portal="school" />;
}
