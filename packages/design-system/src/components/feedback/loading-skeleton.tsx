import { Skeleton } from "@trush/design-system/components/ui/skeleton";
import { cn } from "@trush/design-system/lib/utils";

type LoadingSkeletonVariant = "card" | "list" | "table" | "text";

interface LoadingSkeletonProps {
  className?: string;
  /** Dibacakan pembaca layar; tampilan skeleton sendiri disembunyikan. */
  label?: string;
  /** Jumlah baris/kartu placeholder. */
  rows?: number;
  /** Pilih yang bentuknya paling mirip konten asli. */
  variant?: LoadingSkeletonVariant;
}

const DEFAULT_ROWS = 3;
const TABLE_COLUMNS = 4;

// Indeks dipakai sebagai key: placeholder statis, tidak pernah diurutkan ulang.
const range = (count: number): number[] =>
  Array.from({ length: Math.max(0, count) }, (_, index) => index);

const TextSkeleton = ({ rows }: { rows: number }) => (
  <div className="flex flex-col gap-2">
    {range(rows).map((row) => (
      <Skeleton
        className={cn("h-4", row === rows - 1 ? "w-2/3" : "w-full")}
        key={row}
      />
    ))}
  </div>
);

const ListSkeleton = ({ rows }: { rows: number }) => (
  <ul className="flex flex-col gap-4">
    {range(rows).map((row) => (
      <li className="flex items-center gap-3" key={row}>
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </li>
    ))}
  </ul>
);

const CardSkeleton = ({ rows }: { rows: number }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {range(rows).map((card) => (
      <div
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
        key={card}
      >
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
);

const TableSkeleton = ({ rows }: { rows: number }) => (
  <div className="border-border flex flex-col overflow-hidden rounded-lg border">
    {range(rows + 1).map((row) => (
      <div
        className={cn(
          "border-border flex gap-4 p-3 not-last:border-b",
          row === 0 && "bg-muted/50"
        )}
        key={row}
      >
        {range(TABLE_COLUMNS).map((column) => (
          <Skeleton className="h-4 flex-1" key={column} />
        ))}
      </div>
    ))}
  </div>
);

const VARIANTS = {
  card: CardSkeleton,
  list: ListSkeleton,
  table: TableSkeleton,
  text: TextSkeleton,
} as const;

export const LoadingSkeleton = ({
  className,
  label = "Memuat…",
  rows = DEFAULT_ROWS,
  variant = "text",
}: LoadingSkeletonProps) => {
  const Placeholder = VARIANTS[variant];
  return (
    <div aria-busy="true" className={cn("w-full", className)}>
      {/* `<output>` ber-role `status`: label dibacakan tanpa memindah fokus. */}
      <output className="sr-only">{label}</output>
      <div aria-hidden="true">
        <Placeholder rows={rows} />
      </div>
    </div>
  );
};
