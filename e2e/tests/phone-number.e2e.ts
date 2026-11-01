import {
  browserApiFetch,
  readOtpFromOutbox,
  requestPhoneOtp,
  uniquePhoneNumber,
  verifyPhoneOtp,
} from "../fixtures/phone";
import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUserViaApi } from "../fixtures/users";

// UI tambah nomor telepon belum ada di apps/app: alur diuji lewat api dari
// halaman yang sudah login (fetch browser + cookie sesi + token Turnstile).
// Pengguna sendiri karena test ini mengubah akun.
test.use({ storageState: NO_SESSION });

const sessionPhone = async (page: Parameters<typeof browserApiFetch>[0]) => {
  const { body, status } = await browserApiFetch(page, "/api/auth/get-session");
  expect(status).toBe(200);
  const user =
    typeof body === "object" && body !== null && "user" in body
      ? (body.user as Record<string, unknown>)
      : {};
  return {
    phoneNumber: user.phoneNumber ?? null,
    phoneNumberVerified: user.phoneNumberVerified ?? false,
  };
};

test.beforeEach(async ({ homePage, signInPage }) => {
  const user = await createUserViaApi();
  await signInPage.goto();
  await signInPage.signIn(user);
  await homePage.expectSignedInAs(user);
});

test("tambah nomor telepon dan verifikasi dengan OTP dari outbox", async ({
  page,
}) => {
  const phoneNumber = uniquePhoneNumber();

  const sent = await requestPhoneOtp(page, phoneNumber);
  expect(sent.status).toBe(200);
  const code = await readOtpFromOutbox(phoneNumber);

  const verified = await verifyPhoneOtp(page, phoneNumber, code);
  expect(verified.status).toBe(200);
  expect(await sessionPhone(page)).toEqual({
    phoneNumber,
    phoneNumberVerified: true,
  });
});

test("kode OTP salah ditolak dan nomor tidak tersimpan", async ({ page }) => {
  const phoneNumber = uniquePhoneNumber();
  const sent = await requestPhoneOtp(page, phoneNumber);
  expect(sent.status).toBe(200);
  const code = await readOtpFromOutbox(phoneNumber);
  const wrongCode = code.replace(/\d$/u, (digit) =>
    String((Number(digit) + 1) % 10)
  );

  const verified = await verifyPhoneOtp(page, phoneNumber, wrongCode);

  expect(verified.status).toBe(400);
  expect(await sessionPhone(page)).toEqual({
    phoneNumber: null,
    phoneNumberVerified: false,
  });
});
