import type { VerifyEmailActionResult } from "./form-schema";
import { RequestCodeForm } from "./forms/request-code";
import { VerifyCodeForm } from "./forms/verify-code";
import { PasswordSetup } from "./password-setup";

interface EmailVerificationProps {
  /** Email dari URL (`?email=`); `null` → langkah isi email. */
  email: string | null;
  /** Pesan dari halaman asal (daftar/login). */
  notice: string | null;
  redirectTo: string;
  /** Hasil action terakhir; kosong pada kunjungan pertama. */
  result?: VerifyEmailActionResult;
  turnstileSiteKey: string;
}

/**
 * Isi halaman `/verify-email`. Langkah ditentukan hasil action lalu email
 * dari URL, sehingga tetap berjalan tanpa JavaScript selain widget Turnstile.
 */
export const EmailVerification = ({
  email,
  notice,
  redirectTo,
  result,
  turnstileSiteKey,
}: EmailVerificationProps) => {
  if (result?.step === "password-setup") {
    return <PasswordSetup email={result.email} />;
  }
  if (result?.step === "verify") {
    return (
      <VerifyCodeForm
        email={result.email}
        redirectTo={redirectTo}
        result={result}
        turnstileSiteKey={turnstileSiteKey}
      />
    );
  }
  if (result?.step === "request" || !email) {
    return (
      <RequestCodeForm
        redirectTo={redirectTo}
        result={result}
        turnstileSiteKey={turnstileSiteKey}
      />
    );
  }
  return (
    <VerifyCodeForm
      email={email}
      initialNotice={notice ?? undefined}
      redirectTo={redirectTo}
      turnstileSiteKey={turnstileSiteKey}
    />
  );
};
