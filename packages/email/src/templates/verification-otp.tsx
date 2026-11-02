import { Heading, Text } from "@react-email/components";

import { Layout, styles } from "./layout";

export interface VerificationOtpEmailProps {
  /** Kode OTP dari plugin `emailOTP`. */
  code: string;
  /** Umur kode dalam menit. */
  expiresInMinutes: number;
}

export const verificationOtpSubject = (): string =>
  "Kode verifikasi email trush";

/** Email kode verifikasi alamat (daftar, login sebelum verifikasi, kirim ulang). */
export const VerificationOtpEmail = ({
  code,
  expiresInMinutes,
}: VerificationOtpEmailProps) => (
  <Layout preview={`Kode verifikasi trush: ${code}`}>
    <Heading as="h1" style={styles.heading}>
      Verifikasi email Anda
    </Heading>
    <Text style={styles.text}>
      Masukkan kode berikut di trush untuk memverifikasi alamat email Anda.
    </Text>
    <Text style={styles.code}>{code}</Text>
    <Text style={styles.text}>
      Kode berlaku {expiresInMinutes} menit. Jangan bagikan kode ini kepada
      siapa pun, termasuk pihak yang mengaku dari trush.
    </Text>
    <Text style={styles.text}>
      Bila Anda tidak mendaftar di trush, abaikan email ini.
    </Text>
  </Layout>
);

VerificationOtpEmail.PreviewProps = {
  code: "482913",
  expiresInMinutes: 5,
} satisfies VerificationOtpEmailProps;

export default VerificationOtpEmail;
