"use server";

import {
  AccountStatus,
  ConfirmationStatus,
  MatchValidationStatus,
  NotificationType,
  Role,
  WeekStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/audit";
import { requireActiveMember, requireAuthenticatedUser } from "@/lib/auth";
import { getFallbackStore } from "@/lib/data-store";
import {
  normalizePhoneNumber,
  validateAndNormalizePhoneWithCountry,
} from "@/lib/phone";
import { isDatabaseConnectionError, prisma } from "@/lib/prisma";
import { storePhotoUpload } from "@/lib/storage";
import {
  completePhoneSchema,
  getPortraitUrlBySeed,
  profileUpdateSchema,
} from "@/lib/validation";

export interface StudentActionResult {
  success: boolean;
  message: string;
}

export async function completeStudentPhoneAction(
  formData: FormData
): Promise<StudentActionResult> {
  const { user, dbConnected } = await requireAuthenticatedUser();

  if (!user.emailVerified || user.status !== AccountStatus.ACTIVE) {
    return {
      success: false,
      message:
        "Votre compte doit d'abord être approuvé par l'administration avant de finaliser cette étape.",
    };
  }

  const countryCode = String(formData.get("countryCode") ?? "+221").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const groupIdRaw = String(formData.get("groupId") ?? "").trim();

  const schemaCheck = completePhoneSchema.safeParse({
    countryCode,
    phone,
    groupId: groupIdRaw || undefined,
  });

  if (!schemaCheck.success) {
    return {
      success: false,
      message:
        schemaCheck.error.issues[0]?.message ||
        "Veuillez saisir un numéro de téléphone valide.",
    };
  }

  const phoneCheck = validateAndNormalizePhoneWithCountry(countryCode, phone);
  if (!phoneCheck.valid) {
    return {
      success: false,
      message: phoneCheck.error,
    };
  }

  if (dbConnected) {
    try {
      let resolvedGroupId: string | undefined = undefined;
      if (!user.groupId && groupIdRaw) {
        const grp = await prisma.group.findFirst({
          where: { id: groupIdRaw, isActive: true },
          select: { id: true },
        });
        if (!grp) {
          return {
            success: false,
            message: "L'ancienne classe sélectionnée est introuvable ou inactive.",
          };
        }
        resolvedGroupId = grp.id;
      }

      // Security: strictly update ONLY the authenticated user's own record (`user.id`)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phone: phoneCheck.formatted,
          phoneNormalized: phoneCheck.e164,
          ...(resolvedGroupId ? { groupId: resolvedGroupId } : {}),
        },
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message:
            "Impossible d'enregistrer votre numéro pour le moment. Veuillez réessayer.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const target = store.users.find((u) => u.id === user.id);
    if (!target) {
      return { success: false, message: "Compte utilisateur introuvable." };
    }
    target.phone = phoneCheck.formatted;
    target.phoneNormalized = phoneCheck.e164;
    if (!target.groupId && groupIdRaw) {
      const grp = store.groups.find((g) => g.id === groupIdRaw && g.isActive);
      if (grp) {
        target.groupId = grp.id;
        target.groupName = grp.name;
        target.groupColor = grp.color;
      }
    }
  }

  revalidatePath("/complete-profile");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/admin");

  return {
    success: true,
    message: `Numéro WhatsApp (${phoneCheck.formatted}) enregistré avec succès ! Redirection vers votre espace…`,
  };
}

export async function updateProfileAction(
  formData: FormData
): Promise<StudentActionResult> {
  const { user, dbConnected } = await requireAuthenticatedUser();

  const firstName = String(formData.get("firstName") ?? user.firstName).trim();
  const lastName = String(formData.get("lastName") ?? user.lastName).trim();
  const phone = String(formData.get("phone") ?? user.phone ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const interestsRaw = String(formData.get("interests") ?? "");
  const avatarPreset = String(formData.get("avatarPreset") ?? "").trim();
  const groupIdRaw = String(formData.get("groupId") ?? "").trim();

  const notifyEmail = formData.get("notifyEmail") === "on";
  const notifyMatchPublished = formData.get("notifyMatchPublished") === "on";
  const notifyWeeklyReminder = formData.get("notifyWeeklyReminder") === "on";
  const notifyEndOfCycle = formData.get("notifyEndOfCycle") === "on";

  const interests = interestsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  let imageUrl =
    avatarPreset || user.image || getPortraitUrlBySeed(user.email || user.id);
  const avatarFile = formData.get("avatarFile");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    try {
      const uploaded = await storePhotoUpload(avatarFile, "avatars");
      imageUrl = uploaded.imageUrl;
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : "Erreur lors du téléversement de la photo de profil.",
      };
    }
  }

  const parsed = profileUpdateSchema.safeParse({
    firstName,
    lastName,
    phone: phone || undefined,
    bio,
    interests,
    image: imageUrl,
    groupId: groupIdRaw || undefined,
    notifyEmail,
    notifyMatchPublished,
    notifyWeeklyReminder,
    notifyEndOfCycle,
  });

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message || "Données de profil invalides.",
    };
  }

  const phoneNormalized = phone ? normalizePhoneNumber(phone) : null;
  if (
    user.status === AccountStatus.ACTIVE &&
    user.role !== Role.ADMIN &&
    !phoneNormalized
  ) {
    return {
      success: false,
      message:
        "Votre numéro de téléphone WhatsApp est requis pour permettre à vos jumeaux de vous contacter.",
    };
  }

  if (dbConnected) {
    try {
      const allowNameEditCfg = await prisma.appConfiguration.findUnique({
        where: { key: "allow_student_name_edit" },
      });
      const canEditIdentity =
        user.role === Role.ADMIN ||
        user.status === AccountStatus.CORRECTION_REQUESTED ||
        user.status === AccountStatus.PENDING_APPROVAL ||
        allowNameEditCfg?.value === "true";

      const canAssignGroup =
        !user.groupId ||
        user.role === Role.ADMIN ||
        user.status === AccountStatus.CORRECTION_REQUESTED ||
        user.status === AccountStatus.PENDING_APPROVAL;

      const nextStatus =
        user.status === AccountStatus.CORRECTION_REQUESTED
          ? AccountStatus.PENDING_APPROVAL
          : user.status;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(canEditIdentity
            ? {
                firstName: parsed.data.firstName,
                lastName: parsed.data.lastName,
              }
            : {}),
          ...(canAssignGroup && parsed.data.groupId
            ? { groupId: parsed.data.groupId }
            : {}),
          phone: phone || null,
          phoneNormalized,
          bio: bio || null,
          interests,
          image: imageUrl,
          notifyEmail,
          notifyMatchPublished,
          notifyWeeklyReminder,
          notifyEndOfCycle,
          status: nextStatus,
        },
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Impossible de mettre à jour le profil.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const allowNameEdit =
      store.configs.find((c) => c.key === "allow_student_name_edit")?.value ===
      "true";
    const target = store.users.find((u) => u.id === user.id);
    if (target) {
      const canEditIdentity =
        target.role === Role.ADMIN ||
        target.status === AccountStatus.CORRECTION_REQUESTED ||
        target.status === AccountStatus.PENDING_APPROVAL ||
        allowNameEdit;

      if (canEditIdentity) {
        target.firstName = firstName;
        target.lastName = lastName;
      }
      if (
        (!target.groupId ||
          target.status === AccountStatus.CORRECTION_REQUESTED ||
          target.status === AccountStatus.PENDING_APPROVAL) &&
        groupIdRaw
      ) {
        const grp = store.groups.find((g) => g.id === groupIdRaw);
        if (grp) {
          target.groupId = grp.id;
          target.groupName = grp.name;
          target.groupColor = grp.color;
        }
      }
      target.phone = phone || null;
      target.phoneNormalized = phoneNormalized;
      target.bio = bio || null;
      target.interests = interests;
      target.image = imageUrl;
      target.notifyEmail = notifyEmail;
      target.notifyMatchPublished = notifyMatchPublished;
      target.notifyWeeklyReminder = notifyWeeklyReminder;
      target.notifyEndOfCycle = notifyEndOfCycle;
      if (target.status === AccountStatus.CORRECTION_REQUESTED) {
        target.status = AccountStatus.PENDING_APPROVAL;
      }
    }
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/account-status");

  return {
    success: true,
    message: "Votre profil a été mis à jour avec succès.",
  };
}

