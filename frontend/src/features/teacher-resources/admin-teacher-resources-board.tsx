"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatFileSize } from "@/features/documents/constants";
import {
  programLabel,
  subjectLabel,
  subjectsForClassLevel,
} from "@/features/schools/constants";
import { capitalizeWords } from "@/features/schools/schema";
import { programs as regularProgramCatalog } from "@/features/teachers-resources/content";
import { cn } from "@/lib/utils";
import type { HeadOfficeListItem } from "@/types/head-office";
import type { SchoolOption } from "@/types/school";
import {
  deleteCustomizedTeacherResourceAction,
  deleteHeadOfficeCustomizedTeacherResourceAction,
  deleteRegularTeacherResourceAction,
  listCustomizedTeacherResourcesAction,
  listHeadOfficeCustomizedTeacherResourcesAction,
  uploadCustomizedTeacherResourceAction,
  uploadHeadOfficeCustomizedTeacherResourceAction,
  uploadRegularTeacherResourceAction,
  type RegularTeacherResourceRow,
  type TeacherResourceRow,
} from "./admin-teacher-resources-actions";
import { regularResourceSlots } from "./regular-resource-slots";

type AdminTeacherResourcesBoardProps = {
  customizedSchools: SchoolOption[];
  headOffices: HeadOfficeListItem[];
  initialRegular: RegularTeacherResourceRow[];
};

export function AdminTeacherResourcesBoard({
  customizedSchools,
  headOffices,
  initialRegular,
}: AdminTeacherResourcesBoardProps) {
  return (
    <Tabs defaultValue="regular" className="gap-5">
      <TabsList variant="line" className="h-10 gap-4">
        <TabsTrigger value="regular" className="px-1">
          Regular
        </TabsTrigger>
        <TabsTrigger value="customized" className="px-1">
          Customized
        </TabsTrigger>
      </TabsList>

      <TabsContent value="regular" className="space-y-4">
        <RegularResourcesPanel initial={initialRegular} />
      </TabsContent>
      <TabsContent value="customized" className="space-y-4">
        <CustomizedResourcesPanel schools={customizedSchools} headOffices={headOffices} />
      </TabsContent>
    </Tabs>
  );
}

function resourceKey(
  programCode: string,
  classLevel: number,
  subject: string,
  volume: number | null | undefined,
) {
  return `${programCode}:${classLevel}:${subject}:${volume ?? 0}`;
}

function ResourcesTableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="border-neutral-200 bg-neutral-50/80 hover:bg-neutral-50/80">
            <TableHead className="w-16 pl-4 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              S.No
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Class
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Subject
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Document
            </TableHead>
            <TableHead className="pr-4 text-right text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Upload / Update
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

function DocumentCell({
  fileName,
  fileSize,
}: {
  fileName?: string | null;
  fileSize?: number | null;
}) {
  if (!fileName) {
    return <span className="text-sm text-neutral-400">—</span>;
  }
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-neutral-900">{fileName}</p>
      {fileSize != null ? (
        <p className="text-xs text-neutral-500">{formatFileSize(fileSize)}</p>
      ) : null}
    </div>
  );
}

function UploadActions({
  uploaded,
  pending,
  onFile,
  onRemove,
}: {
  uploaded: boolean;
  pending: boolean;
  onFile: (file: File) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {uploaded ? "Update" : "Upload"}
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onFile(file);
          }}
        />
      </label>
      {uploaded && onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-700 hover:bg-red-50 hover:text-red-800"
          disabled={pending}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
          Remove
        </Button>
      ) : null}
    </div>
  );
}

