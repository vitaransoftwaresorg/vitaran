import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/features/admin/page-header";
import { HeadOfficesTable } from "@/features/head-offices/head-offices-table";
import { buttonVariants } from "@/components/ui/button";
import { listHeadOffices } from "@/services/head-offices";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Head Offices" };

export default async function AdminHeadOfficesPage() {
  const offices = await listHeadOffices();

  return (
    <>
      <PageHeader
        title="Head Offices"
        description="Group schools under regional or corporate head offices."
        count={offices.length}
        countNoun="offices"
        actions={
          <Link href="/admin/head-offices/new" className={cn(buttonVariants())}>
            Add school Head Office
          </Link>
        }
      />
      <HeadOfficesTable offices={offices} />
    </>
  );
}
