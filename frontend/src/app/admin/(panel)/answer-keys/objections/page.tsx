import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/features/admin/page-header";
import { AdminObjectionsBoard } from "@/features/answer-keys/admin-objections-board";
import { ANSWER_KEYS_PATH } from "@/features/answer-keys/constants";
import { cn } from "@/lib/utils";
import { listAdminAnswerKeyObjections } from "@/services/answer-keys";

export const metadata: Metadata = { title: "Answer key objections" };

export default async function AdminAnswerKeyObjectionsPage() {
  const { items } = await listAdminAnswerKeyObjections({ pageSize: 100 });
  const openCount = items.filter((row) => row.status === "OPEN").length;

  return (
    <>
      <PageHeader
        title="Objections"
        count={openCount}
        description="Review objections raised by schools and teachers on published answer keys."
        actions={
          <Link
            href={ANSWER_KEYS_PATH}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <ArrowLeft className="size-3.5" />
            Answer keys
          </Link>
        }
      />
      <AdminObjectionsBoard initialItems={items} />
    </>
  );
}
