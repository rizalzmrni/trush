import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUserViaApi } from "../fixtures/users";

test.describe("tanpa sesi", () => {
  test.use({ storageState: NO_SESSION });

  test("login email + kata sandi masuk ke beranda", async ({
    homePage,
    page,
    signInPage,
  }) => {
    const user = await createUserViaApi();
    await signInPage.goto();
    await signInPage.signIn(user);

    await expect(page).toHaveURL("/");
    await homePage.expectSignedInAs(user);
  });

  test("kata sandi salah ditolak tanpa membuat sesi", async ({
    page,
    signInPage,
  }) => {
    const user = await createUserViaApi();
    await signInPage.goto();
    await signInPage.signIn({ ...user, password: `${user.password}-salah` });

    await expect(
      signInPage.formError.filter({ hasText: "Email atau kata sandi salah." })
    ).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/u);
  });
});

test("pengguna yang sudah login dialihkan dari halaman masuk", async ({
  homePage,
  page,
}) => {
  await page.goto("/sign-in");

  await expect(page).toHaveURL("/");
  await expect(homePage.heading).toBeVisible();
});
