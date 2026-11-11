import { ProfileLink, schoolProfileHref } from "@/components/shared/profile-link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SchoolSummary } from "@/types/school";
import { formatDate } from "@/utils/format";
import { BOARD_LABELS } from "./constants";
import { SchoolRowActions } from "./school-row-actions";
import { SchoolStatusBadge } from "./school-status-badge";
import { SchoolTypeBadge } from "./school-type-badge";

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
              <ProfileLink href={schoolProfileHref(school.id)} className="block truncate">
                {school.name}
              </ProfileLink>
              <span className="font-mono text-xs text-muted-foreground">{school.code}</span>
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
