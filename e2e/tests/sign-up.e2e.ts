import { expect, NO_SESSION, test } from "../fixtures/test";
import { createUserViaApi, uniqueUser } from "../fixtures/users";

test.use({ storageState: NO_SESSION });

test("daftar lewat email langsung masuk ke beranda", async ({
  homePage,
  page,
  signUpPage,
}) => {
  const user = uniqueUser("sign-up");
  await signUpPage.goto();
  await signUpPage.signUp(user);

  await expect(page).toHaveURL("/");
  await homePage.expectSignedInAs(user);
});

test("email yang sudah terdaftar ditolak dengan pesan jelas", async ({
  page,
  signUpPage,
}) => {
  const existing = await createUserViaApi(uniqueUser("taken"));
  await signUpPage.goto();
  await signUpPage.signUp({ ...uniqueUser("taken"), email: existing.email });

  await expect(
    signUpPage.formError.filter({
      hasText: "Email ini sudah terdaftar. Silakan masuk.",
    })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sign-up$/u);
});
