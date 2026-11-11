import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Shown beside the title, e.g. how many items are listed. Hidden on small screens. */
  count?: number;
  /** Controls between the title and the actions, e.g. list filters. */
  toolbar?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, count, toolbar, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="min-w-0 lg:mr-auto">
        <h1 className="flex items-center gap-2.5 text-xl font-bold text-brand-900 sm:text-2xl">
          {title}
          {count !== undefined && (
            <span className="hidden rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 tabular-nums sm:inline-flex">
              {count}
            </span>
          )}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {toolbar}
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
