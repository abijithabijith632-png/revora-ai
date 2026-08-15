import { Skeleton } from "@/components/ui";

/**
 * Route-level loading boundary for a polished loading state.
 */
export default function Loading() {
  return (
    <div className="p-6 lg:p-8" role="status" aria-label="Loading">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  );
}
