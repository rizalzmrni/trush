import { IconBuilding } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@trush/design-system/components/feedback/empty-state";
import { ErrorState } from "@trush/design-system/components/feedback/error-state";
import { LoadingSkeleton } from "@trush/design-system/components/feedback/loading-skeleton";

import { getBrowserApiClient } from "../../lib/api-client";
import { organizationsQueryOptions } from "./queries";

/** Label peran plugin `organization`; peran tak dikenal ditampilkan apa adanya. */
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Anggota",
  owner: "Pemilik",
};

/** Daftar organisasi pengguna dengan state loading, error, kosong, dan isi. */
export const OrganizationList = () => {
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    organizationsQueryOptions(getBrowserApiClient)
  );

  if (isPending) {
    return <LoadingSkeleton label="Memuat organisasi…" variant="list" />;
  }
  if (isError) {
    return (
      <ErrorState
        description="Daftar organisasi tidak dapat dimuat."
        onRetry={async () => {
          await refetch();
        }}
        retrying={isFetching}
      />
    );
  }
  if (data.organizations.length === 0) {
    return (
      <EmptyState
        description="Organisasi yang kamu buat atau ikuti akan muncul di sini."
        icon={<IconBuilding />}
        title="Belum ada organisasi"
      />
    );
  }

  return (
    <ul className="border-border bg-card text-card-foreground divide-border flex flex-col divide-y rounded-xl border">
      {data.organizations.map((organization) => (
        <li className="flex items-center gap-3 p-4" key={organization.id}>
          <div
            aria-hidden="true"
            className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
          >
            <IconBuilding className="size-5" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{organization.name}</span>
            <span className="text-muted-foreground truncate text-sm">
              /{organization.slug}
            </span>
          </div>
          <span className="bg-secondary text-secondary-foreground shrink-0 rounded-md px-2 py-0.5 text-xs font-medium">
            {ROLE_LABELS[organization.role] ?? organization.role}
          </span>
        </li>
      ))}
    </ul>
  );
};
