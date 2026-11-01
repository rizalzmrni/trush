import { TextField } from "@trush/design-system/components/form/text-field";
import { useEffect, useRef } from "react";

interface CurrentPasswordFieldProps {
  error?: string;
  /** Berubah (hasil action baru) → isian dikosongkan. */
  resetKey?: unknown;
}

/**
 * Kata sandi saat ini untuk step-up setiap kirim kode telepon. Tidak pernah
 * diisi dari server (`defaultValue`) dan dikosongkan setelah setiap hasil
 * action, agar kata sandi tidak tertinggal di DOM setelah gagal.
 */
export const CurrentPasswordField = ({
  error,
  resetKey,
}: CurrentPasswordFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (resetKey !== undefined && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [resetKey]);

  return (
    <TextField
      autoComplete="current-password"
      description="Untuk memastikan perubahan nomor dilakukan oleh kamu."
      error={error}
      label="Kata sandi saat ini"
      name="currentPassword"
      ref={inputRef}
      required
      type="password"
    />
  );
};
