import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Omit when the top navbar breadcrumb already names this page. */
  title?: ReactNode;
  description?: ReactNode;
  /** Shown beside the title, e.g. how many items are listed. Hidden on small screens. */
  count?: number;
  /** Noun after a standalone count, e.g. "schools" → "12 schools". */
  countNoun?: string;
  /** Controls between the title and the actions, e.g. list filters. */
  toolbar?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  count,
  countNoun = "items",
  toolbar,
  actions,
}: PageHeaderProps) {
  if (!title && !description && !toolbar && !actions && count === undefined) return null;

  const showCountAlone = !title && count !== undefined;
  const hasLead = Boolean(title || description || count !== undefined);

  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
      {hasLead ? (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {title ? (
            <h1 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 sm:text-2xl">
              {title}
              {count !== undefined && (
                <span className="hidden rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 tabular-nums sm:inline-flex">
                  {count}
                </span>
              )}
            </h1>
          ) : null}
          {showCountAlone ? (
            <p className="text-sm font-semibold text-neutral-500 tabular-nums">
              {count} {countNoun}
            </p>
          ) : null}
          {description ? (
            <p
              className={
                title
                  ? "text-sm text-muted-foreground"
                  : "text-sm font-medium text-neutral-600 tabular-nums"
              }
            >
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      {toolbar ? <div className="min-w-0 w-full sm:w-auto sm:flex-1">{toolbar}</div> : null}
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
