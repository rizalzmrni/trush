import { describe, expect, it } from "vitest";

import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PHONE_OTP_LENGTH,
  PHONE_STEP_UP_ERROR_CODES,
  phoneOtpChannelSchema,
  sendPhoneOtpInputSchema,
  signInEmailInputSchema,
  signUpEmailInputSchema,
  verifyPhoneOtpInputSchema,
} from "./auth";

const validSignUp = {
  email: "budi@example.test",
  name: "Budi",
  password: "kata-sandi-palsu",
};

const acceptsName = (name: string): boolean =>
  signUpEmailInputSchema.safeParse({ ...validSignUp, name }).success;

describe("skema SignInEmailInput", () => {
  it("menerima email dan password", () => {
    const input = { email: "budi@example.test", password: "x" };

    expect(signInEmailInputSchema.parse(input)).toStrictEqual(input);
  });

  it.each([
    ["email salah", { email: "bukan-email", password: "x" }],
    ["password kosong", { email: "budi@example.test", password: "" }],
    ["password hilang", { email: "budi@example.test" }],
    ["email hilang", { password: "x" }],
  ])("menolak %s", (_label, input) => {
    expect(signInEmailInputSchema.safeParse(input).success).toBeFalsy();
  });
});

describe("skema SignUpEmailInput", () => {
  it("menerima input valid", () => {
    expect(signUpEmailInputSchema.parse(validSignUp)).toStrictEqual(
      validSignUp
    );
  });

  it("nama di-trim", () => {
    const parsed = signUpEmailInputSchema.parse({
      ...validSignUp,
      name: "  Budi Santoso  ",
    });

    expect(parsed.name).toBe("Budi Santoso");
  });

  it.each([PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH])(
    "password %i karakter diterima (batas)",
    (length) => {
      expect(
        signUpEmailInputSchema.safeParse({
          ...validSignUp,
          password: "a".repeat(length),
        }).success
      ).toBeTruthy();
    }
  );

  it.each([PASSWORD_MIN_LENGTH - 1, PASSWORD_MAX_LENGTH + 1])(
    "password %i karakter ditolak",
    (length) => {
      expect(
        signUpEmailInputSchema.safeParse({
          ...validSignUp,
          password: "a".repeat(length),
        }).success
      ).toBeFalsy();
    }
  );

  it("nama tepat NAME_MAX_LENGTH diterima, lebih ditolak", () => {
    expect(acceptsName("a".repeat(NAME_MAX_LENGTH))).toBeTruthy();
    expect(acceptsName("a".repeat(NAME_MAX_LENGTH + 1))).toBeFalsy();
  });

  it("batas panjang nama dihitung setelah trim", () => {
    const parsed = signUpEmailInputSchema.safeParse({
      ...validSignUp,
      name: ` ${"a".repeat(NAME_MAX_LENGTH)} `,
    });

    expect(parsed.success).toBeTruthy();
  });

  it.each([
    ["nama kosong", { name: "" }],
    ["nama hanya spasi", { name: "   " }],
    ["email salah", { email: "budi@" }],
    ["password bukan string", { password: 12_345_678 }],
  ])("menolak %s", (_label, override) => {
    expect(
      signUpEmailInputSchema.safeParse({ ...validSignUp, ...override }).success
    ).toBeFalsy();
  });

  it("batas password sama dengan default better-auth (8–128)", () => {
    expect([PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH]).toStrictEqual([8, 128]);
  });
});

const PHONE = "+6281234567890";

describe("skema SendPhoneOtpInput", () => {
  it.each([
    ["E.164", "+6281234567890"],
    ["lokal dengan tanda hubung", "0812-3456-7890"],
    ["lokal dengan spasi", "0812 3456 7890"],
    ["E.164 dengan kurung", "+62 (812) 3456-7890"],
    ["8 karakter (batas bawah)", "12345678"],
    ["20 karakter (batas atas)", "1".repeat(20)],
  ])("menerima nomor %s", (_label, phoneNumber) => {
    expect(
      sendPhoneOtpInputSchema.safeParse({ phoneNumber }).success
    ).toBeTruthy();
  });

  it("nomor di-trim", () => {
    const parsed = sendPhoneOtpInputSchema.parse({
      phoneNumber: "  0812-3456-7890  ",
    });

    expect(parsed.phoneNumber).toBe("0812-3456-7890");
  });

  it.each([
    ["kosong", ""],
    ["hanya spasi", "   "],
    ["huruf", "bukan-nomor"],
    ["campur huruf", "0812abc67890"],
    ["7 karakter", "1234567"],
    ["21 karakter", "1".repeat(21)],
    ["plus saja", "+"],
    ["plus ganda", "++6281234567890"],
    ["diakhiri tanda hubung", "0812-3456-789-"],
    ["diawali kurung", "(0812) 3456 7890"],
    ["skrip", "<script>1</script>"],
    ["angka bukan ASCII", "\u0661".repeat(10)],
  ])("menolak nomor %s", (_label, phoneNumber) => {
    expect(
      sendPhoneOtpInputSchema.safeParse({ phoneNumber }).success
    ).toBeFalsy();
  });

  it("menolak tanpa nomor atau nomor bukan string", () => {
    expect(sendPhoneOtpInputSchema.safeParse({}).success).toBeFalsy();
    expect(
      sendPhoneOtpInputSchema.safeParse({ phoneNumber: 6_281_234_567_890 })
        .success
    ).toBeFalsy();
  });

  it("kanal default whatsapp", () => {
    expect(sendPhoneOtpInputSchema.parse({ phoneNumber: PHONE }).channel).toBe(
      "whatsapp"
    );
  });

  it("kanal sms diterima, kanal lain ditolak", () => {
    expect(
      sendPhoneOtpInputSchema.parse({ channel: "sms", phoneNumber: PHONE })
    ).toStrictEqual({ channel: "sms", phoneNumber: PHONE });
    expect(
      sendPhoneOtpInputSchema.safeParse({
        channel: "telegram",
        phoneNumber: PHONE,
      }).success
    ).toBeFalsy();
  });

  it("phoneOtpChannelSchema hanya whatsapp dan sms", () => {
    expect(phoneOtpChannelSchema.options).toStrictEqual(["whatsapp", "sms"]);
    expect(phoneOtpChannelSchema.safeParse("SMS").success).toBeFalsy();
  });
});

