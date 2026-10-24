"use server";

import {
  ConsentStatus,
  NotificationType,
  PhotoStatus,
  ReportStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/audit";
import { requireActiveMember } from "@/lib/auth";
import { getFallbackStore } from "@/lib/data-store";
import { isDatabaseConnectionError, prisma } from "@/lib/prisma";
import { storePhotoUpload } from "@/lib/storage";
import { reportSchema } from "@/lib/validation";

export interface RetroActionResponse {
  success: boolean;
  message: string;
}

export async function submitRetroPhotoAction(
  formData: FormData
): Promise<RetroActionResponse> {
  const { user, dbConnected } = await requireActiveMember();

  const caption = String(formData.get("caption") ?? "")
    .trim()
    .slice(0, 400);
  const participantIds = formData
    .getAll("participantIds")
    .map((v) => String(v).trim())
    .filter((id) => Boolean(id) && id !== user.id);

  const uniqueParticipantIds = Array.from(new Set(participantIds));
  const photoFile = formData.get("photoFile");

  if (!(photoFile instanceof File) || photoFile.size <= 0) {
    return {
      success: false,
      message: "Veuillez sélectionner ou prendre une photo valide.",
    };
  }

  let uploadResult;
  try {
    uploadResult = await storePhotoUpload(photoFile, "retro");
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : "Erreur lors du traitement et nettoyage EXIF de la photo.",
    };
  }

  if (dbConnected) {
    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.photoPublication.create({
          data: {
            authorId: user.id,
            caption: caption || null,
            imageKey: uploadResult.imageKey,
            imageUrl: uploadResult.imageUrl,
            status: PhotoStatus.PENDING_MODERATION,
          },
        });

        for (const pId of uniqueParticipantIds) {
          await tx.photoParticipant.create({
            data: {
              photoId: created.id,
              userId: pId,
              consentStatus: ConsentStatus.PENDING,
            },
          });
          await tx.photoConsent.create({
            data: {
              photoId: created.id,
              userId: pId,
              given: false,
            },
          });
        }
      });

      for (const pId of uniqueParticipantIds) {
        await createNotification({
          userId: pId,
          type: NotificationType.GENERAL,
          title: "Consentement photo demandé — Album Rétrospectif",
          body: `${user.firstName} ${user.lastName} vous a identifié(e) sur une photo soumise à l'album rétrospectif. Votre accord est requis avant toute publication.`,
          link: "/retro",
        });
      }
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de l'enregistrement de la photo en base.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const participants = uniqueParticipantIds
      .map((pId) => store.users.find((u) => u.id === pId))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => ({
        userId: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        groupName: u.groupName,
        consentStatus: ConsentStatus.PENDING,
      }));

    store.photos.unshift({
      id: `photo-${Date.now()}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
      authorGroup: user.groupName,
      authorImage: user.image,
      caption: caption || null,
      imageKey: uploadResult.imageKey,
      imageUrl: uploadResult.imageUrl,
      status: PhotoStatus.PENDING_MODERATION,
      rejectionReason: null,
      publishedAt: null,
      createdAt: new Date(),
      participants,
      allConsentsGiven: participants.length === 0,
    });

    for (const pt of participants) {
      store.notifications.unshift({
        id: `notif-consent-${Date.now()}-${pt.userId}`,
        userId: pt.userId,
        type: NotificationType.GENERAL,
        title: "Consentement photo demandé — Album Rétrospectif",
        body: `${user.firstName} ${user.lastName} vous a identifié(e) sur une photo. Confirmez votre consentement sur /retro.`,
        link: "/retro",
        isRead: false,
        createdAt: new Date(),
      });
    }
  }

  revalidatePath("/retro");
  revalidatePath("/admin");

  return {
    success: true,
    message:
      uniqueParticipantIds.length > 0
        ? "Photo soumise (métadonnées EXIF nettoyées) ! Elle sera publiée uniquement après le consentement de tous les participants identifiés et la validation d'un modérateur."
        : "Photo soumise (métadonnées EXIF nettoyées) ! Elle est en attente de modération avant publication.",
  };
}

export async function respondPhotoConsentAction(
  formData: FormData
): Promise<RetroActionResponse> {
  const { user, dbConnected } = await requireActiveMember();
  const photoId = String(formData.get("photoId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim(); // "GIVEN" | "REVOKED"

  if (!photoId || (decision !== "GIVEN" && decision !== "REVOKED")) {
    return { success: false, message: "Paramètres de consentement invalides." };
  }

  const nextStatus =
    decision === "GIVEN" ? ConsentStatus.GIVEN : ConsentStatus.REVOKED;
  const now = new Date();

  if (dbConnected) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.photoParticipant.update({
          where: {
            photoId_userId: { photoId, userId: user.id },
          },
          data: { consentStatus: nextStatus },
        });

        await tx.photoConsent.upsert({
          where: {
            photoId_userId: { photoId, userId: user.id },
          },
          update: {
            given: decision === "GIVEN",
            givenAt: decision === "GIVEN" ? now : undefined,
            revokedAt: decision === "REVOKED" ? now : null,
          },
          create: {
            photoId,
            userId: user.id,
            given: decision === "GIVEN",
            givenAt: decision === "GIVEN" ? now : null,
            revokedAt: decision === "REVOKED" ? now : null,
          },
        });

        // If a participant revokes consent on an already approved photo, withdraw it immediately
        if (decision === "REVOKED") {
          await tx.photoPublication.update({
            where: { id: photoId },
            data: {
              status: PhotoStatus.WITHDRAWN,
              rejectionReason: `Consentement révoqué par un participant (${user.firstName} ${user.lastName}).`,
            },
          });
        }
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Impossible d'enregistrer votre décision de consentement.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const photo = store.photos.find((p) => p.id === photoId);
    if (!photo) {
      return { success: false, message: "Photo introuvable." };
    }
    const pt = photo.participants.find((p) => p.userId === user.id);
    if (!pt) {
      return {
        success: false,
        message: "Vous n'êtes pas identifié(e) sur cette photo.",
      };
    }
    pt.consentStatus = nextStatus;
    photo.allConsentsGiven = photo.participants.every(
      (p) => p.consentStatus === ConsentStatus.GIVEN
    );
    if (decision === "REVOKED") {
      photo.status = PhotoStatus.WITHDRAWN;
      photo.rejectionReason = `Consentement révoqué par ${user.firstName} ${user.lastName}.`;
    }
  }

  revalidatePath("/retro");
  revalidatePath("/admin");

  return {
    success: true,
    message:
      decision === "GIVEN"
        ? "Votre consentement a été enregistré."
        : "Votre consentement a été révoqué et la photo a été retirée de la publication.",
  };
}

export async function withdrawPhotoAction(
  formData: FormData
): Promise<RetroActionResponse> {
  const { user, dbConnected } = await requireActiveMember();
  const photoId = String(formData.get("photoId") ?? "").trim();

  if (!photoId) {
    return { success: false, message: "Identifiant de photo manquant." };
  }

  if (dbConnected) {
    try {
      const photo = await prisma.photoPublication.findUnique({
        where: { id: photoId },
        include: { participants: true },
      });

      if (!photo) {
        return { success: false, message: "Photo introuvable." };
      }

      const isAuthorOrParticipant =
        photo.authorId === user.id ||
        photo.participants.some((p) => p.userId === user.id);

      if (!isAuthorOrParticipant) {
        return {
          success: false,
          message:
            "Seul l'auteur ou un participant identifié peut retirer directement cette photo.",
        };
      }

      await prisma.photoPublication.update({
        where: { id: photoId },
        data: {
          status: PhotoStatus.WITHDRAWN,
          rejectionReason: `Retirée à la demande de ${user.firstName} ${user.lastName}.`,
        },
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors du retrait de la photo.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const photo = store.photos.find((p) => p.id === photoId);
    if (photo) {
      photo.status = PhotoStatus.WITHDRAWN;
      photo.rejectionReason = `Retirée à la demande de ${user.firstName} ${user.lastName}.`;
    }
  }

  revalidatePath("/retro");
  revalidatePath("/admin");

  return {
    success: true,
    message: "La photo a été retirée de l'album rétrospectif.",
  };
}

export async function createReportAction(
  formData: FormData
): Promise<RetroActionResponse> {
  const { user, dbConnected } = await requireActiveMember();

  const raw = {
    targetUserId:
      String(formData.get("targetUserId") ?? "").trim() || undefined,
    photoId: String(formData.get("photoId") ?? "").trim() || undefined,
    reason: String(formData.get("reason") ?? "").trim(),
    details: String(formData.get("details") ?? "").trim() || undefined,
  };

  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ||
        "Veuillez préciser le motif du signalement.",
    };
  }

  if (dbConnected) {
    try {
      await prisma.report.create({
        data: {
          authorId: user.id,
          targetUserId: parsed.data.targetUserId ?? null,
          photoId: parsed.data.photoId ?? null,
          reason: parsed.data.reason,
          details: parsed.data.details ?? null,
          status: ReportStatus.PENDING,
        },
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Impossible d'enregistrer le signalement.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const photo = parsed.data.photoId
      ? store.photos.find((p) => p.id === parsed.data.photoId)
      : null;
    const targetUser = parsed.data.targetUserId
      ? store.users.find((u) => u.id === parsed.data.targetUserId)
      : null;

    store.reports.unshift({
      id: `rep-${Date.now()}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
      targetUserId: targetUser?.id ?? null,
      targetUserName: targetUser
        ? `${targetUser.firstName} ${targetUser.lastName}`
        : null,
      photoId: photo?.id ?? null,
      photoCaption: photo?.caption ?? null,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
      status: ReportStatus.PENDING,
      resolution: null,
      createdAt: new Date(),
      resolvedAt: null,
    });
  }

  revalidatePath("/retro");
  revalidatePath("/admin");

  return {
    success: true,
    message:
      "Votre signalement a été transmis aux modérateurs et administrateurs.",
  };
}
