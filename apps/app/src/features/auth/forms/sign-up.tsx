import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@trush/core/schemas/auth";
import { FormMessage } from "@trush/design-system/components/form/form-message";
import { TextField } from "@trush/design-system/components/form/text-field";
import { Button } from "@trush/design-system/components/ui/button";
import { Form, useNavigation } from "react-router";

import type {
  AuthActionResult,
  SignUpForm as SignUpFields,
} from "../form-schema";
import { REDIRECT_PARAM } from "../safe-redirect";
import { Turnstile } from "./turnstile";

interface SignUpFormProps {
  /** Hasil action terakhir (gagal); kosong pada kunjungan pertama. */
  result?: AuthActionResult<SignUpFields>;
  redirectTo: string;
  turnstileSiteKey: string;
}

/** Form daftar akun (nama, email, kata sandi); dikirim ke action `/sign-up`. */
export const SignUpForm = ({
  redirectTo,
  result,
  turnstileSiteKey,
}: SignUpFormProps) => {
  const navigation = useNavigation();
  const submitting =
    navigation.state !== "idle" && navigation.formMethod === "POST";
  const errors = result?.fieldErrors;

  return (
    <Form className="flex flex-col gap-5" method="post">
      {result?.formError ? <FormMessage>{result.formError}</FormMessage> : null}
      <input name={REDIRECT_PARAM} type="hidden" value={redirectTo} />
      <TextField
        autoComplete="name"
        defaultValue={result?.values.name}
        error={errors?.name}
        label="Nama"
        maxLength={NAME_MAX_LENGTH}
        name="name"
        required
      />
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
      <TextField
        autoComplete="new-password"
        description={`Minimal ${PASSWORD_MIN_LENGTH} karakter.`}
        error={errors?.password}
        label="Kata sandi"
        maxLength={PASSWORD_MAX_LENGTH}
        minLength={PASSWORD_MIN_LENGTH}
        name="password"
        required
        type="password"
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
        {submitting ? "Memproses…" : "Daftar"}
      </Button>
    </Form>
  );
};
