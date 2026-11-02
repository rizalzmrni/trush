import { IconMailForward } from "@tabler/icons-react";
import { FormMessage } from "@trush/design-system/components/form/form-message";
import { buttonVariants } from "@trush/design-system/components/ui/button";
import { Link } from "react-router";

import { FORGOT_PASSWORD_PATH } from "../auth/safe-redirect";

interface PasswordSetupProps {
  email: string;
}

/**
 * Email terverifikasi, tetapi kata sandi dibuat ulang lewat tautan email
 * (`passwordSetupRequired`). Tidak diarahkan ke login: kata sandi lama sudah
 * tidak berlaku; tautan "Masuk" hanya di footer untuk setelah kata sandi dibuat.
 */
export const PasswordSetup = ({ email }: PasswordSetupProps) => (
  <div className="flex flex-col gap-5">
    <FormMessage variant="success">
      Email terverifikasi. Kami mengirim tautan ke{" "}
      <span className="font-medium break-all">{email}</span> untuk membuat kata
      sandi.
    </FormMessage>
    <p className="text-muted-foreground text-sm">
      Buka tautan itu untuk membuat kata sandi, lalu masuk dengan kata sandi
      baru. Tautan hanya berlaku sebentar; periksa juga folder spam.
    </p>
    <Link
      className={buttonVariants({ size: "lg", variant: "outline" })}
      to={FORGOT_PASSWORD_PATH}
    >
      <IconMailForward aria-hidden="true" data-icon="inline-start" />
      Tidak menerima tautan? Minta lagi
    </Link>
  </div>
);
