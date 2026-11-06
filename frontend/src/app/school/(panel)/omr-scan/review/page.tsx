import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/features/admin/page-header";
import { ScanReviewPage } from "@/features/scan/review-page";

export const metadata: Metadata = { title: "Review OMR sheet" };

export default function SchoolOmrScanReviewPage() {
  return (
    <>
      <PageHeader title="Review OMR sheet" />
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading sheet…</p>}>
        <ScanReviewPage portal="school" />
      </Suspense>
    </>
  );
}
