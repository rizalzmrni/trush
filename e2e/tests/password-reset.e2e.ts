import { knownEmailIds, readResetLink } from "../fixtures/email";
import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUserViaApi, uniqueUser } from "../fixtures/users";

test.use({ storageState: NO_SESSION });

test("lupa kata sandi → tautan email → kata sandi baru → login", async ({
  homePage,
  page,
  passwordReset,
  signInPage,
}) => {
  const user = await createUserViaApi(uniqueUser("reset"));
  const newPassword = `${user.password}-baru`;
  const before = await knownEmailIds(user.email);
  await signInPage.goto();
  await page.getByRole("link", { name: "Lupa kata sandi?" }).click();
  await expect(passwordReset.forgotHeading).toBeVisible();

  await passwordReset.requestLink(user.email);
  await expect(
    passwordReset.notice.filter({ hasText: `Bila ${user.email} terdaftar` })
  ).toBeVisible();

  // Tautan api mengalihkan ke /reset-password?token=… di app.
  await page.goto(await readResetLink(user.email, before));
  await expect(page).toHaveURL(/\/reset-password\?token=/u);
  await expect(passwordReset.resetHeading).toBeVisible();
  await passwordReset.setNewPassword(newPassword);

  await expect(page).toHaveURL(/\/sign-in\?notice=password-reset/u);
  await expect(
    page.getByRole("status").filter({ hasText: "Kata sandi berhasil diganti" })
  ).toBeVisible();
  await signInPage.signIn(user);
  await expect(
    signInPage.formError.filter({ hasText: "Email atau kata sandi salah." })
  ).toBeVisible();
  await signInPage.signIn({ ...user, password: newPassword });
  await expect(page).toHaveURL("/");
  await homePage.expectSignedInAs(user);
});

test("email tidak terdaftar: pesan sama, tanpa email terkirim", async ({
  page,
  passwordReset,
}) => {
  const { email } = uniqueUser("unknown");
  await page.goto("/forgot-password");
  await expect(passwordReset.forgotHeading).toBeVisible();

  await passwordReset.requestLink(email);

  await expect(
    passwordReset.notice.filter({ hasText: `Bila ${email} terdaftar` })
  ).toBeVisible();
  await expect(knownEmailIds(email)).resolves.toStrictEqual(new Set());
});

test("tautan reset sekali pakai: dibuka lagi → tautan tidak berlaku", async ({
  page,
  passwordReset,
}) => {
  const user = await createUserViaApi(uniqueUser("reset-once"));
  await page.goto("/forgot-password");
  await passwordReset.requestLink(user.email);
  const link = await readResetLink(user.email);
  await page.goto(link);
  await passwordReset.setNewPassword(`${user.password}-baru`);
  await expect(page).toHaveURL(/\/sign-in/u);

  await page.goto(link);

  await expect(page).toHaveURL(/\/reset-password\?.*error=INVALID_TOKEN/u);
  await expect(
    passwordReset.formError.filter({ hasText: "tidak berlaku" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Minta tautan baru" })
  ).toBeVisible();
});
