"use server";

import { AccountStatus, NotificationType, Role, TokenType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/audit";
import {
  generateVerificationToken,
  hashPassword,
  hashToken,
  normalizeEmail,
} from "@/lib/crypto";
import { findUserByEmail, getFallbackStore } from "@/lib/data-store";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { normalizePhoneNumber } from "@/lib/phone";
import { isDatabaseConnectionError, prisma } from "@/lib/prisma";
import {
  forgotPasswordSchema,
  getPortraitUrlBySeed,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation";

export interface ActionResponse {
  success: boolean;
  message: string;
  devVerificationUrl?: string;
  devResetUrl?: string;
}

export async function registerStudentAction(
  formData: FormData
): Promise<ActionResponse> {
  const raw = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    groupId: String(formData.get("groupId") ?? ""),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      success: false,
      message: firstIssue?.message || "Données d'inscription invalides.",
    };
  }

  const emailNorm = normalizeEmail(parsed.data.email);
  const phoneNorm = normalizePhoneNumber(parsed.data.phone);

  const { user: existing, dbConnected } = await findUserByEmail(emailNorm);
  if (existing) {
    return {
      success: false,
      message: "Un compte existe déjà avec cette adresse e-mail.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const { rawToken, tokenHash } = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  let createdUserId = "";

  if (dbConnected) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const group = await tx.group.findUnique({
          where: { id: parsed.data.groupId },
        });
        if (!group || !group.isActive) {
          throw new Error("Le groupe sélectionné est invalide ou inactif.");
        }

        const newUser = await tx.user.create({
          data: {
            email: emailNorm,
            emailNormalized: emailNorm,
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            passwordHash,
            phone: parsed.data.phone,
            phoneNormalized: phoneNorm,
            groupId: group.id,
            role: Role.STUDENT,
            status: AccountStatus.PENDING_VERIFICATION,
            image: getPortraitUrlBySeed(emailNorm),
          },
        });

        await tx.emailVerificationToken.create({
          data: {
            userId: newUser.id,
            tokenHash,
            type: TokenType.EMAIL_VERIFICATION,
            expiresAt,
          },
        });

        return newUser;
      });
      createdUserId = result.id;
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Erreur lors de la création du compte.",
        };
      }
    }
  }

  if (!createdUserId) {
    // Fallback store when PostgreSQL is offline
    const store = getFallbackStore();
    const grp = store.groups.find((g) => g.id === parsed.data.groupId);
    if (!grp) {
      return {
        success: false,
        message: "Veuillez sélectionner un groupe valide.",
      };
    }
    createdUserId = `stu-reg-${Date.now()}`;
    store.users.unshift({
      id: createdUserId,
      email: emailNorm,
      emailNormalized: emailNorm,
      emailVerified: null,
      phone: parsed.data.phone,
      phoneNormalized: phoneNorm,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      passwordHash,
      image: getPortraitUrlBySeed(emailNorm),
      bio: null,
      interests: [],
      role: Role.STUDENT,
      status: AccountStatus.PENDING_VERIFICATION,
      statusReason: null,
      groupId: grp.id,
      groupName: grp.name,
      groupColor: grp.color,
      notifyEmail: true,
      notifyMatchPublished: true,
      notifyWeeklyReminder: true,
      notifyEndOfCycle: true,
      createdAt: new Date(),
      lastLoginAt: null,
    });
    grp.studentCount += 1;
    store.tokens.push({
      tokenHash,
      userId: createdUserId,
      type: "EMAIL_VERIFICATION",
      expiresAt,
      usedAt: null,
    });
  }

  const emailRes = await sendVerificationEmail({
    userId: createdUserId,
    toEmail: emailNorm,
    firstName: parsed.data.firstName,
    rawToken,
  });

  const devVerificationUrl =
    emailRes.provider === "CONSOLE"
      ? `/verify-email?token=${encodeURIComponent(rawToken)}`
      : undefined;

  return {
    success: true,
    message: emailRes.success
      ? "Inscription enregistrée ! Vérifiez votre boîte e-mail pour confirmer votre adresse avant l'approbation par l'administrateur."
      : `Inscription enregistrée, mais l'envoi d'e-mail a signalé : ${emailRes.errorMessage}`,
    devVerificationUrl,
  };
}