export async function confirmMeetingAction(
  formData: FormData
): Promise<StudentActionResult> {
  const { user, dbConnected } = await requireActiveMember();
  const matchId = String(formData.get("matchId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const statusInput = String(formData.get("status") ?? "CONFIRMED").trim();
  const confStatus =
    statusInput === "DISPUTED"
      ? ConfirmationStatus.DISPUTED
      : ConfirmationStatus.CONFIRMED;

  if (!matchId) {
    return { success: false, message: "Identifiant de jumelage manquant." };
  }

  if (dbConnected) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { confirmations: true, week: true },
      });

      if (
        !match ||
        (match.studentAId !== user.id && match.studentBId !== user.id)
      ) {
        return {
          success: false,
          message: "Vous ne faites pas partie de ce jumelage.",
        };
      }

      if (
        match.validationStatus !== MatchValidationStatus.APPROVED ||
        (match.week.status !== WeekStatus.PUBLISHED &&
          match.week.status !== WeekStatus.CLOSED)
      ) {
        return {
          success: false,
          message:
            "Ce jumelage n'est pas encore officiellement publié et ne peut pas être confirmé.",
        };
      }

      await prisma.matchConfirmation.upsert({
        where: {
          matchId_userId: {
            matchId,
            userId: user.id,
          },
        },
        update: {
          status: confStatus,
          note: note || null,
          confirmedAt: new Date(),
        },
        create: {
          matchId,
          userId: user.id,
          status: confStatus,
          note: note || null,
        },
      });

      const partnerId =
        match.studentAId === user.id ? match.studentBId : match.studentAId;

      await createNotification({
        userId: partnerId,
        type: NotificationType.GENERAL,
        title: "Rencontre confirmée par votre jumeau",
        body: `${user.firstName} ${user.lastName} a confirmé votre rencontre hebdomadaire sur Synkro.`,
        link: "/dashboard",
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de l'enregistrement de la confirmation.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const match = store.matches.find((m) => m.id === matchId);
    if (
      !match ||
      (match.studentA.id !== user.id && match.studentB.id !== user.id)
    ) {
      return {
        success: false,
        message: "Vous ne faites pas partie de ce jumelage.",
      };
    }

    const existing = match.confirmations.find((c) => c.userId === user.id);
    if (existing) {
      existing.status = confStatus;
      existing.note = note || null;
      existing.confirmedAt = new Date();
    } else {
      match.confirmations.push({
        id: `conf-${Date.now()}`,
        matchId,
        userId: user.id,
        status: confStatus,
        confirmedAt: new Date(),
        note: note || null,
      });
    }

    const partner =
      match.studentA.id === user.id ? match.studentB : match.studentA;
    store.notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: partner.id,
      type: NotificationType.GENERAL,
      title: "Rencontre confirmée par votre jumeau",
      body: `${user.firstName} ${user.lastName} a confirmé votre rencontre hebdomadaire.`,
      link: "/dashboard",
      isRead: false,
      createdAt: new Date(),
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");

  return {
    success: true,
    message:
      confStatus === ConfirmationStatus.CONFIRMED
        ? "Rencontre confirmée avec succès !"
        : "Statut de la rencontre mis à jour.",
  };
}

export async function markNotificationsReadAction(): Promise<StudentActionResult> {
  const { user, dbConnected } = await requireAuthenticatedUser();

  if (dbConnected) {
    try {
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    } catch {
      // Ignore if offline
    }
  } else {
    const store = getFallbackStore();
    for (const n of store.notifications) {
      if (n.userId === user.id) {
        n.isRead = true;
      }
    }
  }

  revalidatePath("/dashboard");
  return { success: true, message: "Notifications marquées comme lues." };
}
