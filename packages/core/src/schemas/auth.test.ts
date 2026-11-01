import { describe, expect, it } from "vitest";

import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  signInEmailInputSchema,
  signUpEmailInputSchema,
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
