import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUserViaApi } from "../fixtures/users";

test("halaman terproteksi tampil untuk pengguna dengan sesi", async ({
  homePage,
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL("/");
  await expect(homePage.heading).toBeVisible();
});

test.describe("tanpa sesi", () => {
  test.use({ storageState: NO_SESSION });

  test("dialihkan ke /sign-in?redirectTo=… lalu kembali setelah login", async ({
    homePage,
    page,
    signInPage,
  }) => {
    const user = await createUserViaApi();
    const protectedPath = "/?tab=profil";
    await page.goto(protectedPath);

    await expect(page).toHaveURL(
      `/sign-in?${new URLSearchParams({ redirectTo: protectedPath })}`
    );
    await signInPage.signIn(user);

    await expect(page).toHaveURL(protectedPath);
    await homePage.expectSignedInAs(user);
  });

  test("redirectTo ke host lain diabaikan setelah login", async ({
    homePage,
    page,
    signInPage,
  }) => {
    const user = await createUserViaApi();
    await signInPage.goto("//evil.example/phish");
    await signInPage.signIn(user);

    await expect(page).toHaveURL("/");
    await homePage.expectSignedInAs(user);
  });
});
