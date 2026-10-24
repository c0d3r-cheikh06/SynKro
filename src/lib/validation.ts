import { z } from "zod";
import {
  normalizePhoneNumber,
  validateAndNormalizePhoneWithCountry,
} from "./phone";

export const registerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Le prénom doit contenir au moins 2 caractères")
    .max(60, "Le prénom est trop long"),
  lastName: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(60, "Le nom est trop long"),
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide")
    .max(160, "Adresse e-mail trop longue"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(128, "Le mot de passe est trop long")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
  phone: z
    .string()
    .trim()
    .min(8, "Numéro de téléphone invalide")
    .max(25, "Numéro de téléphone invalide")
    .refine((val) => normalizePhoneNumber(val) !== null, {
      message:
        "Format de téléphone invalide (ex: +221 77 123 45 67 ou 771234567)",
    }),
  groupId: z.string().trim().min(1, "Veuillez sélectionner votre groupe"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Veuillez saisir votre mot de passe"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide"),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32, "Jeton de réinitialisation invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(128, "Le mot de passe est trop long")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
});

export const completePhoneSchema = z
  .object({
    countryCode: z
      .string()
      .trim()
      .min(1, "Veuillez choisir un indicatif de pays")
      .max(6, "Indicatif invalide"),
    phone: z
      .string()
      .trim()
      .min(6, "Veuillez saisir votre numéro de téléphone")
      .max(25, "Numéro de téléphone trop long"),
    groupId: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const check = validateAndNormalizePhoneWithCountry(
      data.countryCode,
      data.phone
    );
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: check.error,
      });
    }
  });

export const profileUpdateSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Le prénom doit contenir au moins 2 caractères")
    .max(60)
    .optional(),
  lastName: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(60)
    .optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || normalizePhoneNumber(val) !== null, {
      message: "Format de téléphone invalide",
    }),
  bio: z
    .string()
    .trim()
    .max(500, "La biographie ne peut pas dépasser 500 caractères")
    .optional(),
  interests: z
    .array(z.string().trim().min(1).max(40))
    .max(12, "Maximum 12 centres d'intérêt")
    .optional(),
  image: z.string().trim().max(500).optional(),
  groupId: z.string().trim().optional(),
  notifyEmail: z.boolean().optional(),
  notifyMatchPublished: z.boolean().optional(),
  notifyWeeklyReminder: z.boolean().optional(),
  notifyEndOfCycle: z.boolean().optional(),
});

export const groupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nom du groupe requis")
    .max(60, "Nom trop long"),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Le slug ne doit contenir que a-z, 0-9 et tirets"),
  description: z.string().trim().max(250).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hexadécimale invalide (#RRGGBB)")
    .optional(),
  order: z.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export const cycleSchema = z.object({
  name: z.string().trim().min(3, "Nom du cycle requis").max(100),
  description: z.string().trim().max(500).optional(),
  totalWeeks: z.number().int().min(1).max(12).default(6),
  startDate: z.string().optional(),
  timezone: z.string().trim().default("Africa/Dakar"),
});

export const reportSchema = z.object({
  targetUserId: z.string().trim().optional(),
  photoId: z.string().trim().optional(),
  reason: z.string().trim().min(3, "Veuillez préciser le motif").max(120),
  details: z.string().trim().max(1000).optional(),
});

/**
 * 3D-stylized Cosmic Tech character avatars with computer-science codenames.
 * Distinct from personal uploaded photos (/uploads/...) and student identities.
 */
export const AVATAR_PRESETS = [
  {
    id: "avatar-pixel",
    label: "Pixel",
    specialty: "UI/UX & Shaders",
    url: "/avatars/avatar-pixel.svg",
  },
  {
    id: "avatar-kernel",
    label: "Kernel",
    specialty: "Systèmes & Linux",
    url: "/avatars/avatar-kernel.svg",
  },
  {
    id: "avatar-nova",
    label: "Nova",
    specialty: "Data & IA",
    url: "/avatars/avatar-nova.svg",
  },
  {
    id: "avatar-cipher",
    label: "Cipher",
    specialty: "Cybersécurité",
    url: "/avatars/avatar-cipher.svg",
  },
  {
    id: "avatar-nexus",
    label: "Nexus",
    specialty: "Cloud & Réseaux",
    url: "/avatars/avatar-nexus.svg",
  },
  {
    id: "avatar-quantum",
    label: "Quantum",
    specialty: "Algorithmes & HPC",
    url: "/avatars/avatar-quantum.svg",
  },
  {
    id: "avatar-vector",
    label: "Vector",
    specialty: "Full-Stack & Web",
    url: "/avatars/avatar-vector.svg",
  },
  {
    id: "avatar-orbit",
    label: "Orbit",
    specialty: "Robotique & IoT",
    url: "/avatars/avatar-orbit.svg",
  },
  {
    id: "avatar-syntax",
    label: "Syntax",
    specialty: "Mobile & Code",
    url: "/avatars/avatar-syntax.svg",
  },
  {
    id: "avatar-astro",
    label: "Astro",
    specialty: "Gardien Stellaire",
    url: "/avatars/avatar-astro.svg",
  },
] as const;

export function getPortraitUrlBySeed(seed: number | string): string {
  if (typeof seed === "number") {
    return AVATAR_PRESETS[Math.abs(seed) % AVATAR_PRESETS.length].url;
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PRESETS[hash % AVATAR_PRESETS.length].url;
}

export const DEFAULT_GROUPS = [
  {
    name: "DUT INFO",
    slug: "dut-info",
    description: "DUT Informatique — Génie Logiciel & Systèmes",
    color: "#2864E8",
    order: 1,
    indicativeCount: 23,
  },
  {
    name: "DUT TR",
    slug: "dut-tr",
    description: "DUT Télécommunications & Réseaux",
    color: "#173B67",
    order: 2,
    indicativeCount: 23,
  },
  {
    name: "GLSI",
    slug: "glsi",
    description: "Génie Logiciel & Systèmes d'Information",
    color: "#0E7490",
    order: 3,
    indicativeCount: 8,
  },
  {
    name: "SRT",
    slug: "srt",
    description: "Systèmes, Réseaux & Télécommunications",
    color: "#18865B",
    order: 4,
    indicativeCount: 8,
  },
  {
    name: "Autres",
    slug: "autres",
    description: "Autres anciennes classes et spécialités numériques",
    color: "#4F46E5",
    order: 5,
    indicativeCount: 6,
  },
] as const;
