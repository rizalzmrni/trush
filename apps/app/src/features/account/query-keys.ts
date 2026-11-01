/** Query key fitur akun; dipakai bersama oleh loader, `useQuery`, invalidasi. */
export const accountKeys = {
  all: ["account"] as const,
  me: () => [...accountKeys.all, "me"] as const,
  organizations: () => [...accountKeys.all, "organizations"] as const,
};
