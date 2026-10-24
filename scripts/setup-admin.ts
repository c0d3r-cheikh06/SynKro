import { AccountStatus, PrismaClient, Role } from "@prisma/client";
import { hashPassword, normalizeEmail, verifyPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();

const FORBIDDEN_PASSWORDS = [
  "AdminSynkro2026!",
  "EtudiantSynkro2026!",
  "passer123",
  "admin12345678",
  "password1234",
];

/**
 * Valide rigoureusement le mot de passe administrateur pour la création ou la réinitialisation.
 * Ne trace JAMAIS la valeur du mot de passe en clair.
 */
function validateAdminPassword(
  rawPassword: string | undefined,
  isProduction: boolean,
  context: "création initiale" | "réinitialisation"
): string {
  if (!rawPassword) {
    if (isProduction) {
      throw new Error(
        `❌ Sécurité critique : La variable ADMIN_INITIAL_PASSWORD est obligatoire pour la ${context} du compte administrateur en production.`
      );
    } else {
      throw new Error(
        `❌ Sécurité : Veuillez renseigner ADMIN_INITIAL_PASSWORD pour la ${context} du mot de passe administrateur.`
      );
    }
  }

  if (isProduction && rawPassword.length < 12) {
    throw new Error(
      `❌ Sécurité critique : En production, ADMIN_INITIAL_PASSWORD doit comporter au moins 12 caractères pour la ${context}.`
    );
  } else if (rawPassword.length < 8) {
    throw new Error(
      `❌ Sécurité : ADMIN_INITIAL_PASSWORD doit comporter au moins 8 caractères pour la ${context}.`
    );
  }

  if (isProduction && FORBIDDEN_PASSWORDS.includes(rawPassword)) {
    throw new Error(
      `❌ Sécurité critique : En production, ADMIN_INITIAL_PASSWORD ne peut pas être un mot de passe faible, par défaut ou de démonstration pour la ${context}.`
    );
  }

  return rawPassword;
}

async function main() {
  const isProduction = process.env.NODE_ENV === "production";
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || "fazethiam@gmail.com");
  const rawPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim();

  console.log(`🔐 Configuration sécurisée du compte administrateur : ${adminEmail}`);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { emailNormalized: adminEmail },
      ],
    },
  });

  if (existing) {
    // Vérification de sécurité anti-élévation de privilèges accidentelle
    if (existing.role !== Role.ADMIN) {
      const allowPromotion = process.env.ALLOW_ADMIN_ROLE_PROMOTION === "true";
      if (!allowPromotion) {
        throw new Error(
          `❌ Sécurité critique : L'adresse e-mail "${adminEmail}" correspond à un utilisateur existant ayant le rôle "${existing.role}". Pour éviter toute élévation de privilèges accidentelle, la promotion vers le rôle ADMIN est bloquée. Définissez ALLOW_ADMIN_ROLE_PROMOTION="true" si cette promotion est intentionnelle.`
        );
      }
      console.warn(
        `⚠️ ATTENTION : Promotion explicite de l'utilisateur ${adminEmail} du rôle ${existing.role} vers ADMIN (ALLOW_ADMIN_ROLE_PROMOTION=true).`
      );
    }

    // Gestion du mot de passe : préservé par défaut, ou réinitialisé si demandé explicitement
    const shouldResetPassword = process.env.RESET_ADMIN_PASSWORD === "true";
    let newHash: string | undefined = undefined;

    if (shouldResetPassword) {
      const validatedPassword = validateAdminPassword(
        rawPassword,
        isProduction,
        "réinitialisation"
      );
      newHash = await hashPassword(validatedPassword);
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
        emailVerified: existing.emailVerified ?? new Date(),
        statusReason: null,
        ...(newHash ? { passwordHash: newHash } : {}),
      },
    });

    console.log(
      `✔ Utilisateur existant confirmé Administrateur : ID=${updated.id}, Email=${updated.email}, Role=${updated.role}, Status=${updated.status}`
    );
    if (!newHash) {
      console.log("ℹ Le mot de passe existant a été préservé sans modification.");
    } else {
      console.log("✔ Le mot de passe a été réinitialisé conformément à RESET_ADMIN_PASSWORD=true.");
    }
  } else {
    // Première création de l'administrateur
    const validatedPassword = validateAdminPassword(
      rawPassword,
      isProduction,
      "création initiale"
    );
    const passwordHash = await hashPassword(validatedPassword);

    const created = await prisma.user.create({
      data: {
        email: adminEmail,
        emailNormalized: adminEmail,
        firstName: "Faze",
        lastName: "Thiam",
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
        emailVerified: new Date(),
        passwordHash,
        phone: null,
        phoneNormalized: null,
        image: "/avatars/avatar-vector.svg",
        bio: "Administrateur principal de la plateforme Synkro.",
      },
    });

    console.log(
      `✔ Nouveau compte administrateur créé : ID=${created.id}, Email=${created.email}, Role=${created.role}, Status=${created.status}`
    );

    const isValid = await verifyPassword(validatedPassword, created.passwordHash!);
    console.log(`✔ Vérification du mot de passe initial : ${isValid ? "SUCCÈS" : "ÉCHEC"}`);
  }
}

main()
  .catch((e) => {
    console.error("Erreur lors de la configuration administrateur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
