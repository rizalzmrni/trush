import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { theme } from "../theme";
import { PasswordResetEmail, passwordResetSubject } from "./password-reset";

const { PreviewProps } = PasswordResetEmail;

// Tautan palsu.
const URL_WITH_QUERY =
  "http://localhost:8787/api/auth/reset-password/tok-palsu?callbackURL=http%3A%2F%2Flocalhost%3A5174%2Freset-password&x=1";

describe(PasswordResetEmail, () => {
  it("PreviewProps memakai tautan contoh lokal", () => {
    expect(new URL(PreviewProps.url).hostname).toBe("localhost");
    expect(PreviewProps.expiresInMinutes).toBeGreaterThan(0);
  });

  it("render HTML dengan PreviewProps: tombol + tautan, umur, warna tema", async () => {
    const html = await render(<PasswordResetEmail {...PreviewProps} />);

    expect(html).toMatch(/^<!DOCTYPE html/u);
    expect(html).toContain('lang="id"');
    // React menyisipkan `<!-- -->` di antara nilai dan teks di sekitarnya.
    expect(html).toMatch(
      new RegExp(`${PreviewProps.expiresInMinutes}(?:<!-- -->)? menit`, "u")
    );
    expect(html).toContain(theme.color.primary);
    expect(html).not.toMatch(/undefined|NaN|oklch|var\(--/u);
  });

  it("href tombol dan tautan = url dari props (query di-escape HTML)", async () => {
    const html = await render(
      <PasswordResetEmail expiresInMinutes={30} url={URL_WITH_QUERY} />
    );
    const escaped = URL_WITH_QUERY.replaceAll("&", "&amp;");

    expect(html.split(`href="${escaped}"`)).toHaveLength(3);
  });

  it("teks polos memuat tautan utuh dan umur", async () => {
    const text = await render(
      <PasswordResetEmail expiresInMinutes={30} url={URL_WITH_QUERY} />,
      { plainText: true }
    );

    expect(text).toContain(URL_WITH_QUERY);
    expect(text).toContain("30 menit");
  });

  it("url berbahaya tidak keluar dari atribut href", async () => {
    const html = await render(
      <PasswordResetEmail
        expiresInMinutes={30}
        url='http://localhost/"><script>alert(1)<\/script>'
      />
    );

    expect(html).not.toContain("<script>");
  });

  it("subjek", () => {
    expect(passwordResetSubject()).toBe("Atur ulang kata sandi trush");
  });
});
