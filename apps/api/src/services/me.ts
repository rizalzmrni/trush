import type { AuthSession } from "@trush/auth";
import type {
  MeOrganizationsResponse,
  MeResponse,
} from "@trush/core/schemas/me";
import type { AnyDatabase } from "@trush/db";

/** Memetakan sesi better-auth ke kontrak `MeResponse` (tanpa token sesi). */
export const toMeResponse = ({ session, user }: AuthSession): MeResponse => ({
  session: {
    expiresAt: session.expiresAt.toISOString(),
    id: session.id,
  },
  user: {
    createdAt: user.createdAt.toISOString(),
    displayUsername: user.displayUsername ?? null,
    email: user.email,
    emailVerified: user.emailVerified,
    id: user.id,
    image: user.image ?? null,
    name: user.name,
    role: user.role ?? null,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
    username: user.username ?? null,
  },
});

/**
 * Organisasi tempat `userId` menjadi anggota, beserta perannya, urut nama.
 * Kepemilikan: hanya keanggotaan milik `userId` yang dibaca.
 */
export const listUserOrganizations = async (
  db: AnyDatabase,
  userId: string
): Promise<MeOrganizationsResponse> => {
  const memberships = await db.query.member.findMany({
    where: (member, { eq }) => eq(member.userId, userId),
    with: { organization: true },
  });
  const organizations = memberships
    .map(({ organization, role }) => ({
      createdAt: organization.createdAt.toISOString(),
      id: organization.id,
      logo: organization.logo,
      name: organization.name,
      role,
      slug: organization.slug,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  return { organizations };
};
