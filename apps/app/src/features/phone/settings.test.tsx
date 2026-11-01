import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import {
  alertTexts,
  fakeTurnstile,
  installFakeTurnstile,
  renderInRouter,
} from "../../testing/auth-forms";
import { TEST_ENV } from "../../testing/cloudflare";
import { INTENT_FIELD, PHONE_INTENTS } from "./form-schema";
import type { PhoneActionResult, VerifyStepResult } from "./form-schema";
import { PhoneSettings } from "./settings";

installFakeTurnstile();

const SITE_KEY = TEST_ENV.VITE_TURNSTILE_SITE_KEY;
const E164 = "+6281234567890";
const LOCAL = "0812-3456-7890";

const VERIFY_RESULT: VerifyStepResult = {
  channel: "whatsapp",
  notice: `Kode dikirim lewat WhatsApp ke ${LOCAL}.`,
  phoneNumber: LOCAL,
  step: "verify",
};

const renderSettings = ({
  phoneNumber = null,
  phoneNumberVerified = false,
  result,
}: {
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean;
  result?: PhoneActionResult;
} = {}) =>
  renderInRouter(
    <PhoneSettings
      phoneNumber={phoneNumber}
      phoneNumberVerified={phoneNumberVerified}
      result={result}
      turnstileSiteKey={SITE_KEY}
    />
  );

/**
 * Router stub dengan action yang menahan submit (state `submitting`) dan
 * mencatat `FormData` yang dikirim.
 */
