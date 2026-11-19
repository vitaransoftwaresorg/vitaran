import { Wrench } from "lucide-react";

/** Full-page notice when admin turns maintenance on for school/teacher portals. */
export function MaintenancePanel() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-6 py-14 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-900">
          <Wrench className="size-6" />
        </div>
        <h1 className="text-xl font-bold text-amber-950">Under maintenance</h1>
        <p className="text-sm text-amber-900">
          Vitaran Learning is under maintenance. Please try again shortly.
        </p>
      </div>
    </div>
  );
}
