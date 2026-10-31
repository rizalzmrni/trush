import type { AnyDatabase } from "@trush/db";
import { newId } from "@trush/db";
import { member, organization, user } from "@trush/db/schema";

/** Waktu tetap agar hasil test deterministik. */
export const FIXTURE_DATE = new Date("2026-10-31T09:00:00.000Z");

/** User minimal (nilai palsu). */
export const insertUser = async (
  db: AnyDatabase,
  overrides: { email?: string; name?: string } = {}
): Promise<string> => {
  const id = newId();
  await db.insert(user).values({
    createdAt: FIXTURE_DATE,
    email: overrides.email ?? `${id}@example.test`,
    id,
    name: overrides.name ?? "Pengguna Uji",
    updatedAt: FIXTURE_DATE,
  });
  return id;
};

/** Organisasi minimal; `slug` diturunkan dari nama bila tidak diberikan. */
export const insertOrganization = async (
  db: AnyDatabase,
  name: string,
  overrides: { logo?: string; slug?: string } = {}
): Promise<string> => {
  const id = newId();
  await db.insert(organization).values({
    createdAt: FIXTURE_DATE,
    id,
    logo: overrides.logo ?? null,
    name,
    slug: overrides.slug ?? `${name.toLowerCase().replaceAll(" ", "-")}-${id}`,
  });
  return id;
};

/** Keanggotaan `userId` di `organizationId` dengan peran tertentu. */
export const insertMember = async (
  db: AnyDatabase,
  {
    organizationId,
    role,
    userId,
  }: { organizationId: string; role: string; userId: string }
): Promise<void> => {
  await db.insert(member).values({
    createdAt: FIXTURE_DATE,
    id: newId(),
    organizationId,
    role,
    userId,
  });
};
