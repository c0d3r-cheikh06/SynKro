import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function logAdminAudit(params: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        details: (params.details ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Impossible d'enregistrer le journal d'audit:", error);
  }
}

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link ?? null,
      },
    });
  } catch (error) {
    console.error("[Notification] Erreur lors de la création de notification:", error);
  }
}
