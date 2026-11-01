import { FormMessage } from "@trush/design-system/components/form/form-message";
import { TextField } from "@trush/design-system/components/form/text-field";
import { Button } from "@trush/design-system/components/ui/button";
import { Form, useNavigation } from "react-router";

import type {
  AuthActionResult,
  SignInForm as SignInFields,
} from "../form-schema";
import { REDIRECT_PARAM } from "../safe-redirect";
import { Turnstile } from "./turnstile";

interface SignInFormProps {
  /** Hasil action terakhir (gagal); kosong pada kunjungan pertama. */
  result?: AuthActionResult<SignInFields>;
  redirectTo: string;
  turnstileSiteKey: string;
}

/** Form login email + kata sandi; dikirim ke action `/sign-in`. */
export const SignInForm = ({
  redirectTo,
  result,
  turnstileSiteKey,
}: SignInFormProps) => {
  const navigation = useNavigation();
  const submitting =
    navigation.state !== "idle" && navigation.formMethod === "POST";
  const errors = result?.fieldErrors;

  return (
    <Form className="flex flex-col gap-5" method="post">
      {result?.formError ? <FormMessage>{result.formError}</FormMessage> : null}
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
      <TextField
        autoComplete="current-password"
        error={errors?.password}
        label="Kata sandi"
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
        {submitting ? "Memproses…" : "Masuk"}
      </Button>
    </Form>
  );
};