describe("skema VerifyPhoneOtpInput", () => {
  it("panjang kode = otpLength default better-auth (6)", () => {
    expect(PHONE_OTP_LENGTH).toBe(6);
  });

  it("menerima kode 6 digit dan men-trim kode serta nomor", () => {
    expect(
      verifyPhoneOtpInputSchema.parse({
        code: " 012345 ",
        phoneNumber: ` ${PHONE} `,
      })
    ).toStrictEqual({ code: "012345", phoneNumber: PHONE });
  });

  it.each([
    ["kosong", ""],
    ["5 digit", "12345"],
    ["7 digit", "1234567"],
    ["berisi huruf", "12a456"],
    ["berisi spasi di tengah", "123 456"],
    ["berisi tanda hubung", "123-456"],
    ["angka bukan ASCII", "\u0661".repeat(PHONE_OTP_LENGTH)],
  ])("menolak kode %s", (_label, code) => {
    expect(
      verifyPhoneOtpInputSchema.safeParse({ code, phoneNumber: PHONE }).success
    ).toBeFalsy();
  });

  it("menolak kode berupa number", () => {
    expect(
      verifyPhoneOtpInputSchema.safeParse({ code: 123_456, phoneNumber: PHONE })
        .success
    ).toBeFalsy();
  });

  it("menolak nomor tidak valid atau hilang", () => {
    expect(
      verifyPhoneOtpInputSchema.safeParse({ code: "123456", phoneNumber: "x" })
        .success
    ).toBeFalsy();
    expect(
      verifyPhoneOtpInputSchema.safeParse({ code: "123456" }).success
    ).toBeFalsy();
  });
});

const acceptsCurrentPasswordOf = (length: number): boolean =>
  sendPhoneOtpInputSchema.safeParse({
    currentPassword: "a".repeat(length),
    phoneNumber: PHONE,
  }).success;

describe("currentPassword di SendPhoneOtpInput (step-up B11)", () => {
  it("opsional di skema (wajibnya ditegakkan server)", () => {
    expect(
      sendPhoneOtpInputSchema.parse({ phoneNumber: PHONE })
    ).not.toHaveProperty("currentPassword");
  });

  it("diteruskan apa adanya, tanpa trim", () => {
    expect(
      sendPhoneOtpInputSchema.parse({
        currentPassword: " sandi dengan spasi ",
        phoneNumber: PHONE,
      }).currentPassword
    ).toBe(" sandi dengan spasi ");
  });

  it("string kosong lolos skema (server memperlakukannya sebagai tidak ada)", () => {
    expect(
      sendPhoneOtpInputSchema.safeParse({
        currentPassword: "",
        phoneNumber: PHONE,
      }).success
    ).toBeTruthy();
  });

  it("panjang maksimal = PASSWORD_MAX_LENGTH", () => {
    expect(acceptsCurrentPasswordOf(PASSWORD_MAX_LENGTH)).toBeTruthy();
    expect(acceptsCurrentPasswordOf(PASSWORD_MAX_LENGTH + 1)).toBeFalsy();
  });

  it("menolak currentPassword bukan string", () => {
    expect(
      sendPhoneOtpInputSchema.safeParse({
        currentPassword: 12_345_678,
        phoneNumber: PHONE,
      }).success
    ).toBeFalsy();
  });

  it("kode error step-up stabil (kontrak app)", () => {
    expect(PHONE_STEP_UP_ERROR_CODES).toStrictEqual({
      invalidPassword: "INVALID_PASSWORD",
      passwordAttemptsLimited: "PASSWORD_ATTEMPTS_LIMITED",
      passwordRequired: "PASSWORD_REQUIRED",
    });
  });
});
