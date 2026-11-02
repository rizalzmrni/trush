import { Button, Heading, Link, Text } from "@react-email/components";

import { Layout, styles } from "./layout";

export interface PasswordResetEmailProps {
  /** Tautan reset dari better-auth (`/api/auth/reset-password/<token>?callbackURL=…`). */
  url: string;
  /** Umur tautan dalam menit. */
  expiresInMinutes: number;
}

export const passwordResetSubject = (): string => "Atur ulang kata sandi trush";

/** Email tautan reset password (`/request-password-reset`). */
export const PasswordResetEmail = ({
  expiresInMinutes,
  url,
}: PasswordResetEmailProps) => (
  <Layout preview="Tautan untuk mengatur ulang kata sandi trush Anda">
    <Heading as="h1" style={styles.heading}>
      Atur ulang kata sandi
    </Heading>
    <Text style={styles.text}>
      Kami menerima permintaan untuk mengatur ulang kata sandi akun trush Anda.
      Tekan tombol di bawah untuk membuat kata sandi baru.
    </Text>
    <Button href={url} style={styles.button}>
      Atur ulang kata sandi
    </Button>
    <Text style={{ ...styles.text, marginTop: 24 }}>
      Atau buka tautan ini di peramban:{" "}
      <Link href={url} style={styles.link}>
        {url}
      </Link>
    </Text>
    <Text style={styles.text}>
      Tautan berlaku {expiresInMinutes} menit dan hanya bisa dipakai sekali.
      Setelah kata sandi diganti, semua sesi yang sedang masuk akan keluar.
    </Text>
    <Text style={styles.text}>
      Bila Anda tidak meminta ini, abaikan email ini; kata sandi Anda tidak
      berubah.
    </Text>
  </Layout>
);

PasswordResetEmail.PreviewProps = {
  expiresInMinutes: 60,
  url: "http://localhost:8787/api/auth/reset-password/contoh-token-palsu?callbackURL=http%3A%2F%2Flocalhost%3A5174%2Freset-password",
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
