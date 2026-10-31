import { describe, expect, it } from "vitest";
import { z } from "zod";

import { meOrganizationsResponseSchema, meResponseSchema } from "./me";

const DATE = "2026-10-31T09:00:00.000Z";

const validMe = {
  session: { expiresAt: DATE, id: "019a3b7c-3f40-7152-8c6d-7e8f9a0b1c2d" },
  user: {
    createdAt: DATE,
    displayUsername: null,
    email: "budi@example.com",
    emailVerified: false,
    id: "019a3b7c-1d2e-7f30-8a4b-5c6d7e8f9a0b",
    image: null,
    name: "Budi",
    role: null,
    twoFactorEnabled: false,
    username: null,
  },
};

const validOrg = {
  createdAt: DATE,
  id: "019a3b7c-2e3f-7041-9b5c-6d7e8f9a0b1c",
  logo: null,
  name: "Toko Budi",
  role: "owner",
  slug: "toko-budi",
};

describe("skema MeResponse", () => {
  it("menerima response valid", () => {
    expect(meResponseSchema.parse(validMe)).toStrictEqual(validMe);
  });

  it("menerima field opsional plugin yang terisi", () => {
    const filled = {
      ...validMe,
      user: {
        ...validMe.user,
        displayUsername: "Budi_S",
        image: "https://cdn.example.test/budi.png",
        role: "admin",
        twoFactorEnabled: true,
        username: "budi_s",
      },
    };

    expect(meResponseSchema.safeParse(filled).success).toBeTruthy();
  });

  it("membuang token sesi bila ikut terkirim", () => {
    const parsed = meResponseSchema.parse({
      ...validMe,
      session: { ...validMe.session, token: "token-palsu-rahasia" },
    });

    expect(parsed.session).not.toHaveProperty("token");
  });

  it.each([
    ["email salah", { user: { ...validMe.user, email: "bukan-email" } }],
    [
      "createdAt non-ISO",
      { user: { ...validMe.user, createdAt: "31/10/2026" } },
    ],
    [
      "createdAt tanpa zona",
      { user: { ...validMe.user, createdAt: "2026-10-31 09:00:00" } },
    ],
    [
      "expiresAt non-ISO",
      { session: { ...validMe.session, expiresAt: "besok" } },
    ],
    ["id user kosong", { user: { ...validMe.user, id: "" } }],
    ["id sesi kosong", { session: { ...validMe.session, id: "" } }],
    [
      "emailVerified bukan boolean",
      { user: { ...validMe.user, emailVerified: "false" } },
    ],
    [
      "twoFactorEnabled null",
      { user: { ...validMe.user, twoFactorEnabled: null } },
    ],
    ["image undefined", { user: { ...validMe.user, image: undefined } }],
  ])("menolak %s", (_label, override) => {
    expect(
      meResponseSchema.safeParse({ ...validMe, ...override }).success
    ).toBeFalsy();
  });

  it("menolak tanpa session", () => {
    const { session: _omitted, ...rest } = validMe;

    expect(meResponseSchema.safeParse(rest).success).toBeFalsy();
  });

  it("terdaftar dengan id MeResponse dan contohnya valid", () => {
    const meta = z.globalRegistry.get(meResponseSchema);

    expect(meta).toMatchObject({ id: "MeResponse" });
    expect(meResponseSchema.safeParse(meta?.example).success).toBeTruthy();
  });
});

describe("skema MeOrganizationsResponse", () => {
  it("menerima daftar kosong", () => {
    expect(
      meOrganizationsResponseSchema.parse({ organizations: [] })
    ).toStrictEqual({ organizations: [] });
  });

  it("menerima organisasi valid", () => {
    const value = {
      organizations: [validOrg, { ...validOrg, logo: "https://x.test/l.png" }],
    };

    expect(meOrganizationsResponseSchema.parse(value)).toStrictEqual(value);
  });

  it.each([
    ["createdAt non-ISO", { createdAt: "kemarin" }],
    ["slug kosong", { slug: "" }],
    ["role kosong", { role: "" }],
    ["id kosong", { id: "" }],
    ["logo undefined", { logo: undefined }],
  ])("menolak organisasi dengan %s", (_label, override) => {
    expect(
      meOrganizationsResponseSchema.safeParse({
        organizations: [{ ...validOrg, ...override }],
      }).success
    ).toBeFalsy();
  });

  it("menolak bila organizations bukan array", () => {
    expect(
      meOrganizationsResponseSchema.safeParse({ organizations: validOrg })
        .success
    ).toBeFalsy();
  });

  it("terdaftar dengan id MeOrganizationsResponse dan contohnya valid", () => {
    const meta = z.globalRegistry.get(meOrganizationsResponseSchema);

    expect(meta).toMatchObject({ id: "MeOrganizationsResponse" });
    expect(
      meOrganizationsResponseSchema.safeParse(meta?.example).success
    ).toBeTruthy();
  });
});
