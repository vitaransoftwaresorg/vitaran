import type { Metadata } from "next";
import { ScanBoard } from "@/features/scan/board";

export const metadata: Metadata = { title: "OMR Scan" };
export const maxDuration = 120;

export default function TeacherOmrScanPage() {
  return <ScanBoard portal="teacher" />;
}
