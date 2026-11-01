import {
  readOtpFromOutbox,
  toLocalFormat,
  uniquePhoneNumber,
} from "../fixtures/phone";
import type { PhoneSettingsPage } from "../fixtures/phone";
import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUserViaApi } from "../fixtures/users";
import type { TestUser } from "../fixtures/users";

// Alur tambah + ganti nomor lewat UI `/settings/phone`; setiap kirim kode
// wajib kata sandi saat ini (step-up B11). Kode OTP dibaca dari
// `/__e2e/outbox` (driver memory). Pengguna sendiri karena test ini mengubah
// akun.
test.use({ storageState: NO_SESSION });

const SAVED_NOTICE = "Nomor telepon berhasil diverifikasi dan disimpan.";

/** Ganti digit terakhir agar kode pasti salah. */
const wrongCodeFor = (code: string): string =>
  code.replace(/\d$/u, (digit) => String((Number(digit) + 1) % 10));

// Satu pengguna per test; `beforeEach` dan test berjalan di worker yang sama.
let user: TestUser;

test.beforeEach(async ({ homePage, signInPage }) => {
  user = await createUserViaApi();
  await signInPage.goto();
  await signInPage.signIn(user);
  await homePage.expectSignedInAs(user);
});

/** Kirim kode dengan kata sandi, verifikasi, dan pastikan tersimpan. */
const addVerifiedNumber = async (
  phoneSettings: PhoneSettingsPage,
  phoneNumber: string,
  typed: string = phoneNumber
): Promise<void> => {
  await phoneSettings.sendCode(typed, user.password);
  await expect(phoneSettings.notice).toContainText("Kode dikirim lewat");
  const code = await readOtpFromOutbox(phoneNumber);
  await phoneSettings.submitCode(code);
  await expect(phoneSettings.notice).toContainText(SAVED_NOTICE);
  await phoneSettings.expectVerified(phoneNumber);
};

test("tambah nomor dari beranda dengan kata sandi, verifikasi OTP dari outbox", async ({
  page,
  phoneSettings,
}) => {
  const phoneNumber = uniquePhoneNumber();

  await page.getByRole("link", { name: "Kelola nomor telepon" }).click();
  await expect(page).toHaveURL(/\/settings\/phone$/u);
  await expect(phoneSettings.heading).toBeVisible();
  await phoneSettings.expectNoPhone();

  // Format lokal: server menormalkan ke E.164 (penerima di outbox).
  await addVerifiedNumber(
    phoneSettings,
    phoneNumber,
    toLocalFormat(phoneNumber)
  );

  // Tersimpan di akun, bukan hanya di hasil action.
  await phoneSettings.goto();
  await phoneSettings.expectVerified(phoneNumber);
  await expect(
    page.getByRole("heading", { name: "Ganti nomor telepon" })
  ).toBeVisible();
});

test("ganti nomor terverifikasi dengan kata sandi saat ini", async ({
  page,
  phoneSettings,
}) => {
  const first = uniquePhoneNumber();
  const second = uniquePhoneNumber();
  await phoneSettings.goto();
  await addVerifiedNumber(phoneSettings, first);

  await phoneSettings.goto();
  await expect(page.getByLabel("Nomor telepon baru")).toBeVisible();
  await addVerifiedNumber(phoneSettings, second);

  await phoneSettings.goto();
  await phoneSettings.expectVerified(second);
  await expect(page.getByText(first, { exact: true })).toBeHidden();
});

test("kata sandi salah ditolak di field, tanpa masuk langkah verifikasi", async ({
  page,
  phoneSettings,
}) => {
  const phoneNumber = uniquePhoneNumber();
  await phoneSettings.goto();

  await phoneSettings.requestCode(phoneNumber, `${user.password}-salah`);

  const password = page.getByLabel("Kata sandi saat ini");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Kata sandi saat ini salah.")).toBeVisible();
  // Kata sandi tidak diisi ulang dari server.
  await expect(password).toHaveValue("");
  await expect(phoneSettings.verifyHeading).toBeHidden();
  await phoneSettings.goto();
  await phoneSettings.expectNoPhone();
});

test("kode salah ditolak dan nomor tidak tersimpan", async ({
  phoneSettings,
}) => {
  const phoneNumber = uniquePhoneNumber();
  await phoneSettings.goto();
  await phoneSettings.sendCode(phoneNumber, user.password);
  const code = await readOtpFromOutbox(phoneNumber);

  await phoneSettings.submitCode(wrongCodeFor(code));

  await expect(phoneSettings.formError).toContainText("Kode salah");
  await expect(phoneSettings.verifyHeading).toBeVisible();
  await phoneSettings.goto();
  await phoneSettings.expectNoPhone();
});

test("kirim ulang lewat SMS dengan kata sandi lalu verifikasi kode terbaru", async ({
  phoneSettings,
}) => {
  const phoneNumber = uniquePhoneNumber();
  await phoneSettings.goto();
  await phoneSettings.sendCode(phoneNumber, user.password);
  await expect(phoneSettings.notice).toContainText("WhatsApp");

  await phoneSettings.resendViaSms(user.password);
  // Tunggu action kirim ulang selesai sebelum membaca outbox (kode baru).
  await expect(phoneSettings.notice).toContainText(
    `Kode dikirim lewat SMS ke ${phoneNumber}.`
  );
  const code = await readOtpFromOutbox(phoneNumber);

  await phoneSettings.submitCode(code);

  await expect(phoneSettings.notice).toContainText(SAVED_NOTICE);
  await phoneSettings.expectVerified(phoneNumber);
});
