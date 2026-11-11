"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Upload, X } from "lucide-react";
import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { formatFileSize } from "./constants";

type PdfFieldProps = {
  /** The PDF already saved, when editing. */
  current?: { fileName: string; fileSize: number; href: string };
  errors?: string[];
  onFileChange: (hasFile: boolean) => void;
};

/** Upload: a drop box. Edit: the current file with a "Replace PDF" button. */
export function PdfField({ current, errors, onFileChange }: PdfFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const invalid = Boolean(errors?.length);

  function selectFile(next: File | null) {
    setFile(next);
    onFileChange(next !== null);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    selectFile(null);
  }

  const input = (className: string) => (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      name="file"
      accept="application/pdf,.pdf"
      aria-invalid={invalid || undefined}
      className={className}
      onChange={(event) => selectFile(event.currentTarget.files?.[0] ?? null)}
    />
  );

  if (current) {
    return (
      <div className="space-y-2">
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors sm:flex-nowrap",
            file ? "border-2 border-brand-900 bg-brand-50" : "border-brand-100 bg-white",
          )}
        >
          {input("sr-only")}
          {file ? (
            <>
              <FileIcon solid />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                  <span className="truncate">{file.name}</span>
                  <Tag>New</Tag>
                </p>
                <p className="truncate text-xs text-neutral-600">
                  {formatFileSize(file.size)} · replaces{" "}
                  <span className="text-neutral-400 line-through">{current.fileName}</span> when you save
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <label
                  htmlFor={inputId}
                  className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-white"
                >
                  Change
                </label>
                <button
                  type="button"
                  onClick={clear}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-white hover:text-neutral-950"
                >
                  <X className="size-3.5" />
                  Undo
                </button>
              </div>
            </>
          ) : (
            <>
              <FileIcon />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-950">{current.fileName}</p>
                <p className="text-xs text-neutral-500">Current file · {formatFileSize(current.fileSize)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={current.href}
                  target="_blank"
                  rel="noreferrer"
                  prefetch={false}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-900"
                >
                  Open
                  <ExternalLink className="size-3.5" />
                </Link>
                <label
                  htmlFor={inputId}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-brand-800"
                >
                  <Upload className="size-3.5" />
                  Replace PDF
                </label>
              </div>
            </>
          )}
        </div>
        {invalid && <FieldError>{errors?.[0]}</FieldError>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <label
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDrop={() => setDragging(false)}
          className={cn(
            "relative flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
            file
              ? "border-2 border-brand-900 bg-brand-50"
              : dragging
                ? "border-brand-700 bg-brand-700"
                : "border-brand-900 bg-brand-900 hover:border-brand-800 hover:bg-brand-800",
            invalid && !file && "ring-3 ring-destructive/40",
          )}
        >
          {input("absolute inset-0 cursor-pointer opacity-0")}
          {file ? (
            <>
              <FileIcon solid />
              <div className="min-w-0 flex-1 pr-20">
                <p className="truncate text-sm font-semibold text-neutral-950">{file.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <Tag>Ready</Tag>
                  {formatFileSize(file.size)}
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                <Upload className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  Choose a PDF <span className="font-normal text-white/70">or drag it here</span>
                </p>
                <p className="text-xs text-white/60">PDF only · up to 10 MB</p>
              </div>
            </>
          )}
        </label>
        {file && (
          <button
            type="button"
            onClick={clear}
            className="absolute top-1/2 right-3 z-10 inline-flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-white hover:text-brand-900"
          >
            <X className="size-3.5" />
            Remove
          </button>
        )}
      </div>
      {invalid && <FieldError>{errors?.[0]}</FieldError>}
    </div>
  );
}

function FileIcon({ solid }: { solid?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg",
        solid ? "bg-brand-900 text-white" : "border border-brand-100 bg-brand-50 text-brand-700",
      )}
    >
      <FileText className="size-4" />
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-brand-900 px-2 py-px text-[10px] font-semibold tracking-wide text-white uppercase">
      {children}
    </span>
  );
}