/** DB-backed regular solution books — upload / replace / remove per program × class × subject. */
function RegularResourcesPanel({ initial }: { initial: RegularTeacherResourceRow[] }) {
  const [programCode, setProgramCode] = useState("");
  const [resources, setResources] = useState(initial);
  const byKey = useMemo(() => {
    const map = new Map<string, RegularTeacherResourceRow>();
    for (const row of resources) {
      map.set(
        resourceKey(row.programCode, row.classLevel, row.subject, row.volume),
        row,
      );
    }
    return map;
  }, [resources]);

  const rows = useMemo(
    () =>
      regularResourceSlots()
        .filter((slot) => slot.programCode === programCode)
        .sort(
          (a, b) =>
            a.classLevel - b.classLevel ||
            a.subject.localeCompare(b.subject) ||
            a.volume - b.volume,
        ),
    [programCode],
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-neutral-950">Regular teacher resources</p>
        <p className="mt-0.5 text-sm text-neutral-500">
          Upload or update PDFs in the database. These power the public Teachers Resources page and
          school/teacher portals.
        </p>
      </div>

      <div className="max-w-md">
        <p className="mb-1.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Program
        </p>
        <Select
          items={regularProgramCatalog.map((row) => ({ value: row.id, label: row.title }))}
          value={programCode || null}
          onValueChange={(next) => {
            if (next) setProgramCode(next);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select program" />
          </SelectTrigger>
          <SelectContent>
            {regularProgramCatalog.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!programCode ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
          Select a program to upload or update resources.
        </div>
      ) : (
        <ResourcesTableShell>
          {rows.map((slot, index) => (
            <RegularResourceTableRow
              key={resourceKey(slot.programCode, slot.classLevel, slot.subject, slot.volume)}
              serial={index + 1}
              programCode={slot.programCode}
              classLevel={slot.classLevel}
              subject={slot.subject}
              volume={slot.volume}
              existing={
                byKey.get(
                  resourceKey(slot.programCode, slot.classLevel, slot.subject, slot.volume),
                ) ?? null
              }
              onUploaded={(row) => {
                setResources((prev) => [
                  ...prev.filter(
                    (item) =>
                      resourceKey(
                        item.programCode,
                        item.classLevel,
                        item.subject,
                        item.volume,
                      ) !==
                      resourceKey(row.programCode, row.classLevel, row.subject, row.volume),
                  ),
                  row,
                ]);
              }}
              onDeleted={() => {
                setResources((prev) =>
                  prev.filter(
                    (item) =>
                      resourceKey(
                        item.programCode,
                        item.classLevel,
                        item.subject,
                        item.volume,
                      ) !==
                      resourceKey(
                        slot.programCode,
                        slot.classLevel,
                        slot.subject,
                        slot.volume,
                      ),
                  ),
                );
              }}
            />
          ))}
        </ResourcesTableShell>
      )}
    </div>
  );
}

function RegularResourceTableRow({
  serial,
  programCode,
  classLevel,
  subject,
  volume,
  existing,
  onUploaded,
  onDeleted,
}: {
  serial: number;
  programCode: string;
  classLevel: number;
  subject: string;
  volume: number;
  existing: RegularTeacherResourceRow | null;
  onUploaded: (row: RegularTeacherResourceRow) => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const uploaded = Boolean(existing);
  const subjectText = `${subjectLabel(subject)}${volume > 0 ? ` · Vol ${volume}` : ""}`;

  return (
    <TableRow className="border-neutral-100">
      <TableCell className="pl-4 tabular-nums text-neutral-600">{serial}</TableCell>
      <TableCell className="font-medium text-neutral-900">{classLevel}</TableCell>
      <TableCell className="text-neutral-800">{subjectText}</TableCell>
      <TableCell>
        <DocumentCell fileName={existing?.fileName} fileSize={existing?.fileSize} />
      </TableCell>
      <TableCell className="pr-4 text-right">
        <UploadActions
          uploaded={uploaded}
          pending={pending}
          onFile={(file) => {
            startTransition(async () => {
              const form = new FormData();
              form.append("file", file);
              const result = await uploadRegularTeacherResourceAction(
                programCode,
                classLevel,
                subject,
                form,
                volume,
              );
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              onUploaded(result.resource);
              toast.success(`Saved ${subjectText} · Class ${classLevel}`);
            });
          }}
          onRemove={
            existing
              ? () => {
                  startTransition(async () => {
                    const result = await deleteRegularTeacherResourceAction(
                      programCode,
                      classLevel,
                      subject,
                      volume,
                    );
                    if (!result.ok) {
                      toast.error(result.message);
                      return;
                    }
                    onDeleted();
                    toast.success("Removed PDF");
                  });
                }
              : undefined
          }
        />
      </TableCell>
    </TableRow>
  );
}

function registeredOfferings(school: SchoolOption | null) {
  // Customized schools upload resources against regular catalog programs only
  // (Advanced / Integrated / …) — not the school's own custom program name.
  return (school?.offerings ?? []).filter(
    (row) => (row.type ?? "REGULAR") === "REGULAR" && row.classLevels.length > 0,
  );
}

function offeringLabel(row: { code: string; name: string }) {
  return capitalizeWords(programLabel(row.code, row.name));
}

type CustomizedScope = "school" | "head-office";

type CustomizedProgramOption = {
  code: string;
  name: string;
  classLevels: number[];
};

function headOfficeProgramOptions(): CustomizedProgramOption[] {
  const byCode = new Map<string, CustomizedProgramOption>();
  for (const slot of regularResourceSlots()) {
    const entry = byCode.get(slot.programCode) ?? {
      code: slot.programCode,
      name: slot.programTitle,
      classLevels: [],
    };
    if (!entry.classLevels.includes(slot.classLevel)) {
      entry.classLevels.push(slot.classLevel);
    }
    byCode.set(slot.programCode, entry);
  }
  return [...byCode.values()].map((row) => ({
    ...row,
    classLevels: [...row.classLevels].sort((a, b) => a - b),
  }));
}

function CustomizedResourcesPanel({
  schools,
  headOffices,
}: {
  schools: SchoolOption[];
  headOffices: HeadOfficeListItem[];
}) {
  const [scope, setScope] = useState<CustomizedScope>("school");
  const [schoolId, setSchoolId] = useState("");
  const [headOfficeId, setHeadOfficeId] = useState("");
  const school = schools.find((row) => row.id === schoolId) ?? null;
  const schoolOfferings = registeredOfferings(school);
  const headOfficeOfferings = useMemo(() => headOfficeProgramOptions(), []);
  const offerings = scope === "school" ? schoolOfferings : headOfficeOfferings;
  const [programCode, setProgramCode] = useState("");
  const [resources, setResources] = useState<TeacherResourceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const ownerId = scope === "school" ? schoolId : headOfficeId;

  useEffect(() => {
    if (!programCode) return;
    if (offerings.some((row) => row.code === programCode)) return;
    setProgramCode("");
  }, [scope, ownerId, offerings, programCode]);

  useEffect(() => {
    if (!ownerId) {
      setResources([]);
      return;
    }
    let live = true;
    setLoading(true);
    const load =
      scope === "school"
        ? listCustomizedTeacherResourcesAction(ownerId)
        : listHeadOfficeCustomizedTeacherResourcesAction(ownerId);
    void load.then((result) => {
      if (!live) return;
      setLoading(false);
      if (!result.ok) {
        toast.error(result.message);
        setResources([]);
        return;
      }
      setResources(result.resources);
    });
    return () => {
      live = false;
    };
  }, [scope, ownerId]);

  const selectedProgram = offerings.find((row) => row.code === programCode) ?? null;
  const programItems = offerings.map((row) => ({
    value: row.code,
    label: offeringLabel(row),
  }));
  const scopeItems = [
    { value: "school", label: "School" },
    { value: "head-office", label: "Head office" },
  ];

  if (schools.length === 0 && headOffices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
        No customized schools or head offices yet. Register one first, then upload teacher
        resources here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-neutral-950">Customized teacher resources</p>
      </div>

      <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">Upload for</p>
          <Select
            items={scopeItems}
            value={scope}
            onValueChange={(next) => {
              if (next !== "school" && next !== "head-office") return;
              setScope(next);
              setProgramCode("");
              setResources([]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select scope" />
            </SelectTrigger>
            <SelectContent>
              {scopeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scope === "school" ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              School
            </p>
            <Select
              items={schools.map((row) => ({ value: row.id, label: row.name }))}
              value={schoolId || null}
              onValueChange={(next) => {
                if (!next) return;
                setSchoolId(next);
                setProgramCode("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select school" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Head office
            </p>
            <Select
              items={headOffices.map((row) => ({ value: row.id, label: row.name }))}
              value={headOfficeId || null}
              onValueChange={(next) => {
                if (!next) return;
                setHeadOfficeId(next);
                setProgramCode("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select head office" />
              </SelectTrigger>
              <SelectContent>
                {headOffices.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Program
          </p>
          <Select
            items={programItems}
            value={programCode || null}
            onValueChange={(next) => {
              if (next) setProgramCode(next);
            }}
          >
            <SelectTrigger className="w-full" disabled={!ownerId || offerings.length === 0}>
              <SelectValue placeholder="Select program" />
            </SelectTrigger>
            <SelectContent>
              {offerings.map((row) => (
                <SelectItem key={row.code} value={row.code}>
                  {offeringLabel(row)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!ownerId ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
          {scope === "school" ? "Select a school to continue." : "Select a head office to continue."}
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-brand-700" />
        </div>
      ) : offerings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
          {scope === "school"
            ? "This school has no regular catalog programs with classes yet. Enrol Advanced / Integrated (or another regular program) on the school form first."
            : "No regular catalog programs available for head office uploads."}
        </div>
      ) : !selectedProgram ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
          Select a program to upload or update resources.
        </div>
      ) : (
        <CustomizedUploadTable
          scope={scope}
          ownerId={ownerId}
          program={selectedProgram}
          resources={resources}
          onChange={setResources}
        />
      )}
    </div>
  );
}

function CustomizedUploadTable({
  scope,
  ownerId,
  program,
  resources,
  onChange,
}: {
  scope: CustomizedScope;
  ownerId: string;
  program: CustomizedProgramOption;
  resources: TeacherResourceRow[];
  onChange: (next: TeacherResourceRow[]) => void;
}) {
  const byKey = useMemo(() => {
    const map = new Map<string, TeacherResourceRow>();
    for (const row of resources) {
      if (row.programCode !== program.code) continue;
      map.set(`${row.classLevel}:${row.subject}`, row);
    }
    return map;
  }, [resources, program.code]);

  const rows = useMemo(() => {
    const levels = [...program.classLevels].sort((a, b) => a - b);
    return levels.flatMap((classLevel) =>
      subjectsForClassLevel(classLevel).map((subject) => ({ classLevel, subject })),
    );
  }, [program.classLevels]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        No classes available for this program yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-brand-900">{offeringLabel(program)}</p>
      <ResourcesTableShell>
        {rows.map((row, index) => (
          <CustomizedResourceTableRow
            key={`${program.code}-${row.classLevel}-${row.subject}`}
            serial={index + 1}
            scope={scope}
            ownerId={ownerId}
            programCode={program.code}
            classLevel={row.classLevel}
            subject={row.subject}
            existing={byKey.get(`${row.classLevel}:${row.subject}`) ?? null}
            onUploaded={(next) => {
              onChange([
                ...resources.filter(
                  (item) =>
                    !(
                      item.programCode === next.programCode &&
                      item.classLevel === next.classLevel &&
                      item.subject === next.subject
                    ),
                ),
                next,
              ]);
            }}
            onDeleted={() => {
              onChange(
                resources.filter(
                  (item) =>
                    !(
                      item.programCode === program.code &&
                      item.classLevel === row.classLevel &&
                      item.subject === row.subject
                    ),
                ),
              );
            }}
          />
        ))}
      </ResourcesTableShell>
    </div>
  );
}

function CustomizedResourceTableRow({
  serial,
  scope,
  ownerId,
  programCode,
  classLevel,
  subject,
  existing,
  onUploaded,
  onDeleted,
}: {
  serial: number;
  scope: CustomizedScope;
  ownerId: string;
  programCode: string;
  classLevel: number;
  subject: string;
  existing: TeacherResourceRow | null;
  onUploaded: (row: TeacherResourceRow) => void;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const uploaded = Boolean(existing);

  return (
    <TableRow className="border-neutral-100">
      <TableCell className="pl-4 tabular-nums text-neutral-600">{serial}</TableCell>
      <TableCell className="font-medium text-neutral-900">{classLevel}</TableCell>
      <TableCell className="text-neutral-800">{subjectLabel(subject)}</TableCell>
      <TableCell>
        <DocumentCell fileName={existing?.fileName} fileSize={existing?.fileSize} />
      </TableCell>
      <TableCell className="pr-4 text-right">
        <UploadActions
          uploaded={uploaded}
          pending={pending}
          onFile={(file) => {
            startTransition(async () => {
              const form = new FormData();
              form.append("file", file);
              const result =
                scope === "school"
                  ? await uploadCustomizedTeacherResourceAction(
                      ownerId,
                      programCode,
                      classLevel,
                      subject,
                      form,
                    )
                  : await uploadHeadOfficeCustomizedTeacherResourceAction(
                      ownerId,
                      programCode,
                      classLevel,
                      subject,
                      form,
                    );
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              onUploaded(result.resource);
              toast.success(
                `Saved ${subjectLabel(subject)} · ${programCode} · Class ${classLevel}`,
              );
            });
          }}
          onRemove={
            existing
              ? () => {
                  startTransition(async () => {
                    const result =
                      scope === "school"
                        ? await deleteCustomizedTeacherResourceAction(
                            ownerId,
                            programCode,
                            classLevel,
                            subject,
                          )
                        : await deleteHeadOfficeCustomizedTeacherResourceAction(
                            ownerId,
                            programCode,
                            classLevel,
                            subject,
                          );
                    if (!result.ok) {
                      toast.error(result.message);
                      return;
                    }
                    onDeleted();
                    toast.success("Removed PDF");
                  });
                }
              : undefined
          }
        />
      </TableCell>
    </TableRow>
  );
}
