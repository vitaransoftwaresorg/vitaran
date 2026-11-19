"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

function isMaintenance(error: Error) {
  return /under maintenance/i.test(error.message);
}

export default function TeacherPanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  if (isMaintenance(error)) {
    return (
      <Empty className="min-h-96 rounded-xl border border-amber-200 bg-amber-50">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-amber-100 text-amber-900">
            <Wrench />
          </EmptyMedia>
          <EmptyTitle>Under maintenance</EmptyTitle>
          <EmptyDescription>
            Vitaran Learning is under maintenance. Please try again shortly.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => reset()}>
            <RotateCcw />
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="min-h-96 rounded-xl border bg-white">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <AlertTriangle />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>
          We couldn&apos;t load this page. Check that the API is running, then try again.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => reset()}>
          <RotateCcw />
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}