export async function verifyEmailTokenAction(
  rawToken: string
): Promise<ActionResponse> {
  if (!rawToken || rawToken.trim().length < 32) {
    return {
      success: false,
      message: "Le jeton de vérification est manquant ou invalide.",
    };
  }

  const tokenHash = hashToken(rawToken.trim());
  const now = new Date();

  try {
    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.type !== TokenType.EMAIL_VERIFICATION) {
      return {
        success: false,
        message: "Ce lien de vérification est introuvable ou invalide.",
      };
    }

    if (tokenRecord.usedAt) {
      return {
        success: true,
        message:
          "Votre adresse e-mail a déjà été confirmée. Votre compte est en attente d'approbation par l'administrateur.",
      };
    }

    if (tokenRecord.expiresAt < now) {
      return {
        success: false,
        message:
          "Ce lien de vérification a expiré. Connectez-vous pour demander un nouveau lien.",
      };
    }

    const nextStatus =
      tokenRecord.user.status === AccountStatus.PENDING_VERIFICATION
        ? AccountStatus.PENDING_APPROVAL
        : tokenRecord.user.status;

    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: now },
      }),
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: {
          emailVerified: now,
          status: nextStatus,
        },
      }),
    ]);

    await createNotification({
      userId: tokenRecord.userId,
      type: NotificationType.ACCOUNT_VERIFIED,
      title: "Adresse e-mail confirmée",
      body: "Votre adresse e-mail est vérifiée. Un administrateur va maintenant valider votre appartenance à la classe.",
      link: "/account-status",
    });

    revalidatePath("/account-status");
    revalidatePath("/admin");

    return {
      success: true,
      message:
        "Adresse e-mail vérifiée avec succès ! Votre compte est désormais soumis à l'approbation manuelle de l'administrateur.",
    };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const store = getFallbackStore();
      const tk = store.tokens.find(
        (t) => t.tokenHash === tokenHash && t.type === "EMAIL_VERIFICATION"
      );
      if (!tk) {
        return {
          success: false,
          message: "Ce lien de vérification est introuvable ou invalide.",
        };
      }
      if (tk.usedAt) {
        return {
          success: true,
          message: "Votre adresse e-mail est déjà confirmée.",
        };
      }
      if (tk.expiresAt < now) {
        return {
          success: false,
          message: "Ce lien de vérification a expiré.",
        };
      }
      tk.usedAt = now;
      const usr = store.users.find((u) => u.id === tk.userId);
      if (usr) {
        usr.emailVerified = now;
        if (usr.status === AccountStatus.PENDING_VERIFICATION) {
          usr.status = AccountStatus.PENDING_APPROVAL;
        }
      }
      revalidatePath("/account-status");
      revalidatePath("/admin");
      return {
        success: true,
        message:
          "Adresse e-mail vérifiée avec succès ! Votre compte est maintenant en attente d'approbation par l'administrateur.",
      };
    }
    return {
      success: false,
      message: "Erreur lors de la vérification du jeton.",
    };
  }
}

