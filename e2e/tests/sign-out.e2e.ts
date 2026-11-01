import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUserViaApi } from "../fixtures/users";

// Pengguna sendiri: logout mencabut sesi di server, jadi sesi bersama dari
// `auth.setup.ts` tidak boleh dipakai di sini.
test.use({ storageState: NO_SESSION });

test("keluar mengakhiri sesi di server dan mengunci halaman terproteksi", async ({
  context,
  homePage,
  page,
  signInPage,
}) => {
  const user = await createUserViaApi();
  await signInPage.goto();
  await signInPage.signIn(user);
  await homePage.expectSignedInAs(user);
  const cookiesBeforeSignOut = await context.cookies();

  await homePage.signOutButton.click();

  await expect(page).toHaveURL("/sign-in");
  await expect(signInPage.heading).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL("/sign-in");

  // Cookie sesi lama yang dipasang ulang tidak lagi berlaku (dicabut di api,
  // bukan hanya dihapus dari browser).
  await context.addCookies(cookiesBeforeSignOut);
  await page.goto("/");
  await expect(page).toHaveURL("/sign-in");
});
