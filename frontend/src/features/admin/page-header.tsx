import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Omit when the top navbar breadcrumb already names this page. */
  title?: ReactNode;
  description?: ReactNode;
  /** Shown beside the title, e.g. how many items are listed. Hidden on small screens. */
  count?: number;
  /** Controls between the title and the actions, e.g. list filters. */
  toolbar?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, count, toolbar, actions }: PageHeaderProps) {
  if (!title && !description && !toolbar && !actions && count === undefined) return null;

  const showCountAlone = !title && count !== undefined;

  return (
    <div className="mb-6 flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:gap-4">
      {(title || description || count !== undefined) && (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 lg:mr-auto">
          {title ? (
            <h1 className="flex items-center gap-2.5 text-xl font-bold text-brand-900 sm:text-2xl">
              {title}
              {count !== undefined && (
                <span className="hidden rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 tabular-nums sm:inline-flex">
                  {count}
                </span>
              )}
            </h1>
          ) : null}
          {showCountAlone ? (
            <p className="text-sm font-semibold text-neutral-500 tabular-nums">{count} items</p>
          ) : null}
          {description ? (
            <p
              className={
                title
                  ? "basis-full text-sm text-muted-foreground"
                  : "text-sm font-medium text-neutral-600 tabular-nums"
              }
            >
              {description}
            </p>
          ) : null}
        </div>
      )}
      {toolbar}
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
