import type { BrowserContext } from "@playwright/test";

/**
 * Token yang dihasilkan site key uji Turnstile; secret uji `1x…AA` di api
 * menerimanya (docs/auth-plugins.md).
 */
export const TURNSTILE_DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/**
 * Pengganti skrip `challenges.cloudflare.com` di browser: e2e tidak memuat
 * skrip pihak ketiga. API `render` mengikuti mode `explicit` yang dipakai
 * `apps/app`: menyisipkan input tersembunyi berisi token dummy ke container.
 * Verifikasi token di api (siteverify) tetap berjalan di Worker dengan secret
 * uji; Playwright tidak bisa mencegat request keluar Worker.
 */
const STUB_SCRIPT = `
(() => {
  const TOKEN = ${JSON.stringify(TURNSTILE_DUMMY_TOKEN)};
  let counter = 0;
  const widgets = new Map();
  window.turnstile = {
    render(container, options) {
      counter += 1;
      const id = "e2e-turnstile-" + counter;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = options["response-field-name"] || "cf-turnstile-response";
      input.value = TOKEN;
      container.appendChild(input);
      widgets.set(id, input);
      return id;
    },
    reset(id) {
      const input = widgets.get(id);
      if (input) input.value = TOKEN;
    },
    remove(id) {
      widgets.get(id)?.remove();
      widgets.delete(id);
    },
  };
})();
`;

/** Semua request ke Turnstile di context ini dijawab stub lokal. */
export const stubTurnstile = async (context: BrowserContext): Promise<void> => {
  await context.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      body: STUB_SCRIPT,
      contentType: "application/javascript",
      status: 200,
    })
  );
};
