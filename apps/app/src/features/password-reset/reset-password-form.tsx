import { PASSWORD_MIN_LENGTH } from "@trush/core/schemas/auth";
import { FormMessage } from "@trush/design-system/components/form/form-message";
import { TextField } from "@trush/design-system/components/form/text-field";
import { Button } from "@trush/design-system/components/ui/button";
import { Form, useNavigation } from "react-router";

import type { ResetPasswordResult } from "./form-schema";

interface ResetPasswordFormProps {
  /** Hasil action terakhir yang gagal (bukan token tidak sah). */
  result?: Extract<ResetPasswordResult, { status: "error" }>;
  /** Token dari tautan email; dikirim ulang sebagai field tersembunyi. */
  token: string;
}

/** Kata sandi baru; sukses → action mengarahkan ke `/sign-in`. */
export const ResetPasswordForm = ({
  result,
  token,
}: ResetPasswordFormProps) => {
  const navigation = useNavigation();
  const submitting =
    navigation.state !== "idle" && navigation.formMethod === "POST";

  return (
    <Form className="flex flex-col gap-5" method="post">
      {result?.formError ? <FormMessage>{result.formError}</FormMessage> : null}
      <input name="token" type="hidden" value={token} />
      <TextField
        autoComplete="new-password"
        description={`Minimal ${PASSWORD_MIN_LENGTH} karakter. Semua sesi yang masih aktif akan diakhiri.`}
        error={result?.fieldErrors?.newPassword}
        label="Kata sandi baru"
        minLength={PASSWORD_MIN_LENGTH}
        name="newPassword"
        required
        type="password"
      />
      <Button
        aria-busy={submitting}
        disabled={submitting}
        size="lg"
        type="submit"
      >
        {submitting ? "Menyimpan…" : "Simpan kata sandi baru"}
      </Button>
    </Form>
  );
};
