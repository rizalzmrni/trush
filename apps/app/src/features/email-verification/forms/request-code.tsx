import { FormMessage } from "@trush/design-system/components/form/form-message";
import { TextField } from "@trush/design-system/components/form/text-field";
import { Button } from "@trush/design-system/components/ui/button";
import { Form } from "react-router";

import { Turnstile } from "../../auth/forms/turnstile";
import { REDIRECT_PARAM } from "../../auth/safe-redirect";
import { INTENT_FIELD, VERIFY_EMAIL_INTENTS } from "../form-schema";
import type { RequestStepResult } from "../form-schema";
import { useIntentSubmitting } from "./submitting";

interface RequestCodeFormProps {
  redirectTo: string;
  /** Hasil action terakhir yang gagal di langkah ini. */
  result?: RequestStepResult;
  turnstileSiteKey: string;
}

/** Email belum diketahui (mis. halaman dibuka langsung): isi email → kirim kode. */
export const RequestCodeForm = ({
  redirectTo,
  result,
  turnstileSiteKey,
}: RequestCodeFormProps) => {
  const submitting = useIntentSubmitting(VERIFY_EMAIL_INTENTS.send);
  const errors = result?.fieldErrors;

  return (
    <Form className="flex flex-col gap-5" method="post">
      {result?.formError ? <FormMessage>{result.formError}</FormMessage> : null}
      <input
        name={INTENT_FIELD}
        type="hidden"
        value={VERIFY_EMAIL_INTENTS.send}
      />
      <input name={REDIRECT_PARAM} type="hidden" value={redirectTo} />
      <TextField
        autoComplete="email"
        defaultValue={result?.values.email}
        error={errors?.email}
        inputMode="email"
        label="Email"
        name="email"
        placeholder="nama@contoh.com"
        required
        type="email"
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
        {submitting ? "Mengirim kode…" : "Kirim kode verifikasi"}
      </Button>
    </Form>
  );
};
