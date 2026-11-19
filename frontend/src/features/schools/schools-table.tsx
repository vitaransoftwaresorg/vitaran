"use client";

import { ProfileLink, schoolProfileHref } from "@/components/shared/profile-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rememberAdminNavLabel } from "@/features/admin/nav-labels";
import type { SchoolSummary } from "@/types/school";
import { formatDate } from "@/utils/format";
import { BOARD_LABELS } from "./constants";
import { SchoolRowActions } from "./school-row-actions";
import { SchoolStatusBadge } from "./school-status-badge";
import { SchoolTypeBadge } from "./school-type-badge";

function schoolInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function SchoolsTable({ schools }: { schools: SchoolSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">School</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Board</TableHead>
          <TableHead className="hidden lg:table-cell">Location</TableHead>
          <TableHead className="hidden md:table-cell">Contact</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden xl:table-cell">Registered</TableHead>
          <TableHead className="w-12 pr-4">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schools.map((school) => (
          <TableRow key={school.id}>
            <TableCell className="max-w-72 pl-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar size="sm" className="rounded-md after:rounded-md">
                  {school.hasLogo ? (
                    <AvatarImage
                      src={`/admin/schools/${school.id}/logo`}
                      alt=""
                      className="rounded-md object-contain p-0.5"
                    />
                  ) : null}
                  <AvatarFallback className="rounded-md text-[10px] font-semibold">
                    {schoolInitials(school.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <ProfileLink
                    href={schoolProfileHref(school.id)}
                    className="block truncate"
                    onClick={() => rememberAdminNavLabel("school", school.id, school.name)}
                  >
                    {school.name}
                  </ProfileLink>
                  <span className="font-mono text-xs text-muted-foreground">{school.code}</span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <SchoolTypeBadge type={school.type} />
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{BOARD_LABELS[school.board]}</Badge>
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <span className="block">{school.city}</span>
              <span className="text-xs text-muted-foreground">{school.state}</span>
            </TableCell>
            <TableCell className="hidden max-w-56 md:table-cell">
              <span className="block truncate">{school.contactName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {school.contactEmail}
              </span>
            </TableCell>
            <TableCell>
              <SchoolStatusBadge status={school.status} />
            </TableCell>
            <TableCell className="hidden text-muted-foreground xl:table-cell">
              {formatDate(school.createdAt)}
            </TableCell>
            <TableCell className="pr-4 text-right">
              <SchoolRowActions school={school} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
