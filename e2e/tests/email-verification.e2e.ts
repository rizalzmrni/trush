import { knownEmailIds, readEmailOtp, readResetLink } from "../fixtures/email";
import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUnverifiedUserViaApi, uniqueUser } from "../fixtures/users";

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

test("kirim ulang kode di perangkat lain (tanpa bukti kata sandi) → buat kata sandi lewat tautan", async ({
  homePage,
  page,
  passwordReset,
  signInPage,
  verifyEmailPage,
}) => {
  // Akun dibuat tanpa membawa cookie sign-up ke browser ini, seperti akun
  // yang didaftarkan orang lain dengan email korban (pra-pembajakan, B19).
  const user = await createUnverifiedUserViaApi(uniqueUser("pre-hijack"));
  const newPassword = `${user.password}-milik-korban`;
  await page.goto(
    `/verify-email?${new URLSearchParams({ email: user.email, reason: "sign-up" })}`
  );
  await expect(verifyEmailPage.heading).toBeVisible();
  const beforeResend = await knownEmailIds(user.email);
  await verifyEmailPage.resend();
  await expect(
    verifyEmailPage.notice.filter({ hasText: "kode baru sudah dikirim" })
  ).toBeVisible();
  const beforeVerify = await knownEmailIds(user.email);

  await verifyEmailPage.submitCode(
    await readEmailOtp(user.email, beforeResend)
  );

  await expect(
    verifyEmailPage.notice.filter({ hasText: "untuk membuat kata sandi" })
  ).toBeVisible();
  await expect(page.getByLabel("Kode verifikasi")).toHaveCount(0);

  // Kata sandi pendaftar sudah dicabut.
  await signInPage.goto();
  await signInPage.signIn(user);
  await expect(
    signInPage.formError.filter({ hasText: "Email atau kata sandi salah." })
  ).toBeVisible();

  await page.goto(await readResetLink(user.email, beforeVerify));
  await expect(passwordReset.resetHeading).toBeVisible();
  await passwordReset.setNewPassword(newPassword);
  await expect(signInPage.heading).toBeVisible();
  await signInPage.signIn({ ...user, password: newPassword });
  await expect(page).toHaveURL("/");
  await homePage.expectSignedInAs(user);
});
