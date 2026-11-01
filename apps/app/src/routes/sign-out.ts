import { redirect } from "react-router";

import { signOutAction } from "../features/auth/actions.server";
import { SIGN_IN_PATH } from "../features/auth/safe-redirect";
import type { Route } from "./+types/sign-out";

export const action = ({ context, request }: Route.ActionArgs) =>
  signOutAction({ context, request });

// GET tidak pernah mengakhiri sesi (cegah logout lewat tautan atau CSRF).
export const loader = () => redirect(SIGN_IN_PATH);
