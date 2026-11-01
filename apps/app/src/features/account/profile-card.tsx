import { useQuery } from "@tanstack/react-query";
import { ErrorState } from "@trush/design-system/components/feedback/error-state";
import { LoadingSkeleton } from "@trush/design-system/components/feedback/loading-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trush/design-system/components/ui/card";

import { getBrowserApiClient } from "../../lib/api-client";
import { meQueryOptions } from "./queries";

/** Ringkasan pengguna yang login (data dari prefetch loader). */
export const ProfileCard = () => {
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    meQueryOptions(getBrowserApiClient)
  );

  if (isPending) {
    return <LoadingSkeleton label="Memuat profil…" rows={2} />;
  }
  if (isError) {
    return (
      <ErrorState
        description="Profil kamu tidak dapat dimuat."
        onRetry={async () => {
          await refetch();
        }}
        retrying={isFetching}
      />
    );
  }

  const { user } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">{user.name}</h2>
        </CardTitle>
        <CardDescription className="break-all">{user.email}</CardDescription>
      </CardHeader>
      {user.username ? (
        <CardContent className="text-muted-foreground text-sm">
          @{user.username}
        </CardContent>
      ) : null}
    </Card>
  );
};
