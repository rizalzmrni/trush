import { IconArrowLeft, IconMailForward } from "@tabler/icons-react";
import { EMAIL_OTP_LENGTH } from "@trush/core/schemas/auth";
import { FormMessage } from "@trush/design-system/components/form/form-message";
import { TextField } from "@trush/design-system/components/form/text-field";
import {
  Button,
  buttonVariants,
} from "@trush/design-system/components/ui/button";
import { Separator } from "@trush/design-system/components/ui/separator";
import { Form, Link } from "react-router";

import { Turnstile } from "../../auth/forms/turnstile";
import {
  authPath,
  REDIRECT_PARAM,
  VERIFY_EMAIL_PATH,
} from "../../auth/safe-redirect";
import { INTENT_FIELD, VERIFY_EMAIL_INTENTS } from "../form-schema";
import type { VerifyStepResult } from "../form-schema";
import { useIntentSubmitting } from "./submitting";

interface VerifyCodeFormProps {
  email: string;
  /** Hasil action terakhir di langkah ini (gagal atau kode terkirim). */
  result?: VerifyStepResult;
  /** Info dari halaman asal (daftar/login), ditampilkan sebelum ada hasil action. */
  initialNotice?: string;
  redirectTo: string;
  turnstileSiteKey: string;
}

/**
 * Masukkan kode 6 digit dari email; di bawahnya form kirim ulang (Turnstile
 * baru per kirim). "Ganti email" membuka langkah isi email.
 */
export const VerifyCodeForm = ({
  email,
  initialNotice,
  redirectTo,
  result,
  turnstileSiteKey,
}: VerifyCodeFormProps) => {
  const verifying = useIntentSubmitting(VERIFY_EMAIL_INTENTS.verify);
  const resending = useIntentSubmitting(VERIFY_EMAIL_INTENTS.resend);
  const notice = result ? result.notice : initialNotice;

  return (
    <div className="flex flex-col gap-6">
      {result?.formError ? <FormMessage>{result.formError}</FormMessage> : null}
      {notice && !result?.formError ? (
        <FormMessage variant="success">{notice}</FormMessage>
      ) : null}
      <Form className="flex flex-col gap-5" method="post">
        <input
          name={INTENT_FIELD}
          type="hidden"
          value={VERIFY_EMAIL_INTENTS.verify}
        />
        <input name="email" type="hidden" value={email} />
        <input name={REDIRECT_PARAM} type="hidden" value={redirectTo} />
        <TextField
          autoComplete="one-time-code"
          description={
            <>
              Kode {EMAIL_OTP_LENGTH} digit untuk{" "}
              <span className="text-foreground font-medium break-all">
                {email}
              </span>
              .
            </>
          }
          error={result?.fieldErrors?.otp}
          inputMode="numeric"
          label="Kode verifikasi"
          maxLength={EMAIL_OTP_LENGTH}
          minLength={EMAIL_OTP_LENGTH}
          name="otp"
          pattern={`\\d{${EMAIL_OTP_LENGTH}}`}
          required
        />
        <Button
          aria-busy={verifying}
          disabled={verifying}
          size="lg"
          type="submit"
        >
          {verifying ? "Memverifikasi…" : "Verifikasi email"}
        </Button>
      </Form>
      <Separator />
      <Form className="flex flex-col gap-4" method="post">
        <p className="text-muted-foreground text-sm">
          Belum menerima kode atau kodenya kedaluwarsa? Minta kode baru.
        </p>
        <input
          name={INTENT_FIELD}
          type="hidden"
          value={VERIFY_EMAIL_INTENTS.resend}
        />
        <input name="email" type="hidden" value={email} />
        <input name={REDIRECT_PARAM} type="hidden" value={redirectTo} />
        <Turnstile resetKey={result} siteKey={turnstileSiteKey} />
        {result?.fieldErrors?.captchaToken ? (
          <FormMessage>{result.fieldErrors.captchaToken}</FormMessage>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            aria-busy={resending}
            disabled={resending}
            type="submit"
            variant="outline"
          >
            <IconMailForward aria-hidden="true" data-icon="inline-start" />
            {resending ? "Mengirim ulang…" : "Kirim ulang kode"}
          </Button>
          <Link
            className={buttonVariants({ variant: "ghost" })}
            to={authPath(VERIFY_EMAIL_PATH, redirectTo)}
          >
            <IconArrowLeft aria-hidden="true" data-icon="inline-start" />
            Ganti email
          </Link>
        </div>
      </Form>
    </div>
  );
};
