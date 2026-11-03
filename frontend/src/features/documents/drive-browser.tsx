"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Upload,
} from "lucide-react";
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
import { PublishSwitch } from "./publish-switch";

const VIEW_KEY = "vitaran:drive-view";

export type DriveCrumb = { label: string; href: string };

export type DriveAction = {
  label: string;
  href?: string;
  onSelect?: () => void;
  icon?: "view" | "edit" | "upload";
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
  actions?: DriveAction[];
  onCreate?: () => void;
  creating?: boolean;
  createLabel?: string;
  fileKind?: "key" | "sheet";
  /** Per-class test ID shown in its own table column. */
  testId?: string;
  onTestIdChange?: (testId: string) => void;
  onSaveTestId?: (testId: string) => void | Promise<void>;
};

type DriveBrowserProps = {
  breadcrumbs: DriveCrumb[];
  items: DriveItem[];
  emptyText: string;
  searchPlaceholder?: string;
  /** Included in search (e.g. keys matched by test ID outside this folder). */
  searchItems?: DriveItem[];
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

function readView(): "list" | "grid" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

export function DriveBrowser({
  breadcrumbs,
  items,
  emptyText,
  searchPlaceholder = "Search in this folder",
  searchItems,
}: DriveBrowserProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle ? dedupeDriveItems([...items, ...(searchItems ?? [])]) : items;
    if (!needle) return pool;
    return pool.filter((item) => matchesDriveQuery(item, needle));
  }, [items, searchItems, query]);

  const showTestId = filtered.some(
    (item) => item.testId !== undefined || item.onSaveTestId || item.onTestIdChange,
  );

  useEffect(() => {
    setView(showTestId ? "list" : readView());
  }, [showTestId]);

  const setViewMode = (next: "list" | "grid") => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore
    }
  };

  const open = (item: DriveItem) => {
    if (item.kind === "empty") {
      item.onCreate?.();
      return;
    }
    if (item.href) router.push(item.href);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-3 py-2.5 sm:px-4">
        <nav aria-label="Folder path" className="min-w-0 flex-1">
          <ol className="flex flex-wrap items-center gap-0.5 text-sm">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <li key={`${crumb.href}-${crumb.label}`} className="flex min-w-0 items-center gap-0.5">
                  {index > 0 ? (
                    <ChevronRight className="size-3.5 shrink-0 text-neutral-400" />
                  ) : null}
                  {last ? (
                    <span className="truncate font-medium text-neutral-950">{crumb.label}</span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="truncate rounded-md px-1.5 py-0.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex items-center gap-1.5">
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-44 rounded-full border-neutral-200 bg-neutral-50 pr-3 pl-8 text-sm shadow-none sm:w-56"
            />
          </label>
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="List view"
            onClick={() => setViewMode("list")}
          >
            <List />
          </Button>
          <Button
            type="button"
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Grid view"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-neutral-500">
          {items.length === 0 ? emptyText : "No matches in this folder"}
        </p>
      ) : view === "list" ? (
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
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="group cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-[#e8f0fe]"
                  onClick={() => open(item)}
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col items-start gap-2 rounded-xl border border-transparent p-3 text-left hover:border-neutral-200 hover:bg-[#e8f0fe]"
            >
              <RowOpen item={item} onOpen={() => open(item)} className="flex w-full items-start gap-2 text-left">
                <ItemIcon item={item} large />
                <span className="min-w-0 flex-1 pr-8">
                  <span className="block truncate text-sm font-medium text-neutral-900">{item.name}</span>
                  {item.detail ? (
                    <span className="mt-0.5 block truncate text-xs text-neutral-500">{item.detail}</span>
                  ) : null}
                  {showTestId ? (
                    <span className="mt-1.5 block" onClick={(event) => event.stopPropagation()}>
                      <TestIdCell item={item} />
                    </span>
                  ) : null}
                </span>
              </RowOpen>
              {item.kind !== "folder" ? (
                <div className="absolute top-2 right-2 z-10">
                  <RowActions item={item} />
                </div>
              ) : null}
            </div>
          ))}
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

function ItemIcon({ item, large }: { item: DriveItem; large?: boolean }) {
  const box = large ? "size-10" : "size-7";
  const glyph = large ? "size-8" : "size-6";

  if (item.kind === "folder") {
    return <FolderGlyph className={glyph} />;
  }

  if (item.kind === "empty") {
    return (
      <span className={cn("flex items-center justify-center rounded-lg bg-neutral-100 text-neutral-500", box)}>
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
      <span className={cn("flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-700", box)}>
        <FileSpreadsheet className="size-4" />
      </span>
    );
  }

  return (
    <span className={cn("flex items-center justify-center rounded-lg bg-blue-50 text-blue-700", box)}>
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

  if (!hasMenu) return null;

  return (
    <div className="inline-flex items-center justify-end gap-1">
      {item.onPublish ? (
        <span className="hidden lg:inline-flex">
          <PublishSwitch
            published={item.published ?? false}
            label={item.publishLabel ?? item.name}
            onToggle={item.onPublish}
          />
        </span>
      ) : null}
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
            action.href ? (
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
    </div>
  );
}
