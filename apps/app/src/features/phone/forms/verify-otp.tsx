import { IconArrowLeft, IconMessage } from "@tabler/icons-react";
import { PHONE_OTP_LENGTH } from "@trush/core/schemas/auth";
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
  INTENT_FIELD,
  PHONE_INTENTS,
  PHONE_SETTINGS_PATH,
} from "../form-schema";
import type { VerifyStepResult } from "../form-schema";
import { CurrentPasswordField } from "./current-password";
import { usePhoneSubmitting } from "./submitting";

interface VerifyOtpFormProps {
  result: VerifyStepResult;
  turnstileSiteKey: string;
}

/**
 * Langkah 2: masukkan kode 6 digit. Kirim ulang selalu lewat SMS (kanal
 * cadangan bila WhatsApp tidak sampai) dan butuh Turnstile baru serta kata
 * sandi saat ini (setiap kirim kode membuat grant step-up baru).
 */
export const VerifyOtpForm = ({
  result,
  turnstileSiteKey,
}: VerifyOtpFormProps) => {
  const verifying = usePhoneSubmitting(PHONE_INTENTS.verify);
  const resending = usePhoneSubmitting(PHONE_INTENTS.resend);
  const { phoneNumber } = result;

  return (
    <div className="flex flex-col gap-6">
      {result.formError ? <FormMessage>{result.formError}</FormMessage> : null}
      {result.notice && !result.formError ? (
        <FormMessage variant="success">{result.notice}</FormMessage>
      ) : null}
      <Form className="flex flex-col gap-5" method="post">
        <input name={INTENT_FIELD} type="hidden" value={PHONE_INTENTS.verify} />
        <input name="phoneNumber" type="hidden" value={phoneNumber} />
        <input name="channel" type="hidden" value={result.channel} />
        <TextField
          autoComplete="one-time-code"
          description={`Kode ${PHONE_OTP_LENGTH} digit untuk ${phoneNumber}.`}
          error={result.fieldErrors?.code}
          inputMode="numeric"
          label="Kode verifikasi"
          maxLength={PHONE_OTP_LENGTH}
          minLength={PHONE_OTP_LENGTH}
          name="code"
          pattern={`\\d{${PHONE_OTP_LENGTH}}`}
          required
        />
        <Button
          aria-busy={verifying}
          disabled={verifying}
          size="lg"
          type="submit"
        >
          {verifying ? "Memverifikasi…" : "Verifikasi nomor"}
        </Button>
      </Form>
      <Separator />
      <Form className="flex flex-col gap-4" method="post">
        <p className="text-muted-foreground text-sm">
          Belum menerima kode? Kirim ulang lewat SMS.
        </p>
        <input name={INTENT_FIELD} type="hidden" value={PHONE_INTENTS.resend} />
        <input name="phoneNumber" type="hidden" value={phoneNumber} />
        <input name="channel" type="hidden" value="sms" />
        <CurrentPasswordField
          error={result.fieldErrors?.currentPassword}
          resetKey={result}
        />
        <Turnstile resetKey={result} siteKey={turnstileSiteKey} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            aria-busy={resending}
            disabled={resending}
            type="submit"
            variant="outline"
          >
            <IconMessage aria-hidden="true" data-icon="inline-start" />
            {resending ? "Mengirim ulang…" : "Kirim ulang lewat SMS"}
          </Button>
          <Link
            className={buttonVariants({ variant: "ghost" })}
            to={PHONE_SETTINGS_PATH}
          >
            <IconArrowLeft aria-hidden="true" data-icon="inline-start" />
            Ganti nomor
          </Link>
        </div>
      </Form>
    </div>
  );
};
