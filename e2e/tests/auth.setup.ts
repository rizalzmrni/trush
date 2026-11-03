import { expectCaptchaReady } from "../fixtures/auth-pages";
import { readEmailOtp } from "../fixtures/email";
import { STORAGE_STATE } from "../fixtures/storage-state";
import { expect, test as setup } from "../fixtures/test";
import { uniqueUser } from "../fixtures/users";

// Satu pengguna untuk test yang hanya butuh sesi aktif. Test yang mengubah
// sesi/akun (logout, telepon) membuat penggunanya sendiri.
setup(
  "daftar pengguna bersama lewat UI, verifikasi email, login, simpan sesi",
  async ({ homePage, page, signInPage, signUpPage, verifyEmailPage }) => {
    // Pemanasan: kunjungan pertama memicu transformasi modul Vite (cold
    // start CI). Halaman auth dimuat sampai ter-hydrate sebelum alur diuji,
    // sehingga test berikutnya tidak menanggung kompilasi awal.
    await signInPage.goto();
    await expectCaptchaReady(page);

    const user = uniqueUser("shared");
    await signUpPage.goto();
    await signUpPage.signUp(user);
    await expect(verifyEmailPage.heading).toBeVisible();
    await verifyEmailPage.submitCode(await readEmailOtp(user.email));
    await expect(signInPage.heading).toBeVisible();
    await signInPage.signIn(user);
    await page.waitForURL("/");
    await homePage.expectSignedInAs(user);
    await page.context().storageState({ path: STORAGE_STATE });
  }
);
