import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/page-header";
import { AdminObjectionsBoard } from "@/features/answer-keys/admin-objections-board";
import { listAdminAnswerKeyObjections } from "@/services/answer-keys";

export const metadata: Metadata = { title: "Key objections" };

export default async function AdminKeyObjectionsPage() {
  const { items } = await listAdminAnswerKeyObjections({ pageSize: 100 });
  const openCount = items.filter((row) => row.status === "OPEN").length;

  return (
    <>
      <PageHeader
        title="Key objections"
        count={openCount}
        description="Review objections raised by schools and teachers on published answer keys."
      />
      <AdminObjectionsBoard initialItems={items} />
    </>
  );
}
