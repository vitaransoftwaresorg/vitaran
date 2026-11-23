import type { Metadata } from "next";
import { Suspense } from "react";
import { ScanReviewPage } from "@/features/scan/review-page";

export const metadata: Metadata = { title: "OMR review" };

export default function AdminOmrScanReviewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading sheet…</p>}>
      <ScanReviewPage portal="admin" />
    </Suspense>
  );
}
