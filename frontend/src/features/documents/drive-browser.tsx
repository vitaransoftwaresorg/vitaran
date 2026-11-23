"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useSetDrivePathCrumbs } from "@/components/layout/drive-path-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DeleteResult } from "@/types/document";
import { DeleteDocumentButton } from "./delete-document-button";
import { PublishSwitch } from "./publish-switch";

export type DriveCrumb = { label: string; href: string };

export type DriveAction = {
  label: string;
  href?: string;
  onSelect?: () => void;
  icon?: "view" | "edit" | "upload" | "download" | "print";
  /** A file route (e.g. PDF download): plain link, not client navigation. */
  download?: boolean;
};

export type DriveItem = {
  id: string;
  name: string;
  kind: "folder" | "file" | "empty";
  href?: string;
  detail?: string;
  modified?: string;
  published?: boolean;
  publishLabel?: string;
  onPublish?: (published: boolean) => Promise<DeleteResult>;
  /** Opens a confirm alert, then permanently removes this file. */
  onDelete?: () => Promise<DeleteResult>;
  deleteNoun?: string;
  actions?: DriveAction[];
  onCreate?: () => void;
  creating?: boolean;
  createLabel?: string;
  fileKind?: "key" | "sheet";
  /** Per-class test ID shown in its own table column. */
  testId?: string;
  onTestIdChange?: (testId: string) => void;
  onSaveTestId?: (testId: string) => void | Promise<void>;
  /** Shown when the row is clicked but has no href (e.g. Not Published). */
  blockedMessage?: string;
  /** Optional image for folder rows (e.g. school logo). */
  imageSrc?: string;
  /** When true and there is no imageSrc, show initials from the name instead of a folder icon. */
  nameLogo?: boolean;
};

type DriveBrowserProps = {
  breadcrumbs: DriveCrumb[];
  items: DriveItem[];
  emptyText: string;
  searchPlaceholder?: string;
  /** Included in search (e.g. keys matched by test ID outside this folder). */
  searchItems?: DriveItem[];
  /** Shown in the toolbar above the folder table (e.g. Import Excel). */
  headerAction?: React.ReactNode;
};

