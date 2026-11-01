import { STORAGE_STATE } from "../fixtures/storage-state";
import { test as setup } from "../fixtures/test";
import { uniqueUser } from "../fixtures/users";

// Satu pengguna untuk test yang hanya butuh sesi aktif. Test yang mengubah
// sesi/akun (logout, telepon) membuat penggunanya sendiri.
setup(
  "daftar pengguna bersama lewat UI dan simpan sesi",
  async ({ homePage, page, signUpPage }) => {
    const user = uniqueUser("shared");
    await signUpPage.goto();
    await signUpPage.signUp(user);
    await page.waitForURL("/");
    await homePage.expectSignedInAs(user);
    await page.context().storageState({ path: STORAGE_STATE });
  }
);
