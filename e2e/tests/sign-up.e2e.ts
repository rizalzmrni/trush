import { knownEmailIds, readEmailOtp } from "../fixtures/email";
import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUserViaApi, uniqueUser } from "../fixtures/users";

test.use({ storageState: NO_SESSION });

test("daftar → verifikasi kode email → login → beranda", async ({
  homePage,
  page,
  signInPage,
  signUpPage,
  verifyEmailPage,
}) => {
  const user = uniqueUser("sign-up");
  await signUpPage.goto("/settings/phone");
  await signUpPage.signUp(user);

  // Sign-up tidak membuat sesi: langsung ke halaman kode.
  await expect(page).toHaveURL(/\/verify-email\?/u);
  await expect(verifyEmailPage.heading).toBeVisible();
  await expect(
    verifyEmailPage.notice.filter({ hasText: "Akun berhasil dibuat" })
  ).toBeVisible();

  await verifyEmailPage.submitCode(await readEmailOtp(user.email));

  await expect(page).toHaveURL(/\/sign-in\?.*notice=email-verified/u);
  await expect(
    page.getByRole("status").filter({ hasText: "Email berhasil diverifikasi" })
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(user.email);
  await signInPage.signIn(user);

  await expect(page).toHaveURL("/settings/phone");
  await page.goto("/");
  await homePage.expectSignedInAs(user);
});

test("kode salah ditolak dengan pesan jelas, tetap di halaman kode", async ({
  page,
  signUpPage,
  verifyEmailPage,
}) => {
  const user = uniqueUser("wrong-code");
  await signUpPage.goto();
  await signUpPage.signUp(user);
  await expect(verifyEmailPage.heading).toBeVisible();
  const code = await readEmailOtp(user.email);

  await verifyEmailPage.submitCode(code === "000000" ? "111111" : "000000");

  await expect(
    verifyEmailPage.formError.filter({ hasText: "Kode salah" })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email/u);
});

test("email yang sudah terdaftar: tampilan sama dengan daftar baru, tanpa email baru", async ({
  page,
  signUpPage,
  verifyEmailPage,
}) => {
  const existing = await createUserViaApi(uniqueUser("taken"));
  const before = await knownEmailIds(existing.email);
  await signUpPage.goto();
  await signUpPage.signUp({ ...uniqueUser("taken"), email: existing.email });

  // Tanpa oracle akun: sama persis dengan pendaftaran baru.
  await expect(page).toHaveURL(/\/verify-email\?/u);
  await expect(verifyEmailPage.heading).toBeVisible();
  await expect(knownEmailIds(existing.email)).resolves.toStrictEqual(before);
});
