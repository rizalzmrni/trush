import { PHONE_OTP_LENGTH } from "@trush/core/schemas/auth";
import { FormMessage } from "@trush/design-system/components/form/form-message";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trush/design-system/components/ui/card";

import type { PhoneActionResult } from "./form-schema";
import { SendOtpForm } from "./forms/send-otp";
import { VerifyOtpForm } from "./forms/verify-otp";
import { PhoneStatus } from "./status";

const formTitle = (verifying: boolean, phoneNumber: string | null): string => {
  if (verifying) {
    return "Masukkan kode verifikasi";
  }
  return phoneNumber ? "Ganti nomor telepon" : "Tambah nomor telepon";
};

interface PhoneSettingsProps {
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  /** Hasil action terakhir; kosong pada kunjungan pertama. */
  result?: PhoneActionResult;
  turnstileSiteKey: string;
}

/**
 * Halaman pengaturan nomor: status nomor, lalu dua langkah (isi nomor →
 * masukkan kode). Langkah ditentukan hasil action, jadi tetap berjalan
 * tanpa JavaScript selain widget Turnstile.
 */
export const PhoneSettings = ({
  phoneNumber,
  phoneNumberVerified,
  result,
  turnstileSiteKey,
}: PhoneSettingsProps) => {
  const verifying = result?.step === "verify";
  return (
    <div className="flex flex-col gap-6">
      {result?.step === "done" ? (
        <FormMessage variant="success">
          Nomor telepon berhasil diverifikasi dan disimpan.
        </FormMessage>
      ) : null}
      <PhoneStatus
        phoneNumber={phoneNumber}
        phoneNumberVerified={phoneNumberVerified}
      />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold" id="phone-form-heading">
              {formTitle(verifying, phoneNumber)}
            </h2>
          </CardTitle>
          <CardDescription>
            {verifying
              ? "Nomor baru tersimpan setelah kode benar."
              : `Konfirmasi dengan kata sandi saat ini, lalu kami kirim kode ${PHONE_OTP_LENGTH} digit untuk memastikan nomor ini milikmu.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verifying ? (
            <VerifyOtpForm
              result={result}
              turnstileSiteKey={turnstileSiteKey}
            />
          ) : (
            <SendOtpForm
              hasPhone={Boolean(phoneNumber)}
              result={result?.step === "send" ? result : undefined}
              turnstileSiteKey={turnstileSiteKey}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
