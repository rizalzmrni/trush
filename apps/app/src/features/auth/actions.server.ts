import { EMAIL_AUTH_ERROR_CODES } from "@trush/core/schemas/auth";
import { data, redirect } from "react-router";

import type { RequestScope } from "../../lib/api.server";
import {
  EMAIL_PARAM,
  REASON_PARAM,
  VERIFY_REASONS,
} from "../email-verification/form-schema";
import type { VerifyReason } from "../email-verification/form-schema";
import {
  AUTH_ENDPOINTS,
  authErrorMessage,
  forwardSetCookies,
  needsTwoFactor,
  postAuth,
  readCode,
} from "./api.server";
import {
  parseAuthForm,
  signInFormSchema,
  signUpFormSchema,
} from "./form-schema";
import type { AuthActionResult, SignInForm, SignUpForm } from "./form-schema";
import {
  authPath,
  getSafeRedirect,
  SIGN_IN_PATH,
  VERIFY_EMAIL_PATH,
} from "./safe-redirect";

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_SERVER_ERROR = 500;

const valuesFrom = (formData: FormData) => {
  const email = formData.get("email");
  const name = formData.get("name");
  return {
    email: typeof email === "string" ? email : undefined,
    name: typeof name === "string" ? name : undefined,
  };
};

const failure = <Fields>(
  result: AuthActionResult<Fields>,
  status: number = HTTP_BAD_REQUEST
) => data(result, { status });

/** Tujuan setelah login: field tersembunyi `redirectTo`, disaring. */
const redirectTarget = (formData: FormData): string =>
  getSafeRedirect(formData.get("redirectTo"));

/** `/verify-email?email=…&reason=…&redirectTo=…`. */
const verifyEmailRedirect = (
  formData: FormData,
  email: string,
  reason: VerifyReason
) =>
  authPath(VERIFY_EMAIL_PATH, redirectTarget(formData), {
    [EMAIL_PARAM]: email,
    [REASON_PARAM]: reason,
  });

/** Login ditolak karena email belum diverifikasi (server mengirim kode baru). */
const isEmailNotVerified = async (response: Response): Promise<boolean> =>
  response.status === HTTP_FORBIDDEN &&
  (await readCode(response.clone())) ===
    EMAIL_AUTH_ERROR_CODES.emailNotVerified;

/**
 * Sign-up sukses tanpa sesi (`requireEmailVerification`): better-auth
 * membalas `{ token: null }` dan belum memasang cookie sesi.
 */
const awaitsVerification = async (response: Response): Promise<boolean> => {
  try {
    const body: unknown = await response.clone().json();
    return (
      typeof body === "object" &&
      body !== null &&
      "token" in body &&
      body.token === null
    );
  } catch {
    return false;
  }
};

/**
 * `POST /sign-in`: login email + kata sandi, teruskan cookie sesi. Email
 * belum terverifikasi (403 `EMAIL_NOT_VERIFIED`) → halaman verifikasi.
 */
export const signInAction = async (scope: RequestScope) => {
  const formData = await scope.request.formData();
  const values = valuesFrom(formData);
  const parsed = parseAuthForm(signInFormSchema, formData);
  if (!parsed.success) {
    return failure<SignInForm>({ fieldErrors: parsed.fieldErrors, values });
  }
  const { captchaToken, email, password } = parsed.data;
  const response = await postAuth(scope, {
    body: { email, password },
    captchaToken,
    endpoint: AUTH_ENDPOINTS.signIn,
  });
  if (await isEmailNotVerified(response)) {
    return redirect(
      verifyEmailRedirect(formData, email, VERIFY_REASONS.signIn)
    );
  }
  if (!response.ok) {
    return failure<SignInForm>(
      { formError: await authErrorMessage(response), values },
      response.status
    );
  }
  if (await needsTwoFactor(response)) {
    return failure<SignInForm>({
      formError:
        "Akun ini memakai verifikasi dua langkah, yang belum tersedia di aplikasi ini.",
      values,
    });
  }
  return redirect(redirectTarget(formData), {
    headers: forwardSetCookies(response),
  });
};

/**
 * `POST /sign-up`: daftar akun. Dengan verifikasi email wajib, api tidak
 * membuat sesi dan sudah mengirim kode → halaman verifikasi. Bila api
 * membuat sesi (verifikasi tidak wajib), cookie diteruskan seperti login.
 */
export const signUpAction = async (scope: RequestScope) => {
  const formData = await scope.request.formData();
  const values = valuesFrom(formData);
  const parsed = parseAuthForm(signUpFormSchema, formData);
  if (!parsed.success) {
    return failure<SignUpForm>({ fieldErrors: parsed.fieldErrors, values });
  }
  const { captchaToken, email, name, password } = parsed.data;
  const response = await postAuth(scope, {
    body: { email, name, password },
    captchaToken,
    endpoint: AUTH_ENDPOINTS.signUp,
  });
  if (!response.ok) {
    return failure<SignUpForm>(
      { formError: await authErrorMessage(response), values },
      response.status
    );
  }
  if (await awaitsVerification(response)) {
    return redirect(
      verifyEmailRedirect(formData, email, VERIFY_REASONS.signUp),
      {
        headers: forwardSetCookies(response),
      }
    );
  }
  return redirect(redirectTarget(formData), {
    headers: forwardSetCookies(response),
  });
};

/**
 * `POST /sign-out`: akhiri sesi di api lalu kembali ke `/sign-in`. Cookie
 * penghapus sesi dari api diteruskan. 4xx (mis. sesi sudah tidak ada) tetap
 * diarahkan ke login; 5xx dilempar ke ErrorBoundary karena sesi mungkin masih
 * aktif.
 */
export const signOutAction = async (scope: RequestScope) => {
  const response = await postAuth(scope, {
    body: {},
    endpoint: AUTH_ENDPOINTS.signOut,
  });
  if (response.status >= HTTP_SERVER_ERROR) {
    throw data(null, { status: response.status });
  }
  return redirect(SIGN_IN_PATH, { headers: forwardSetCookies(response) });
};