const renderWithPendingAction = (result?: PhoneActionResult) => {
  const submitted: FormData[] = [];
  const Stub = createRoutesStub([
    {
      action: async ({ request }) => {
        submitted.push(await request.formData());
        // Tidak pernah selesai: navigasi tetap `submitting`.
        return await Promise.withResolvers<never>().promise;
      },
      Component: () => (
        <PhoneSettings
          phoneNumber={null}
          phoneNumberVerified={false}
          result={result}
          turnstileSiteKey={SITE_KEY}
        />
      ),
      path: "/",
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
  return { submitted };
};

const fieldMessage = (input: HTMLElement): string | null | undefined => {
  const describedBy = input.getAttribute("aria-describedby") ?? "";
  return describedBy
    .split(" ")
    .map((id) => document.querySelector(`#${id}`)?.textContent ?? "")
    .join(" ");
};

/** Nama → nilai input tersembunyi dalam satu form. */
const hiddenOf = (form: HTMLFormElement | undefined) =>
  Object.fromEntries(
    [
      ...(form?.querySelectorAll<HTMLInputElement>("input[type=hidden]") ?? []),
    ].map((input) => [input.name, input.value])
  );

describe("PhoneSettings: status nomor", () => {
  it("tanpa nomor → state kosong dan form tambah nomor", async () => {
    renderSettings();

    await expect(
      screen.findByText("Belum ada nomor telepon")
    ).resolves.toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Tambah nomor telepon" })
    ).toBeTruthy();
    expect(screen.getByLabelText("Nomor telepon")).toMatchObject({
      required: true,
      type: "tel",
    });
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("nomor terverifikasi → ditampilkan beserta status, form ganti nomor", async () => {
    renderSettings({ phoneNumber: E164, phoneNumberVerified: true });

    await expect(screen.findByText(E164)).resolves.toBeTruthy();
    expect(screen.getByText("Terverifikasi")).toBeTruthy();
    expect(screen.queryByText("Belum terverifikasi")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Ganti nomor telepon" })
    ).toBeTruthy();
    expect(screen.getByLabelText("Nomor telepon baru")).toBeTruthy();
  });

  it("nomor belum terverifikasi → status belum terverifikasi", async () => {
    renderSettings({ phoneNumber: E164, phoneNumberVerified: false });

    await expect(
      screen.findByText("Belum terverifikasi")
    ).resolves.toBeTruthy();
  });

  it("step done → pesan sukses (status, bukan alert)", async () => {
    renderSettings({
      phoneNumber: E164,
      phoneNumberVerified: true,
      result: { step: "done" },
    });

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain(
      "Nomor telepon berhasil diverifikasi dan disimpan."
    );
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });
});

describe("PhoneSettings: langkah kirim kode", () => {
  it("pilihan kanal berlabel dengan WhatsApp terpilih default", async () => {
    renderSettings();

    const group = await screen.findByRole("radiogroup");
    expect(group.getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByText("Kirim kode lewat")).toBeTruthy();
    expect(
      within(group)
        .getByRole("radio", { name: "WhatsApp" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      within(group)
        .getByRole("radio", { name: "SMS" })
        .getAttribute("aria-checked")
    ).toBe("false");
    expect(screen.getByRole("button", { name: "Kirim kode" })).toBeTruthy();
  });

  it("memasang widget Turnstile dengan site key", async () => {
    renderSettings();

    await waitFor(() => {
      expect(fakeTurnstile.render).toHaveBeenCalledOnce();
    });
    expect(fakeTurnstile.render.mock.calls[0]?.[1]).toMatchObject({
      sitekey: SITE_KEY,
    });
  });

  it("error form & field ditampilkan, nomor dan kanal diisi ulang", async () => {
    renderSettings({
      result: {
        fieldErrors: {
          phoneNumber:
            "Masukkan nomor telepon yang valid, mis. 0812-3456-7890.",
        },
        formError: "Nomor ini sudah dipakai akun lain.",
        step: "send",
        values: { channel: "sms", phoneNumber: "0812" },
      },
    });

    await expect(alertTexts()).resolves.toContain(
      "Nomor ini sudah dipakai akun lain."
    );
    const phone = screen.getByLabelText("Nomor telepon");
    expect(phone).toHaveProperty("value", "0812");
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    expect(fieldMessage(phone)).toContain(
      "Masukkan nomor telepon yang valid, mis. 0812-3456-7890."
    );
    expect(
      screen.getByRole("radio", { name: "SMS" }).getAttribute("aria-checked")
    ).toBe("true");
  });

  it("error captcha ditampilkan sebagai alert", async () => {
    renderSettings({
      result: {
        fieldErrors: {
          captchaToken: "Selesaikan verifikasi keamanan terlebih dahulu.",
        },
        step: "send",
        values: {},
      },
    });

    await expect(alertTexts()).resolves.toContain(
      "Selesaikan verifikasi keamanan terlebih dahulu."
    );
  });

  it("submit → intent send-otp + nomor + kanal terkirim, tombol sibuk", async () => {
    const user = userEvent.setup();
    const { submitted } = renderWithPendingAction();

    await user.type(await screen.findByLabelText("Nomor telepon"), LOCAL);
    await user.click(screen.getByRole("button", { name: "Kirim kode" }));

    const busy = await screen.findByRole("button", { name: "Mengirim kode…" });
    expect(busy).toMatchObject({ disabled: true });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    const [formData] = submitted;
    expect(formData?.get(INTENT_FIELD)).toBe(PHONE_INTENTS.send);
    expect(formData?.get("phoneNumber")).toBe(LOCAL);
    expect(formData?.get("channel")).toBe("whatsapp");
  });
});

describe("PhoneSettings: langkah verifikasi", () => {
  it("judul, notice, dan field kode 6 digit berlabel", async () => {
    renderSettings({ result: VERIFY_RESULT });

    await expect(
      screen.findByRole("heading", { name: "Masukkan kode verifikasi" })
    ).resolves.toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      VERIFY_RESULT.notice
    );
    const code = screen.getByLabelText("Kode verifikasi");
    expect(code).toMatchObject({
      autocomplete: "one-time-code",
      inputMode: "numeric",
      maxLength: 6,
      minLength: 6,
      required: true,
    });
    expect(fieldMessage(code)).toContain(`Kode 6 digit untuk ${LOCAL}.`);
    expect(screen.queryByLabelText("Nomor telepon")).toBeNull();
  });

  it("form verifikasi & kirim ulang membawa nomor; kirim ulang selalu SMS", async () => {
    const { container } = renderSettings({ result: VERIFY_RESULT });

    await screen.findByLabelText("Kode verifikasi");
    const forms = [...container.querySelectorAll("form")];
    expect(forms).toHaveLength(2);
    expect(hiddenOf(forms[0])).toMatchObject({
      channel: "whatsapp",
      [INTENT_FIELD]: PHONE_INTENTS.verify,
      phoneNumber: LOCAL,
    });
    expect(hiddenOf(forms[1])).toMatchObject({
      channel: "sms",
      [INTENT_FIELD]: PHONE_INTENTS.resend,
      phoneNumber: LOCAL,
    });
    expect(
      screen.getByRole("button", { name: "Kirim ulang lewat SMS" })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ganti nomor" }).getAttribute("href")
    ).toBe("/settings/phone");
  });

  it("formError menggantikan notice", async () => {
    renderSettings({
      result: {
        ...VERIFY_RESULT,
        formError: "Kode salah. Periksa lagi lalu coba kembali.",
      },
    });

    await expect(alertTexts()).resolves.toContain(
      "Kode salah. Periksa lagi lalu coba kembali."
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("error field kode terhubung ke input", async () => {
    renderSettings({
      result: {
        ...VERIFY_RESULT,
        fieldErrors: { code: "Masukkan 6 digit kode yang kamu terima." },
        notice: undefined,
      },
    });

    const code = await screen.findByLabelText("Kode verifikasi");
    expect(code.getAttribute("aria-invalid")).toBe("true");
    expect(fieldMessage(code)).toContain(
      "Masukkan 6 digit kode yang kamu terima."
    );
  });

  it("submit kode → hanya tombol verifikasi yang sibuk", async () => {
    const user = userEvent.setup();
    const { submitted } = renderWithPendingAction(VERIFY_RESULT);

    await user.type(await screen.findByLabelText("Kode verifikasi"), "123456");
    await user.click(screen.getByRole("button", { name: "Verifikasi nomor" }));

    await expect(
      screen.findByRole("button", { name: "Memverifikasi…" })
    ).resolves.toMatchObject({ disabled: true });
    expect(
      screen.getByRole("button", { name: "Kirim ulang lewat SMS" })
    ).toMatchObject({ disabled: false });
    expect(submitted[0]?.get(INTENT_FIELD)).toBe(PHONE_INTENTS.verify);
    expect(submitted[0]?.get("code")).toBe("123456");
  });

  it("kirim ulang → hanya tombol kirim ulang yang sibuk", async () => {
    const user = userEvent.setup();
    const { submitted } = renderWithPendingAction(VERIFY_RESULT);

    await user.click(
      await screen.findByRole("button", { name: "Kirim ulang lewat SMS" })
    );

    await expect(
      screen.findByRole("button", { name: "Mengirim ulang…" })
    ).resolves.toMatchObject({ disabled: true });
    expect(
      screen.getByRole("button", { name: "Verifikasi nomor" })
    ).toMatchObject({ disabled: false });
    expect(submitted[0]?.get(INTENT_FIELD)).toBe(PHONE_INTENTS.resend);
    expect(submitted[0]?.get("channel")).toBe("sms");
  });
});
