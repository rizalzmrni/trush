import type { AuthSession } from "@trush/auth";
import {
  meOrganizationsResponseSchema,
  meResponseSchema,
} from "@trush/core/schemas/me";
import { createTestDb } from "@trush/db/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  FIXTURE_DATE,
  insertMember,
  insertOrganization,
  insertUser,
} from "../testing/db-fixtures";
import { listUserOrganizations, toMeResponse } from "./me";

type TestDbHandle = Awaited<ReturnType<typeof createTestDb>>;

const FAKE_TOKEN = "token-sesi-palsu-yang-tidak-boleh-bocor";

const makeAuthSession = (
  overrides: { user?: Partial<AuthSession["user"]> } = {}
): AuthSession => ({
  session: {
    activeOrganizationId: null,
    createdAt: FIXTURE_DATE,
    expiresAt: new Date("2026-11-07T09:00:00.000Z"),
    id: "019a3b7c-3f40-7152-8c6d-7e8f9a0b1c2d",
    impersonatedBy: null,
    ipAddress: "203.0.113.1",
    token: FAKE_TOKEN,
    updatedAt: FIXTURE_DATE,
    userAgent: "vitest",
    userId: "019a3b7c-1d2e-7f30-8a4b-5c6d7e8f9a0b",
  },
  user: {
    banExpires: null,
    banReason: null,
    banned: false,
    createdAt: FIXTURE_DATE,
    displayUsername: null,
    email: "budi@example.test",
    emailVerified: false,
    id: "019a3b7c-1d2e-7f30-8a4b-5c6d7e8f9a0b",
    image: null,
    name: "Budi",
    role: null,
    twoFactorEnabled: false,
    updatedAt: FIXTURE_DATE,
    username: null,
    ...overrides.user,
  },
});

describe(listUserOrganizations, () => {
  let handle: TestDbHandle;

  beforeEach(async () => {
    handle = await createTestDb();
  });

  afterEach(async () => {
    await handle.close();
  });

  it("[] untuk user tanpa organisasi", async () => {
    const userId = await insertUser(handle.db);

    await expect(
      listUserOrganizations(handle.db, userId)
    ).resolves.toStrictEqual({ organizations: [] });
  });

  it("[] untuk userId yang tidak ada", async () => {
    await expect(
      listUserOrganizations(handle.db, "019a3b7c-0000-7000-8000-000000000000")
    ).resolves.toStrictEqual({ organizations: [] });
  });

  it("hanya organisasi milik userId, urut nama, dengan role masing-masing", async () => {
    const { db } = handle;
    const budi = await insertUser(db);
    const sari = await insertUser(db);
    const zebra = await insertOrganization(db, "Zebra Mart");
    const alpha = await insertOrganization(db, "Alpha Toko", {
      logo: "https://cdn.example.test/alpha.png",
    });
    const milikSari = await insertOrganization(db, "Milik Sari");
    await insertMember(db, {
      organizationId: zebra,
      role: "member",
      userId: budi,
    });
    await insertMember(db, {
      organizationId: alpha,
      role: "owner",
      userId: budi,
    });
    await insertMember(db, {
      organizationId: milikSari,
      role: "owner",
      userId: sari,
    });
    await insertMember(db, {
      organizationId: alpha,
      role: "admin",
      userId: sari,
    });

    const result = await listUserOrganizations(db, budi);

    expect(
      result.organizations.map(({ id, name, role }) => ({ id, name, role }))
    ).toStrictEqual([
      { id: alpha, name: "Alpha Toko", role: "owner" },
      { id: zebra, name: "Zebra Mart", role: "member" },
    ]);
    expect(result.organizations[0]?.logo).toBe(
      "https://cdn.example.test/alpha.png"
    );
    expect(result.organizations[1]?.logo).toBeNull();
  });

  it("hasil lolos meOrganizationsResponseSchema dengan tanggal ISO", async () => {
    const { db } = handle;
    const userId = await insertUser(db);
    const orgId = await insertOrganization(db, "Toko Budi", {
      slug: "toko-budi",
    });
    await insertMember(db, { organizationId: orgId, role: "owner", userId });

    const result = await listUserOrganizations(db, userId);

    expect(meOrganizationsResponseSchema.parse(result)).toStrictEqual(result);
    expect(result.organizations[0]).toStrictEqual({
      createdAt: FIXTURE_DATE.toISOString(),
      id: orgId,
      logo: null,
      name: "Toko Budi",
      role: "owner",
      slug: "toko-budi",
    });
  });
});

describe(toMeResponse, () => {
  it("lolos meResponseSchema", () => {
    const response = toMeResponse(makeAuthSession());

    expect(meResponseSchema.safeParse(response).success).toBeTruthy();
  });

  it("tidak memuat token sesi atau field sensitif", () => {
    const response = toMeResponse(makeAuthSession());
    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain(FAKE_TOKEN);
    expect(response.session).toStrictEqual({
      expiresAt: "2026-11-07T09:00:00.000Z",
      id: "019a3b7c-3f40-7152-8c6d-7e8f9a0b1c2d",
    });
    expect(response.user).not.toHaveProperty("banned");
    expect(serialized).not.toContain("203.0.113.1");
  });

  it("field plugin undefined dipetakan ke null/false", () => {
    const response = toMeResponse(
      makeAuthSession({
        user: {
          displayUsername: undefined,
          image: undefined,
          role: undefined,
          twoFactorEnabled: undefined,
          username: undefined,
        },
      })
    );

    expect(response.user).toMatchObject({
      displayUsername: null,
      image: null,
      role: null,
      twoFactorEnabled: false,
      username: null,
    });
    expect(meResponseSchema.safeParse(response).success).toBeTruthy();
  });

  it("field plugin yang terisi diteruskan apa adanya", () => {
    const response = toMeResponse(
      makeAuthSession({
        user: {
          displayUsername: "Budi_S",
          role: "admin",
          twoFactorEnabled: true,
          username: "budi_s",
        },
      })
    );

    expect(response.user).toMatchObject({
      createdAt: FIXTURE_DATE.toISOString(),
      displayUsername: "Budi_S",
      role: "admin",
      twoFactorEnabled: true,
      username: "budi_s",
    });
  });
});
