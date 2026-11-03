import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { theme } from "../theme";
import {
  PhoneNumberChangedEmail,
  phoneNumberChangedSubject,
} from "./phone-number-changed";

const { PreviewProps } = PhoneNumberChangedEmail;

describe(PhoneNumberChangedEmail, () => {
  it("PreviewProps memakai nomor tersamar", () => {
    expect(PreviewProps.maskedPhoneNumber).toContain("****");
    expect(PreviewProps.changedAt).toContain("WIB");
  });

  it("render HTML dengan PreviewProps: nomor, waktu, peringatan destructive", async () => {
    const html = await render(<PhoneNumberChangedEmail {...PreviewProps} />);

    expect(html).toMatch(/^<!DOCTYPE html/u);
    expect(html).toContain('lang="id"');
    expect(html).toContain(PreviewProps.maskedPhoneNumber);
    expect(html).toContain(PreviewProps.changedAt);
    expect(html).toContain(theme.color.destructive);
  });

  it("HTML tanpa nilai kosong maupun warna yang tak didukung klien email", async () => {
    const html = await render(<PhoneNumberChangedEmail {...PreviewProps} />);

    expect(html).not.toMatch(/undefined|NaN|oklch|var\(--/u);
  });

  it("teks polos memuat nomor dan waktu dari props + arahan lupa kata sandi", async () => {
    const text = await render(
      <PhoneNumberChangedEmail
        changedAt="1 Januari 2027 pukul 03.30 WIB"
        maskedPhoneNumber="+62813****1111"
      />,
      { plainText: true }
    );

    expect(text).toContain("+62813****1111");
    expect(text).toContain("1 Januari 2027 pukul 03.30 WIB");
    expect(text).toContain("Lupa kata sandi");
  });

  it("props di-escape (tanpa HTML mentah)", async () => {
    const html = await render(
      <PhoneNumberChangedEmail
        changedAt="<b>sekarang</b>"
        maskedPhoneNumber="<img src=x onerror=alert(1)>"
      />
    );

    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>sekarang</b>");
  });

  it("subjek tidak memuat nomor", () => {
    expect(phoneNumberChangedSubject()).toBe("Nomor telepon akun trush diubah");
  });
});
