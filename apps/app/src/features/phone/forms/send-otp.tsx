import { FormMessage } from "@trush/design-system/components/form/form-message";
import { RadioGroupField } from "@trush/design-system/components/form/radio-group-field";
import { TextField } from "@trush/design-system/components/form/text-field";
import { Button } from "@trush/design-system/components/ui/button";
import { Form } from "react-router";

import { Turnstile } from "../../auth/forms/turnstile";
import { CHANNEL_LABELS, INTENT_FIELD, PHONE_INTENTS } from "../form-schema";
import type { SendStepResult } from "../form-schema";
import { usePhoneSubmitting } from "./submitting";

const CHANNEL_OPTIONS = [
  {
    description: "Disarankan. Kode masuk ke chat WhatsApp nomor ini.",
    label: CHANNEL_LABELS.whatsapp,
    value: "whatsapp",
  },
  { description: "Pesan teks biasa.", label: CHANNEL_LABELS.sms, value: "sms" },
] as const;

interface SendOtpFormProps {
  /** Nomor saat ini; mengubah teks tombol menjadi "ganti". */
  hasPhone: boolean;
  /** Hasil action terakhir yang gagal di langkah ini. */
  result?: SendStepResult;
  turnstileSiteKey: string;
}

/** Langkah 1: nomor baru + kanal pengiriman kode + Turnstile. */
export const SendOtpForm = ({
  hasPhone,
  result,
  turnstileSiteKey,
}: SendOtpFormProps) => {
  const submitting = usePhoneSubmitting(PHONE_INTENTS.send);
  const errors = result?.fieldErrors;

  return (
    <Form className="flex flex-col gap-5" method="post">
      {result?.formError ? <FormMessage>{result.formError}</FormMessage> : null}
      <input name={INTENT_FIELD} type="hidden" value={PHONE_INTENTS.send} />
      <TextField
        autoComplete="tel"
        defaultValue={result?.values.phoneNumber}
        description="Nomor Indonesia, mis. 0812-3456-7890 atau +6281234567890."
        error={errors?.phoneNumber}
        inputMode="tel"
        label={hasPhone ? "Nomor telepon baru" : "Nomor telepon"}
        name="phoneNumber"
        placeholder="0812-3456-7890"
        required
        type="tel"
      />
      <RadioGroupField
        defaultValue={result?.values.channel ?? "whatsapp"}
        error={errors?.channel}
        label="Kirim kode lewat"
        name="channel"
        options={CHANNEL_OPTIONS}
      />
      <Turnstile resetKey={result} siteKey={turnstileSiteKey} />
      {errors?.captchaToken ? (
        <FormMessage>{errors.captchaToken}</FormMessage>
      ) : null}
      <Button
        aria-busy={submitting}
        disabled={submitting}
        size="lg"
        type="submit"
      >
        {submitting ? "Mengirim kode…" : "Kirim kode"}
      </Button>
    </Form>
  );
};
