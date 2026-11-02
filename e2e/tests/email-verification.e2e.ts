import { knownEmailIds, readEmailOtp } from "../fixtures/email";
import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUnverifiedUserViaApi } from "../fixtures/users";

test.use({ storageState: NO_SESSION });

test("login sebelum verifikasi → halaman kode dengan kode baru, lalu bisa masuk", async ({
  homePage,
  page,
  signInPage,
  verifyEmailPage,
}) => {
  const user = await createUnverifiedUserViaApi();
  const before = await knownEmailIds(user.email);
  await signInPage.goto("/settings/phone");
  await signInPage.signIn(user);

  await expect(page).toHaveURL(/\/verify-email\?.*reason=sign-in/u);
  await expect(
    verifyEmailPage.notice.filter({ hasText: "belum diverifikasi" })
  ).toBeVisible();
  // Server mengirim kode baru saat login ditolak.
  await verifyEmailPage.submitCode(await readEmailOtp(user.email, before));

  await expect(signInPage.heading).toBeVisible();
  await signInPage.signIn(user);
  await expect(page).toHaveURL("/settings/phone");
  await page.goto("/");
  await homePage.expectSignedInAs(user);
});

test("kirim ulang kode: kode lama tetap bisa diganti kode terbaru", async ({
  page,
  signInPage,
  verifyEmailPage,
}) => {
  const user = await createUnverifiedUserViaApi();
  await page.goto(
    `/verify-email?${new URLSearchParams({ email: user.email, reason: "sign-up" })}`
  );
  await expect(verifyEmailPage.heading).toBeVisible();
  const before = await knownEmailIds(user.email);

  await verifyEmailPage.resend();

  await expect(
    verifyEmailPage.notice.filter({ hasText: "kode baru sudah dikirim" })
  ).toBeVisible();
  await verifyEmailPage.submitCode(await readEmailOtp(user.email, before));
  await expect(signInPage.heading).toBeVisible();
});
