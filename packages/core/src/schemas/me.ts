import { z } from "zod";

const EXAMPLE_USER_ID = "019a3b7c-1d2e-7f30-8a4b-5c6d7e8f9a0b";
const EXAMPLE_ORG_ID = "019a3b7c-2e3f-7041-9b5c-6d7e8f9a0b1c";
const EXAMPLE_SESSION_ID = "019a3b7c-3f40-7152-8c6d-7e8f9a0b1c2d";
const EXAMPLE_DATE = "2026-10-31T09:00:00.000Z";

/** Waktu ISO 8601 UTC, mis. `2026-10-31T09:00:00.000Z`. */
const isoDateTimeSchema = z.iso.datetime();

/** Nomor E.164 tersimpan, mis. `+6281234567890`. */
const E164 = /^\+[1-9]\d{6,14}$/u;

/** Pengguna yang sedang login (subset aman dari tabel `user`). */
export const meUserSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    email: z.email(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    username: z.string().nullable(),
    displayUsername: z.string().nullable(),
    /** Peran plugin `admin` (`user` | `admin`); null = `user`. */
    role: z.string().nullable(),
    twoFactorEnabled: z.boolean(),
    /**
     * Nomor telepon E.164 (plugin `phoneNumber`); hanya terisi lewat
     * verifikasi OTP, jadi bila ada selalu terverifikasi. Opsional dulu
     * (aturan breaking change `@trush/core`): `GET /api/me` selalu mengisi
     * keduanya sejak B10; anggap tidak ada = `null` / `false`.
     */
    phoneNumber: z.string().regex(E164).nullable().optional(),
    phoneNumberVerified: z.boolean().optional(),
    createdAt: isoDateTimeSchema,
  })
  .meta({ id: "MeUser" });

/** Sesi aktif; token tidak pernah dikirim (sudah ada di cookie httpOnly). */
export const meSessionSchema = z
  .object({
    id: z.string().min(1),
    expiresAt: isoDateTimeSchema,
  })
  .meta({ id: "MeSession" });

/** Response `GET /api/me` (`apps/api`): sumber auth gate frontend. */
export const meResponseSchema = z
  .object({
    user: meUserSchema,
    session: meSessionSchema,
  })
  .meta({
    description: "Pengguna dan sesi yang sedang login.",
    example: {
      session: { expiresAt: EXAMPLE_DATE, id: EXAMPLE_SESSION_ID },
      user: {
        createdAt: EXAMPLE_DATE,
        displayUsername: null,
        email: "budi@example.com",
        emailVerified: false,
        id: EXAMPLE_USER_ID,
        image: null,
        name: "Budi",
        phoneNumber: "+6281234567890",
        phoneNumberVerified: true,
        role: null,
        twoFactorEnabled: false,
        username: null,
      },
    },
    id: "MeResponse",
  });

export type MeUser = z.infer<typeof meUserSchema>;
export type MeSession = z.infer<typeof meSessionSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

/** Organisasi tempat pengguna menjadi anggota, beserta perannya. */
export const meOrganizationSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    /** Dipakai di URL app (`/:slug`); organisasi aktif berasal dari sini. */
    slug: z.string().min(1),
    logo: z.string().nullable(),
    /** Peran plugin `organization` (`owner` | `admin` | `member`). */
    role: z.string().min(1),
    createdAt: isoDateTimeSchema,
  })
  .meta({ id: "MeOrganization" });

/** Response `GET /api/me/organizations`, urut nama. */
export const meOrganizationsResponseSchema = z
  .object({
    organizations: z.array(meOrganizationSchema),
  })
  .meta({
    description: "Organisasi milik pengguna yang sedang login.",
    example: {
      organizations: [
        {
          createdAt: EXAMPLE_DATE,
          id: EXAMPLE_ORG_ID,
          logo: null,
          name: "Toko Budi",
          role: "owner",
          slug: "toko-budi",
        },
      ],
    },
    id: "MeOrganizationsResponse",
  });

export type MeOrganization = z.infer<typeof meOrganizationSchema>;
export type MeOrganizationsResponse = z.infer<
  typeof meOrganizationsResponseSchema
>;
