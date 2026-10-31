import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { Button } from "@trush/design-system/components/ui/button";
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

interface ErrorStateProps {
  className?: string;
  description?: ReactNode;
  /** Tanpa `onRetry`, tombol coba lagi tidak ditampilkan. */
  onRetry?: () => void;
  /** Percobaan ulang sedang berjalan. */
  retrying?: boolean;
  retryLabel?: string;
  title?: ReactNode;
}

export const ErrorState = ({
  className,
  description,
  onRetry,
  retrying = false,
  retryLabel = "Coba lagi",
  title = "Gagal memuat data",
}: ErrorStateProps) => (
  <Empty className={cn("border-destructive/40 border", className)} role="alert">
    <EmptyHeader>
      <EmptyMedia
        aria-hidden="true"
        className="bg-destructive text-destructive-foreground"
        variant="icon"
      >
        <IconAlertCircle />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      {description ? <EmptyDescription>{description}</EmptyDescription> : null}
    </EmptyHeader>
    {onRetry ? (
      <EmptyContent>
        <Button
          aria-busy={retrying}
          disabled={retrying}
          onClick={onRetry}
          variant="outline"
        >
          <IconRefresh aria-hidden="true" data-icon="inline-start" />
          {retryLabel}
        </Button>
      </EmptyContent>
    ) : null}
  </Empty>
);
