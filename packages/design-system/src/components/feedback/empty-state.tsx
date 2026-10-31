import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@trush/design-system/components/ui/empty";
import { cn } from "@trush/design-system/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: ReactNode;
  /** Aksi berikutnya, mis. tombol "Buat proyek". */
  action?: ReactNode;
  className?: string;
  /** Jelaskan apa yang biasanya muncul di sini. */
  description?: ReactNode;
  /** Ikon Tabler; dekoratif, judul tetap membawa maknanya. */
  icon?: ReactNode;
}

export const EmptyState = ({
  action,
  className,
  description,
  icon,
  title,
}: EmptyStateProps) => (
  <Empty className={cn("border-border border", className)}>
    <EmptyHeader>
      {icon ? (
        <EmptyMedia aria-hidden="true" variant="icon">
          {icon}
        </EmptyMedia>
      ) : null}
      <EmptyTitle>{title}</EmptyTitle>
      {description ? <EmptyDescription>{description}</EmptyDescription> : null}
    </EmptyHeader>
    {action ? <EmptyContent>{action}</EmptyContent> : null}
  </Empty>
);