export async function resendVerificationEmailAction(
  email: string
): Promise<ActionResponse> {
  const emailNorm = normalizeEmail(email);
  const { user, dbConnected } = await findUserByEmail(emailNorm);

  if (!user) {
    return {
      success: true,
      message:
        "Si un compte non vérifié correspond à cette adresse, un nouveau lien a été envoyé.",
    };
  }

  if (user.emailVerified) {
    return {
      success: true,
      message: "Votre adresse e-mail est déjà vérifiée.",
    };
  }

  const { rawToken, tokenHash } = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (dbConnected) {
    try {
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          type: TokenType.EMAIL_VERIFICATION,
          expiresAt,
        },
      });
    } catch {
      // Fallback
    }
  } else {
    const store = getFallbackStore();
    store.tokens.push({
      tokenHash,
      userId: user.id,
      type: "EMAIL_VERIFICATION",
      expiresAt,
      usedAt: null,
    });
  }

  const res = await sendVerificationEmail({
    userId: user.id,
    toEmail: user.email,
    firstName: user.firstName,
    rawToken,
  });

  return {
    success: res.success,
    message: res.success
      ? "Un nouveau lien de vérification vous a été envoyé."
      : `Impossible d'envoyer l'e-mail : ${res.errorMessage}`,
    devVerificationUrl:
      res.provider === "CONSOLE"
        ? `/verify-email?token=${encodeURIComponent(rawToken)}`
        : undefined,
  };
}

export async function requestPasswordResetAction(
  formData: FormData
): Promise<ActionResponse> {
  const emailRaw = String(formData.get("email") ?? "");
  const parsed = forgotPasswordSchema.safeParse({ email: emailRaw });
  if (!parsed.success) {
    return {
      success: false,
      message: "Veuillez saisir une adresse e-mail valide.",
    };
  }

  const emailNorm = normalizeEmail(parsed.data.email);
  const { user, dbConnected } = await findUserByEmail(emailNorm);

  // Generic message to prevent user enumeration
  const genericMsg =
    "Si un compte est associé à cette adresse e-mail, un lien de réinitialisation valable 1 heure a été envoyé.";

  if (!user) {
    return { success: true, message: genericMsg };
  }

  const { rawToken, tokenHash } = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  if (dbConnected) {
    try {
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          type: TokenType.PASSWORD_RESET,
          expiresAt,
        },
      });
    } catch {
      // Fallback
    }
  } else {
    const store = getFallbackStore();
    store.tokens.push({
      tokenHash,
      userId: user.id,
      type: "PASSWORD_RESET",
      expiresAt,
      usedAt: null,
    });
  }

  const res = await sendPasswordResetEmail({
    userId: user.id,
    toEmail: user.email,
    firstName: user.firstName,
    rawToken,
  });

  return {
    success: true,
    message: genericMsg,
    devResetUrl:
      res.provider === "CONSOLE"
        ? `/reset-password?token=${encodeURIComponent(rawToken)}`
        : undefined,
  };
}

export async function resetPasswordAction(
  formData: FormData
): Promise<ActionResponse> {
  const raw = {
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ||
        "Données de réinitialisation invalides.",
    };
  }

  const tokenHash = hashToken(parsed.data.token);
  const now = new Date();
  const newPasswordHash = await hashPassword(parsed.data.password);

  try {
    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (
      !tokenRecord ||
      tokenRecord.type !== TokenType.PASSWORD_RESET ||
      tokenRecord.usedAt ||
      tokenRecord.expiresAt < now
    ) {
      return {
        success: false,
        message: "Ce lien de réinitialisation est invalide ou a expiré.",
      };
    }

    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: now },
      }),
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash: newPasswordHash },
      }),
    ]);

    return {
      success: true,
      message:
        "Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.",
    };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const store = getFallbackStore();
      const tk = store.tokens.find(
        (t) => t.tokenHash === tokenHash && t.type === "PASSWORD_RESET"
      );
      if (!tk || tk.usedAt || tk.expiresAt < now) {
        return {
          success: false,
          message: "Ce lien de réinitialisation est invalide ou a expiré.",
        };
      }
      tk.usedAt = now;
      const usr = store.users.find((u) => u.id === tk.userId);
      if (usr) {
        usr.passwordHash = newPasswordHash;
      }
      return {
        success: true,
        message:
          "Votre mot de passe a été réinitialisé avec succès. Connectez-vous avec votre nouveau mot de passe.",
      };
    }
    return {
      success: false,
      message: "Erreur lors de la réinitialisation du mot de passe.",
    };
  }
}
