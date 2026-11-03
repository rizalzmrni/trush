import { FormMessage } from "@trush/design-system/components/form/form-message";
import { TextField } from "@trush/design-system/components/form/text-field";
import { Button } from "@trush/design-system/components/ui/button";
import { Form, useNavigation } from "react-router";

import { Turnstile } from "../auth/forms/turnstile";
import type { ForgotPasswordResult } from "./form-schema";

const sendLabel = (result?: ForgotPasswordResult): string =>
  result?.status === "sent" ? "Kirim ulang tautan" : "Kirim tautan reset";

interface ForgotPasswordFormProps {
  /** Hasil action terakhir; kosong pada kunjungan pertama. */
  result?: ForgotPasswordResult;
  turnstileSiteKey: string;
}

/**
 * Minta tautan reset kata sandi. Setelah terkirim form tetap ada (kirim ulang
 * atau email lain) dengan pesan yang sama untuk email terdaftar maupun tidak.
 */
export const ForgotPasswordForm = ({
  result,
  turnstileSiteKey,
}: ForgotPasswordFormProps) => {
  const navigation = useNavigation();
  const submitting =
    navigation.state !== "idle" && navigation.formMethod === "POST";
  const failed = result?.status === "error" ? result : undefined;
  const errors = failed?.fieldErrors;

  return (
    <Form className="flex flex-col gap-5" method="post">
      {failed?.formError ? <FormMessage>{failed.formError}</FormMessage> : null}
      {result?.status === "sent" ? (
        <FormMessage variant="success">
          Bila {result.email} terdaftar, tautan untuk mengganti kata sandi sudah
          dikirim ke sana. Tautan berlaku sebentar; periksa juga folder spam.
        </FormMessage>
      ) : null}
      <TextField
        autoComplete="email"
        defaultValue={
          result?.status === "sent" ? result.email : failed?.values.email
        }
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
        variant={result?.status === "sent" ? "outline" : "default"}
      >
        {submitting ? "Mengirim…" : sendLabel(result)}
      </Button>
    </Form>
  );
};