function dedupeDriveItems(rows: DriveItem[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function matchesDriveQuery(item: DriveItem, needle: string) {
  return (
    item.name.toLowerCase().includes(needle) ||
    (item.testId ?? "").toLowerCase().includes(needle)
  );
}

export function DriveBrowser({
  breadcrumbs,
  items,
  emptyText,
  searchPlaceholder = "Search in this folder",
  searchItems,
  headerAction,
}: DriveBrowserProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  /** Local publish flags so toggling one row doesn't require a page refresh. */
  const [publishedById, setPublishedById] = useState<Record<string, boolean>>({});

  const withPublish = (rows: DriveItem[]) =>
    rows.map((item) => {
      if (!item.onPublish) return item;
      const published = publishedById[item.id] ?? item.published ?? false;
      return {
        ...item,
        published,
        detail: item.detail?.replace(/\b(Published|Hidden)\b/g, published ? "Published" : "Hidden"),
        onPublish: async (next: boolean) => {
          const result = await item.onPublish!(next);
          if (result.ok) setPublishedById((prev) => ({ ...prev, [item.id]: next }));
          return result;
        },
      };
    });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = withPublish(
      needle ? dedupeDriveItems([...items, ...(searchItems ?? [])]) : items,
    );
    if (!needle) return pool;
    return pool.filter((item) => matchesDriveQuery(item, needle));
    // publishedById is applied inside withPublish
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, searchItems, query, publishedById]);

  const showTestId = filtered.some(
    (item) => item.testId !== undefined || item.onSaveTestId || item.onTestIdChange,
  );

  const open = (item: DriveItem) => {
    if (item.kind === "empty") {
      item.onCreate?.();
      return;
    }
    if (item.href) router.push(item.href);
  };

  // Folder path lives in the top navbar only — never a second crumb row on the table.
  const setDrivePath = useSetDrivePathCrumbs();
  const folderCrumbsKey = breadcrumbs
    .slice(1)
    .map((crumb) => `${crumb.href}\0${crumb.label}`)
    .join("\n");
  const folderCrumbs = useMemo(() => {
    // Drop the section root (Answer keys / Results / …) — already in route breadcrumbs.
    return breadcrumbs.length > 1 ? breadcrumbs.slice(1) : [];
    // Keyed by serialized path so parent re-renders don't wipe the trail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderCrumbsKey]);

  useEffect(() => {
    if (!setDrivePath) return;
    setDrivePath(folderCrumbs);
  }, [folderCrumbs, setDrivePath]);

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-end gap-3 border-b border-neutral-200 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none sm:justify-end">
          {headerAction}
          <label className="relative hidden min-w-0 flex-1 sm:block sm:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-8 w-full rounded-full border-neutral-200 bg-neutral-50 pr-3 pl-8 text-sm shadow-none sm:w-56"
            />
          </label>
        </div>
      </div>

      <div className="border-b border-neutral-200 px-3 py-2.5 sm:hidden">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-full border-neutral-200 bg-neutral-50 pr-3 pl-9 text-base shadow-none"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-neutral-500">
          {items.length === 0 ? emptyText : "No matches in this folder"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase">
                <th className="px-4 py-2 font-medium">Name</th>
                {showTestId ? <th className="px-3 py-2 font-medium">Test ID</th> : null}
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Details</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Modified</th>
                <th className="w-28 px-3 py-2 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const canOpen = Boolean(item.href) || item.kind === "folder" || item.kind === "empty";
                const canAlert = Boolean(item.blockedMessage);
                return (
                <tr
                  key={item.id}
                  className={cn(
                    "group border-b border-neutral-100 last:border-0",
                    canOpen || canAlert
                      ? "cursor-pointer hover:bg-[#e8f0fe]"
                      : "cursor-default opacity-90",
                  )}
                  onClick={() => {
                    if (canOpen) open(item);
                    else if (item.blockedMessage) toast.message(item.blockedMessage);
                  }}
                >
                  <td className="px-4 py-2">
                    <RowOpen item={item} onOpen={() => open(item)}>
                      <span className="flex min-w-0 items-center gap-3">
                        <ItemIcon item={item} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-neutral-900">{item.name}</span>
                          <span className="block truncate text-xs text-neutral-500 sm:hidden">
                            {item.detail}
                          </span>
                        </span>
                      </span>
                    </RowOpen>
                  </td>
                  {showTestId ? (
                    <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                      <TestIdCell item={item} />
                    </td>
                  ) : null}
                  <td className="hidden px-3 py-2 text-neutral-600 sm:table-cell">{item.detail ?? "—"}</td>
                  <td className="hidden px-3 py-2 text-neutral-500 md:table-cell">{item.modified ?? "—"}</td>
                  <td className="px-3 py-2 text-right" onClick={(event) => event.stopPropagation()}>
                    <RowActions item={item} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TestIdCell({ item }: { item: DriveItem }) {
  if (item.onSaveTestId || item.onTestIdChange) {
    return <TestIdInput item={item} />;
  }
  return (
    <span className="font-mono text-sm text-neutral-800">{item.testId?.trim() || "—"}</span>
  );
}

function TestIdInput({ item }: { item: DriveItem }) {
  const [value, setValue] = useState(item.testId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(item.testId ?? "");
  }, [item.testId]);

  const commit = async () => {
    const next = value.trim();
    if (item.onTestIdChange) item.onTestIdChange(next);
    if (!item.onSaveTestId || next === (item.testId ?? "").trim()) return;
    setSaving(true);
    try {
      await item.onSaveTestId(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Input
      value={value}
      disabled={saving}
      maxLength={64}
      placeholder="Enter test ID"
      aria-label={`Test ID for ${item.name}`}
      className="h-8 w-40 bg-white font-mono text-sm"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setValue(next);
        item.onTestIdChange?.(next);
      }}
      onBlur={() => {
        void commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function RowOpen({
  item,
  onOpen,
  className,
  children,
}: {
  item: DriveItem;
  onOpen: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  if (item.href) {
    return (
      <Link
        href={item.href}
        className={cn("min-w-0", className)}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </Link>
    );
  }

  if (item.kind === "folder" || item.kind === "empty") {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        className={cn("min-w-0 text-left", className)}
      >
        {children}
      </button>
    );
  }

  if (item.blockedMessage) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toast.message(item.blockedMessage);
        }}
        className={cn("min-w-0 text-left", className)}
      >
        {children}
      </button>
    );
  }

  // File listed without a link — not openable.
  return <div className={cn("min-w-0", className)}>{children}</div>;
}

function nameInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function ItemIcon({ item }: { item: DriveItem }) {
  if (item.kind === "folder") {
    if (item.imageSrc) {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- school logo from admin proxy
        <img
          src={item.imageSrc}
          alt=""
          className="size-7 rounded-md border border-neutral-200 bg-white object-contain p-0.5"
        />
      );
    }
    if (item.nameLogo) {
      return (
        <span className="flex size-7 items-center justify-center rounded-md border border-brand-100 bg-brand-50 text-[10px] font-semibold tracking-wide text-brand-800">
          {nameInitials(item.name)}
        </span>
      );
    }
    return <FolderGlyph className="size-6" />;
  }

  if (item.kind === "empty") {
    return (
      <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
        {item.createLabel?.toLowerCase().includes("upload") ? (
          <Upload className="size-4" />
        ) : (
          <Plus className="size-4" />
        )}
      </span>
    );
  }

  if (item.fileKind === "sheet") {
    return (
      <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
        <FileSpreadsheet className="size-4" />
      </span>
    );
  }

  return (
    <span className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
      <FileText className="size-4" />
    </span>
  );
}

function FolderGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M10.2 4H4.5A1.5 1.5 0 0 0 3 5.5v13A1.5 1.5 0 0 0 4.5 20h15a1.5 1.5 0 0 0 1.5-1.5V8.2A1.5 1.5 0 0 0 19.5 6.7h-7.1L10.2 4Z"
        fill="#FBC02D"
      />
      <path d="M4.5 8h15A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8Z" fill="#FDD835" />
    </svg>
  );
}

function ActionIcon({ icon }: { icon?: DriveAction["icon"] }) {
  if (icon === "edit") return <Pencil />;
  if (icon === "upload") return <Upload />;
  if (icon === "download") return <Download />;
  if (icon === "print") return <Printer />;
  return <Eye />;
}

function RowActions({ item }: { item: DriveItem }) {
  if (item.kind === "empty") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={item.creating}
        onClick={(event) => {
          event.stopPropagation();
          item.onCreate?.();
        }}
      >
        {item.creating ? "Opening…" : item.createLabel ?? "Add"}
      </Button>
    );
  }

  if (item.kind === "folder") return null;

  const actions = item.actions ?? [];
  const hasMenu = actions.length > 0 || item.onPublish;
  const hasDelete = Boolean(item.onDelete);

  if (!hasMenu && !hasDelete) return null;

  return (
    <div className="inline-flex items-center justify-end gap-1">
      {item.onPublish ? (
        <span className="hidden lg:inline-flex">
          <PublishSwitch
            key={`${item.id}:publish`}
            published={item.published ?? false}
            label={item.publishLabel ?? item.name}
            onToggle={item.onPublish}
          />
        </span>
      ) : null}
      {item.onDelete ? (
        <DeleteDocumentButton
          fileName={item.publishLabel ?? item.name}
          noun={item.deleteNoun ?? "file"}
          onDelete={item.onDelete}
        />
      ) : null}
      {hasMenu ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${item.name}`}
              className="text-neutral-500"
            />
          }
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {actions.map((action) =>
            action.href && action.download ? (
              <DropdownMenuItem key={action.label} render={<a href={action.href} />}>
                <ActionIcon icon={action.icon} />
                {action.label}
              </DropdownMenuItem>
            ) : action.href ? (
              <DropdownMenuItem key={action.label} render={<Link href={action.href} />}>
                <ActionIcon icon={action.icon} />
                {action.label}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={action.label} onClick={action.onSelect}>
                <ActionIcon icon={action.icon} />
                {action.label}
              </DropdownMenuItem>
            ),
          )}
          {item.onPublish ? (
            <>
              {actions.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                onClick={() => {
                  void item.onPublish?.(!(item.published ?? false));
                }}
              >
                {item.published ? "Hide from schools" : "Publish to schools"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      ) : null}
    </div>
  );
}
