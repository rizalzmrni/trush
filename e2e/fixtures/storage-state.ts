import path from "node:path";

/** Sesi pengguna bersama hasil `auth.setup.ts` (`e2e/.auth` di-gitignore). */
export const STORAGE_STATE = path.resolve(
  import.meta.dirname,
  "../.auth/user.json"
);
