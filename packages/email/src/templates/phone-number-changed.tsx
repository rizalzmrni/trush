import { Heading, Text } from "@react-email/components";

import { Layout, styles } from "./layout";

export interface PhoneNumberChangedEmailProps {
  /** Nomor baru yang sudah disamarkan, mis. `+62812****7890`. */
  maskedPhoneNumber: string;
  /** Waktu perubahan, sudah diformat untuk pembaca (WIB). */
  changedAt: string;
}

export const phoneNumberChangedSubject = (): string =>
  "Nomor telepon akun trush diubah";

/** Notifikasi keamanan setelah nomor telepon akun ditambah atau diganti. */
export const PhoneNumberChangedEmail = ({
  changedAt,
  maskedPhoneNumber,
}: PhoneNumberChangedEmailProps) => (
  <Layout preview="Nomor telepon akun trush Anda baru saja diubah">
    <Heading as="h1" style={styles.heading}>
      Nomor telepon diubah
    </Heading>
    <Text style={styles.text}>
      Nomor telepon akun trush Anda diubah menjadi {maskedPhoneNumber} pada{" "}
      {changedAt}. Demi keamanan, semua sesi lain telah dikeluarkan.
    </Text>
    <Text style={styles.warning}>Bukan Anda?</Text>
    <Text style={styles.text}>
      Segera atur ulang kata sandi lewat halaman &ldquo;Lupa kata sandi&rdquo;
      di trush, lalu periksa nomor telepon di pengaturan akun.
    </Text>
  </Layout>
);

PhoneNumberChangedEmail.PreviewProps = {
  changedAt: "2 November 2026 pukul 14.05 WIB",
  maskedPhoneNumber: "+62812****7890",
} satisfies PhoneNumberChangedEmailProps;

export default PhoneNumberChangedEmail;
