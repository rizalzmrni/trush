import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { theme } from "../theme";
import {
  VerificationOtpEmail,
  verificationOtpSubject,
} from "./verification-otp";

const { PreviewProps } = VerificationOtpEmail;

describe(VerificationOtpEmail, () => {
  it("PreviewProps memakai data contoh (kode 6 digit)", () => {
    expect(PreviewProps.code).toMatch(/^\d{6}$/u);
    expect(PreviewProps.expiresInMinutes).toBeGreaterThan(0);
  });

  it("render HTML dengan PreviewProps: bahasa id, kode, umur, warna tema", async () => {
    const html = await render(<VerificationOtpEmail {...PreviewProps} />);

    expect(html).toMatch(/^<!DOCTYPE html/u);
    expect(html).toContain('lang="id"');
    expect(html).toContain(PreviewProps.code);
    expect(html).toContain(`${PreviewProps.expiresInMinutes}`);
    expect(html).toContain(theme.color.foreground);
  });

  it("HTML tanpa nilai kosong maupun warna yang tak didukung klien email", async () => {
    const html = await render(<VerificationOtpEmail {...PreviewProps} />);

    expect(html).not.toMatch(/undefined|NaN|oklch|var\(--/u);
  });

  it("teks polos memuat kode dan umur dari props", async () => {
    const text = await render(
      <VerificationOtpEmail code="135790" expiresInMinutes={10} />,
      { plainText: true }
    );

    expect(text).toContain("135790");
    expect(text).toContain("10 menit");
    expect(text).not.toContain(PreviewProps.code);
  });

  it("pratinjau kotak masuk memuat kode", async () => {
    const html = await render(
      <VerificationOtpEmail code="135790" expiresInMinutes={10} />
    );

    expect(html).toContain("Kode verifikasi trush: 135790");
  });

  it("subjek tidak memuat kode", () => {
    expect(verificationOtpSubject()).toBe("Kode verifikasi email trush");
  });
});
