import {
  readOtpFromOutbox,
  toLocalFormat,
  uniquePhoneNumber,
} from "../fixtures/phone";
import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUserViaApi } from "../fixtures/users";

// Alur tambah + verifikasi nomor lewat UI `/settings/phone`; kode OTP dibaca
// dari `/__e2e/outbox` (driver memory). Pengguna sendiri karena test ini
// mengubah akun.
test.use({ storageState: NO_SESSION });

const SAVED_NOTICE = "Nomor telepon berhasil diverifikasi dan disimpan.";

/** Ganti digit terakhir agar kode pasti salah. */
const wrongCodeFor = (code: string): string =>
  code.replace(/\d$/u, (digit) => String((Number(digit) + 1) % 10));

test.beforeEach(async ({ homePage, signInPage }) => {
  const user = await createUserViaApi();
  await signInPage.goto();
  await signInPage.signIn(user);
  await homePage.expectSignedInAs(user);
});

test("tambah nomor dari beranda, verifikasi dengan OTP dari outbox", async ({
  page,
  phoneSettings,
}) => {
  const phoneNumber = uniquePhoneNumber();

  await page.getByRole("link", { name: "Kelola nomor telepon" }).click();
  await expect(page).toHaveURL(/\/settings\/phone$/u);
  await expect(phoneSettings.heading).toBeVisible();
  await phoneSettings.expectNoPhone();

  // Format lokal: server menormalkan ke E.164 (penerima di outbox).
  await phoneSettings.sendCode(toLocalFormat(phoneNumber));
  await expect(phoneSettings.notice).toContainText(
    "Kode dikirim lewat WhatsApp"
  );
  const code = await readOtpFromOutbox(phoneNumber);

  await phoneSettings.submitCode(code);

  await expect(phoneSettings.notice).toContainText(SAVED_NOTICE);
  await phoneSettings.expectVerified(phoneNumber);

  // Tersimpan di akun, bukan hanya di hasil action.
  await phoneSettings.goto();
  await phoneSettings.expectVerified(phoneNumber);
  await expect(
    page.getByRole("heading", { name: "Ganti nomor telepon" })
  ).toBeVisible();
});

test("kode salah ditolak dan nomor tidak tersimpan", async ({
  phoneSettings,
}) => {
  const phoneNumber = uniquePhoneNumber();
  await phoneSettings.goto();
  await phoneSettings.sendCode(phoneNumber);
  const code = await readOtpFromOutbox(phoneNumber);

  await phoneSettings.submitCode(wrongCodeFor(code));

  await expect(phoneSettings.formError).toContainText("Kode salah");
  await expect(phoneSettings.verifyHeading).toBeVisible();
  await phoneSettings.goto();
  await phoneSettings.expectNoPhone();
});

test("kirim ulang lewat SMS lalu verifikasi dengan kode terbaru", async ({
  phoneSettings,
}) => {
  const phoneNumber = uniquePhoneNumber();
  await phoneSettings.goto();
  await phoneSettings.sendCode(phoneNumber);
  await expect(phoneSettings.notice).toContainText("WhatsApp");

  await phoneSettings.resendViaSms();
  // Tunggu action kirim ulang selesai sebelum membaca outbox (kode baru).
  await expect(phoneSettings.notice).toContainText(
    `Kode dikirim lewat SMS ke ${phoneNumber}.`
  );
  const code = await readOtpFromOutbox(phoneNumber);

  await phoneSettings.submitCode(code);

  await expect(phoneSettings.notice).toContainText(SAVED_NOTICE);
  await phoneSettings.expectVerified(phoneNumber);
});
