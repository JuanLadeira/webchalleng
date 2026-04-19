interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} aria-hidden="true" />;
}

export function SkeletonBookingCard() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonTableRows({ cols = 5, rows = 4 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-5 py-4">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
