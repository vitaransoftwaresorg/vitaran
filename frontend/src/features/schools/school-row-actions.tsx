"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { rememberAdminNavLabel } from "@/features/admin/nav-labels";
import { DeleteSchoolDialog } from "./delete-school-dialog";

export function SchoolRowActions({ school }: { school: { id: string; name: string } }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const remember = () => rememberAdminNavLabel("school", school.id, school.name);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${school.name}`} />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem render={<Link href={`/admin/schools/${school.id}`} onClick={remember} />}>
            <Eye />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href={`/admin/schools/${school.id}/edit`} onClick={remember} />}
          >
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteSchoolDialog school={school} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </>
  );
}
