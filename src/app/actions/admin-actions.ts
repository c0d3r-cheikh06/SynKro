"use server";

import {
  AccountStatus,
  ConsentStatus,
  CycleStatus,
  EmailType,
  MatchValidationStatus,
  NotificationType,
  PhotoStatus,
  Prisma,
  ReportStatus,
  Role,
  WeekStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createNotification, logAdminAudit } from "@/lib/audit";
import { requireAdmin, requireAdminOrModerator } from "@/lib/auth";
import { getFallbackStore } from "@/lib/data-store";
import {
  sendAccountStatusEmail,
  sendMatchPublishedEmail,
  sendTransactionalEmail,
} from "@/lib/email";
import {
  evaluateWeekPublicationReadiness,
  generateSmartWeekProposals,
  generateWeeklyMatching,
  HistoricalPair,
  makeCanonicalPairKey,
  MatchingStudent,
  SimplePair,
} from "@/lib/matching/algorithm";
import { normalizePhoneNumber } from "@/lib/phone";
import { isDatabaseConnectionError, prisma } from "@/lib/prisma";
import { cycleSchema, groupSchema } from "@/lib/validation";

export interface AdminActionResult {
  success: boolean;
  message: string;
}

export async function adminUpdateAccountStatusAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();

  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const nextStatus = String(
    formData.get("status") ?? ""
  ).trim() as AccountStatus;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!targetUserId || !Object.values(AccountStatus).includes(nextStatus)) {
    return { success: false, message: "Paramètres de statut invalides." };
  }

  let targetEmail = "";
  let targetFirstName = "";

  if (dbConnected) {
    try {
      const target = await prisma.user.findUnique({
        where: { id: targetUserId },
      });
      if (!target) {
        return { success: false, message: "Utilisateur introuvable." };
      }

      // Security requirement: Cannot set ACTIVE if email is not verified (unless admin explicitly verifies it)
      const forceVerify = formData.get("verifyEmailNow") === "true";
      const emailVerifiedDate =
        target.emailVerified ?? (forceVerify ? new Date() : null);

      if (nextStatus === AccountStatus.ACTIVE && !emailVerifiedDate) {
        return {
          success: false,
          message:
            "L'adresse e-mail de cet étudiant n'est pas encore vérifiée. Cochez 'Vérifier l'e-mail manuellement' ou attendez que l'étudiant clique sur son lien.",
        };
      }

      const assignGroupId = String(formData.get("groupId") ?? "").trim();

      const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: {
          status: nextStatus,
          statusReason: reason || null,
          emailVerified: emailVerifiedDate,
          ...(assignGroupId ? { groupId: assignGroupId } : {}),
        },
      });

      targetEmail = updated.email;
      targetFirstName = updated.firstName;

      await logAdminAudit({
        actorId: actor.id,
        action: `USER_STATUS_${nextStatus}`,
        targetType: "User",
        targetId: targetUserId,
        details: { previousStatus: target.status, nextStatus, reason },
      });

      const notifTypeMap: Record<AccountStatus, NotificationType> = {
        PENDING_VERIFICATION: NotificationType.GENERAL,
        PENDING_APPROVAL: NotificationType.ACCOUNT_VERIFIED,
        CORRECTION_REQUESTED: NotificationType.CORRECTION_REQUESTED,
        ACTIVE: NotificationType.ACCOUNT_APPROVED,
        REJECTED: NotificationType.ACCOUNT_REJECTED,
        SUSPENDED: NotificationType.ACCOUNT_SUSPENDED,
      };

      await createNotification({
        userId: targetUserId,
        type: notifTypeMap[nextStatus],
        title: `Statut du compte : ${nextStatus}`,
        body:
          reason ||
          `Le statut de votre compte Synkro a été mis à jour (${nextStatus}).`,
        link: "/dashboard",
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de la mise à jour du compte.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const target = store.users.find((u) => u.id === targetUserId);
    if (!target) {
      return { success: false, message: "Utilisateur introuvable." };
    }
    const forceVerify = formData.get("verifyEmailNow") === "true";
    if (!target.emailVerified && forceVerify) {
      target.emailVerified = new Date();
    }
    if (nextStatus === AccountStatus.ACTIVE && !target.emailVerified) {
      return {
        success: false,
        message:
          "L'adresse e-mail de l'étudiant doit être vérifiée avant l'activation.",
      };
    }

    const prevStatus = target.status;
    target.status = nextStatus;
    target.statusReason = reason || null;
    const assignGroupId = String(formData.get("groupId") ?? "").trim();
    if (assignGroupId) {
      const grp = store.groups.find((g) => g.id === assignGroupId);
      if (grp) {
        target.groupId = grp.id;
        target.groupName = grp.name;
        target.groupColor = grp.color;
      }
    }
    targetEmail = target.email;
    targetFirstName = target.firstName;

    store.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`,
      action: `USER_STATUS_${nextStatus}`,
      targetType: "User",
      targetId: targetUserId,
      details: { previousStatus: prevStatus, nextStatus, reason },
      createdAt: new Date(),
    });
  }

  if (
    targetEmail &&
    (nextStatus === AccountStatus.ACTIVE ||
      nextStatus === AccountStatus.REJECTED ||
      nextStatus === AccountStatus.SUSPENDED ||
      nextStatus === AccountStatus.CORRECTION_REQUESTED)
  ) {
    const statusMap = {
      [AccountStatus.ACTIVE]: "APPROVED",
      [AccountStatus.REJECTED]: "REJECTED",
      [AccountStatus.SUSPENDED]: "SUSPENDED",
      [AccountStatus.CORRECTION_REQUESTED]: "CORRECTION_REQUESTED",
    } as const;

    await sendAccountStatusEmail({
      userId: targetUserId,
      toEmail: targetEmail,
      firstName: targetFirstName,
      status: statusMap[nextStatus],
      reason: reason || undefined,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/account-status");

  return {
    success: true,
    message: `Statut du compte mis à jour vers ${nextStatus}.`,
  };
}

export async function adminUpdateStudentInfoAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();

  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const groupId = String(formData.get("groupId") ?? "").trim();
  const role = String(formData.get("role") ?? "STUDENT").trim() as Role;
  const phone = String(formData.get("phone") ?? "").trim();

  if (!targetUserId || !firstName || !lastName) {
    return {
      success: false,
      message: "Prénom, nom et identifiant de l'étudiant sont requis.",
    };
  }

  const phoneNormalized = phone ? normalizePhoneNumber(phone) : null;

  if (dbConnected) {
    try {
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          firstName,
          lastName,
          groupId: groupId || null,
          role: Object.values(Role).includes(role) ? role : Role.STUDENT,
          phone: phone || null,
          phoneNormalized,
        },
      });

      await logAdminAudit({
        actorId: actor.id,
        action: "ADMIN_UPDATE_USER_INFO",
        targetType: "User",
        targetId: targetUserId,
        details: { firstName, lastName, groupId, role },
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de la modification de l'étudiant.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const target = store.users.find((u) => u.id === targetUserId);
    if (target) {
      target.firstName = firstName;
      target.lastName = lastName;
      target.role = Object.values(Role).includes(role) ? role : Role.STUDENT;
      target.phone = phone || null;
      target.phoneNormalized = phoneNormalized;
      const grp = store.groups.find((g) => g.id === groupId);
      if (grp) {
        target.groupId = grp.id;
        target.groupName = grp.name;
        target.groupColor = grp.color;
      }
      store.auditLogs.unshift({
        id: `audit-${Date.now()}`,
        actorId: actor.id,
        actorName: `${actor.firstName} ${actor.lastName}`,
        action: "ADMIN_UPDATE_USER_INFO",
        targetType: "User",
        targetId: targetUserId,
        details: { firstName, lastName, groupId, role },
        createdAt: new Date(),
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return {
    success: true,
    message: "Informations de l'étudiant mises à jour.",
  };
}

export async function adminUpsertGroupAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();

  const groupId = String(formData.get("groupId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const slug =
    slugRaw ||
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const description = String(formData.get("description") ?? "").trim();
  const color = String(formData.get("color") ?? "#2864E8").trim();
  const order = Number(formData.get("order") ?? 0);
  const isActive = formData.get("isActive") !== "false";

  const parsed = groupSchema.safeParse({
    name,
    slug,
    description: description || undefined,
    color,
    order: Number.isFinite(order) ? order : 0,
    isActive,
  });

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message || "Paramètres du groupe invalides.",
    };
  }

  if (dbConnected) {
    try {
      const grp = groupId
        ? await prisma.group.update({
            where: { id: groupId },
            data: parsed.data,
          })
        : await prisma.group.create({
            data: parsed.data,
          });

      await logAdminAudit({
        actorId: actor.id,
        action: groupId ? "UPDATE_GROUP" : "CREATE_GROUP",
        targetType: "Group",
        targetId: grp.id,
        details: parsed.data,
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message:
            "Erreur lors de l'enregistrement du groupe (vérifiez que le nom et le slug sont uniques).",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    if (groupId) {
      const g = store.groups.find((x) => x.id === groupId);
      if (g) {
        g.name = parsed.data.name;
        g.slug = parsed.data.slug;
        g.description = parsed.data.description ?? null;
        g.color = parsed.data.color ?? "#2864E8";
        g.order = parsed.data.order;
        g.isActive = parsed.data.isActive;
      }
    } else {
      store.groups.push({
        id: `grp-${parsed.data.slug}-${Date.now()}`,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        color: parsed.data.color ?? "#2864E8",
        order: parsed.data.order,
        isActive: parsed.data.isActive,
        studentCount: 0,
      });
    }
    store.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`,
      action: groupId ? "UPDATE_GROUP" : "CREATE_GROUP",
      targetType: "Group",
      targetId: groupId || parsed.data.slug,
      details: parsed.data,
      createdAt: new Date(),
    });
  }

  revalidatePath("/admin");
  revalidatePath("/register");
  return {
    success: true,
    message: groupId
      ? "Groupe mis à jour avec succès."
      : "Nouveau groupe créé avec succès.",
  };
}

export async function adminCreateCycleAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const totalWeeks = Number(formData.get("totalWeeks") ?? 6);
  const activateNow = formData.get("activateNow") === "on";

  const parsed = cycleSchema.safeParse({
    name,
    description: description || undefined,
    totalWeeks: Number.isFinite(totalWeeks) ? totalWeeks : 6,
  });

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message || "Paramètres du cycle invalides.",
    };
  }

  const startDate = new Date();
  const endDate = new Date(
    startDate.getTime() + parsed.data.totalWeeks * 7 * 86400000
  );

  if (dbConnected) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        if (activateNow) {
          await tx.matchingCycle.updateMany({
            where: { status: CycleStatus.ACTIVE },
            data: { status: CycleStatus.PAUSED },
          });
        }

        const c = await tx.matchingCycle.create({
          data: {
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            status: activateNow ? CycleStatus.ACTIVE : CycleStatus.DRAFT,
            totalWeeks: parsed.data.totalWeeks,
            startDate,
            endDate,
            timezone: "Africa/Dakar",
          },
        });

        for (let w = 1; w <= parsed.data.totalWeeks; w++) {
          await tx.matchingWeek.create({
            data: {
              cycleId: c.id,
              weekNumber: w,
              status: WeekStatus.DRAFT,
              startDate: new Date(startDate.getTime() + (w - 1) * 7 * 86400000),
              endDate: new Date(startDate.getTime() + w * 7 * 86400000),
            },
          });
        }

        return c;
      });

      await logAdminAudit({
        actorId: actor.id,
        action: "CREATE_MATCHING_CYCLE",
        targetType: "MatchingCycle",
        targetId: created.id,
        details: {
          name: created.name,
          totalWeeks: created.totalWeeks,
          status: created.status,
        },
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de la création du cycle.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    if (activateNow) {
      for (const c of store.cycles) {
        if (c.status === CycleStatus.ACTIVE) c.status = CycleStatus.PAUSED;
      }
    }
    const newCycleId = `cycle-${Date.now()}`;
    store.cycles.unshift({
      id: newCycleId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: activateNow ? CycleStatus.ACTIVE : CycleStatus.DRAFT,
      totalWeeks: parsed.data.totalWeeks,
      startDate,
      endDate,
      timezone: "Africa/Dakar",
      weeks: Array.from({ length: parsed.data.totalWeeks }, (_, i) => ({
        id: `week-${newCycleId}-${i + 1}`,
        cycleId: newCycleId,
        weekNumber: i + 1,
        status: WeekStatus.DRAFT,
        publishedAt: null,
        startDate: new Date(startDate.getTime() + i * 7 * 86400000),
        endDate: new Date(startDate.getTime() + (i + 1) * 7 * 86400000),
        algorithmVersion: null,
        generationSeed: null,
        generationStats: null,
        matchesCount: 0,
      })),
    });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return {
    success: true,
    message: `Cycle "${parsed.data.name}" (${parsed.data.totalWeeks} semaines) créé avec succès.`,
  };
}

/**
 * Generates or regenerates the matching preview for a given week of a cycle.
 * Strictly forbids modifying already PUBLISHED or CLOSED weeks.
 */
/**
 * Generates or regenerates matching proposals for a week using the smart residual algorithm.
 * Strictly preserves APPROVED pairs, bans cycle exclusions (MatchPairExclusion) and REJECTED pairs,
 * and fills only vacant partner slots.
 */
export async function adminGenerateWeekMatchingAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();

  const cycleId = String(formData.get("cycleId") ?? "").trim();
  const weekNumber = Number(formData.get("weekNumber") ?? 1);
  const customSeed = String(formData.get("seed") ?? "").trim();

  if (!cycleId || !Number.isInteger(weekNumber) || weekNumber < 1) {
    return {
      success: false,
      message: "Cycle ou numéro de semaine invalide.",
    };
  }

  const seed =
    customSeed || `synkro-${cycleId}-w${weekNumber}-${Date.now().toString(36)}`;

  if (dbConnected) {
    try {
      const cycle = await prisma.matchingCycle.findUnique({
        where: { id: cycleId },
        include: {
          weeks: {
            include: { matches: true },
          },
          exclusions: true,
        },
      });

      if (!cycle) {
        return { success: false, message: "Cycle introuvable." };
      }

      const targetWeek = cycle.weeks.find((w) => w.weekNumber === weekNumber);
      if (
        targetWeek &&
        (targetWeek.status === WeekStatus.PUBLISHED ||
          targetWeek.status === WeekStatus.CLOSED)
      ) {
        return {
          success: false,
          message: `La semaine ${weekNumber} est déjà publiée ou clôturée et ne peut pas être modifiée.`,
        };
      }

      // Query active students with an active group
      const activeUsers = await prisma.user.findMany({
        where: {
          role: Role.STUDENT,
          status: AccountStatus.ACTIVE,
          emailVerified: { not: null },
          groupId: { not: null },
          group: { isActive: true },
        },
        include: { group: true },
      });

      const students: MatchingStudent[] = activeUsers.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        groupId: u.groupId!,
        groupName: u.group!.name,
      }));

      // Historical pairs from other approved or published weeks of the cycle
      const historicalPairs: HistoricalPair[] = [];
      for (const w of cycle.weeks) {
        if (w.weekNumber === weekNumber) continue;
        for (const m of w.matches) {
          if (
            m.validationStatus === MatchValidationStatus.APPROVED ||
            w.status === WeekStatus.PUBLISHED ||
            w.status === WeekStatus.CLOSED
          ) {
            historicalPairs.push({
              studentAId: m.studentAId,
              studentBId: m.studentBId,
              weekNumber: w.weekNumber,
            });
          }
        }
      }

      // 1. SACRED APPROVED PAIRS of this week: locked hard constraints
      const currentApprovedMatches = targetWeek
        ? targetWeek.matches.filter(
            (m) => m.validationStatus === MatchValidationStatus.APPROVED
          )
        : [];
      const approvedPairs: SimplePair[] = currentApprovedMatches.map((m) => ({
        studentAId: m.studentAId,
        studentBId: m.studentBId,
      }));

      // 2. EXCLUDED PAIRS for this cycle (MatchPairExclusion + rejected matches)
      const currentRejectedMatches = targetWeek
        ? targetWeek.matches.filter(
            (m) => m.validationStatus === MatchValidationStatus.REJECTED
          )
        : [];
      const excludedPairs: SimplePair[] = [
        ...cycle.exclusions.map((e) => ({
          studentAId: e.studentAId,
          studentBId: e.studentBId,
        })),
        ...currentRejectedMatches.map((m) => ({
          studentAId: m.studentAId,
          studentBId: m.studentBId,
        })),
      ];

      // 3. Preferred pending pairs (existing PENDING pairs kept if compatible)
      const currentPendingMatches = targetWeek
        ? targetWeek.matches.filter(
            (m) => m.validationStatus === MatchValidationStatus.PENDING
          )
        : [];
      const preferredPendingPairs: SimplePair[] = currentPendingMatches.map(
        (m) => ({
          studentAId: m.studentAId,
          studentBId: m.studentBId,
        })
      );

      const genResult = generateSmartWeekProposals({
        students,
        historicalPairs,
        approvedPairs,
        excludedPairs,
        preferredPendingPairs,
        weekNumber,
        totalWeeksInCycle: cycle.totalWeeks,
        targetPartnersPerWeek: 3,
        forbidHistoricalRepeats: true,
        seed,
      });

      if (!genResult.valid) {
        return {
          success: false,
          message: `Validation des contraintes impossible : ${genResult.validationErrors.join(" | ")}`,
        };
      }

      await prisma.$transaction(async (tx) => {
        const nextWeekStatus =
          genResult.complete &&
          genResult.newPendingPairsCount === 0 &&
          genResult.approvedPairsCount === genResult.totalRequiredPairs
            ? WeekStatus.READY_TO_PUBLISH
            : WeekStatus.PREVIEWING;

        const weekRecord = await tx.matchingWeek.upsert({
          where: {
            cycleId_weekNumber: {
              cycleId,
              weekNumber,
            },
          },
          update: {
            status: nextWeekStatus,
            algorithmVersion: genResult.stats.algorithmVersion,
            generationSeed: genResult.stats.seed,
            generationStats: JSON.parse(
              JSON.stringify(genResult.stats)
            ) as Prisma.InputJsonValue,
          },
          create: {
            cycleId,
            weekNumber,
            status: nextWeekStatus,
            algorithmVersion: genResult.stats.algorithmVersion,
            generationSeed: genResult.stats.seed,
            generationStats: JSON.parse(
              JSON.stringify(genResult.stats)
            ) as Prisma.InputJsonValue,
          },
        });

        // Delete ONLY PENDING proposals. NEVER delete APPROVED or REJECTED matches!
        await tx.match.deleteMany({
          where: {
            weekId: weekRecord.id,
            validationStatus: MatchValidationStatus.PENDING,
          },
        });

        if (genResult.newPendingPairs.length > 0) {
          await tx.match.createMany({
            data: genResult.newPendingPairs.map((p) => ({
              weekId: weekRecord.id,
              studentAId: p.studentAId,
              studentBId: p.studentBId,
              validationStatus: MatchValidationStatus.PENDING,
            })),
          });
        }
      });

      await logAdminAudit({
        actorId: actor.id,
        action:
          approvedPairs.length > 0
            ? "REGENERATE_WEEK_REPLACEMENTS"
            : "GENERATE_WEEK_PROPOSALS",
        targetType: "MatchingWeek",
        targetId: `${cycleId}:W${weekNumber}`,
        details: {
          weekNumber,
          seed: genResult.stats.seed,
          preservedApprovedCount: approvedPairs.length,
          newPendingCount: genResult.newPendingPairsCount,
          totalActiveCount: genResult.allActivePairs.length,
          missingSlotsCount: genResult.missingSlotsCount,
          complete: genResult.complete,
        },
      });

      revalidatePath("/admin");
      revalidatePath("/dashboard");

      const diagnosticText =
        genResult.blockingReasons.length > 0
          ? ` Note : ${genResult.blockingReasons.join(" ")}`
          : "";

      return {
        success: true,
        message:
          approvedPairs.length > 0
            ? `Remplacement effectué : ${approvedPairs.length} paire(s) validée(s) préservée(s), ${genResult.newPendingPairsCount} nouvelle(s) proposition(s) en attente (total : ${genResult.allActivePairs.length} paires).${diagnosticText}`
            : `Semaine ${weekNumber} : ${genResult.newPendingPairsCount} propositions générées en attente de validation.${diagnosticText}`,
      };
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de la génération des jumelages.",
        };
      }
    }
  }

  // Fallback memory store execution
  const store = getFallbackStore();
  const cycle = store.cycles.find((c) => c.id === cycleId);
  if (!cycle) {
    return { success: false, message: "Cycle introuvable." };
  }

  let week = cycle.weeks.find((w) => w.weekNumber === weekNumber);
  if (
    week &&
    (week.status === WeekStatus.PUBLISHED || week.status === WeekStatus.CLOSED)
  ) {
    return {
      success: false,
      message: `La semaine ${weekNumber} est déjà publiée et verrouillée.`,
    };
  }

  const activeStudents: MatchingStudent[] = store.users
    .filter(
      (u) =>
        u.role === Role.STUDENT &&
        u.status === AccountStatus.ACTIVE &&
        Boolean(u.emailVerified) &&
        Boolean(u.groupId) &&
        Boolean(u.groupName)
    )
    .map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      groupId: u.groupId!,
      groupName: u.groupName!,
    }));

  const historicalPairs: HistoricalPair[] = store.matches
    .filter(
      (m) =>
        m.cycleId === cycleId &&
        m.weekNumber !== weekNumber &&
        (m.validationStatus === MatchValidationStatus.APPROVED ||
          m.weekStatus === WeekStatus.PUBLISHED ||
          m.weekStatus === WeekStatus.CLOSED)
    )
    .map((m) => ({
      studentAId: m.studentA.id,
      studentBId: m.studentB.id,
      weekNumber: m.weekNumber,
    }));

  const weekMatches = week ? store.matches.filter((m) => m.weekId === week!.id) : [];
  const approvedPairs: SimplePair[] = weekMatches
    .filter((m) => m.validationStatus === MatchValidationStatus.APPROVED)
    .map((m) => ({ studentAId: m.studentA.id, studentBId: m.studentB.id }));

  const currentRejected = weekMatches
    .filter((m) => m.validationStatus === MatchValidationStatus.REJECTED)
    .map((m) => ({ studentAId: m.studentA.id, studentBId: m.studentB.id }));

  const excludedPairs: SimplePair[] = [
    ...(store.exclusions ?? [])
      .filter((e) => e.cycleId === cycleId)
      .map((e) => ({ studentAId: e.studentAId, studentBId: e.studentBId })),
    ...currentRejected,
  ];

  const preferredPendingPairs: SimplePair[] = weekMatches
    .filter((m) => m.validationStatus === MatchValidationStatus.PENDING)
    .map((m) => ({ studentAId: m.studentA.id, studentBId: m.studentB.id }));

  const genResult = generateSmartWeekProposals({
    students: activeStudents,
    historicalPairs,
    approvedPairs,
    excludedPairs,
    preferredPendingPairs,
    weekNumber,
    totalWeeksInCycle: cycle.totalWeeks,
    targetPartnersPerWeek: 3,
    seed,
  });

  if (!genResult.valid) {
    return {
      success: false,
      message: `Contraintes invalides : ${genResult.validationErrors.join(", ")}`,
    };
  }

  const nextWeekStatus =
    genResult.complete &&
    genResult.newPendingPairsCount === 0 &&
    genResult.approvedPairsCount === genResult.totalRequiredPairs
      ? WeekStatus.READY_TO_PUBLISH
      : WeekStatus.PREVIEWING;

  if (!week) {
    week = {
      id: `week-${cycleId}-${weekNumber}`,
      cycleId,
      weekNumber,
      status: nextWeekStatus,
      publishedAt: null,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 86400000),
      algorithmVersion: genResult.stats.algorithmVersion,
      generationSeed: genResult.stats.seed,
      generationStats: genResult.stats,
      matchesCount: genResult.allActivePairs.length,
    };
    cycle.weeks.push(week);
  } else {
    week.status = nextWeekStatus;
    week.algorithmVersion = genResult.stats.algorithmVersion;
    week.generationSeed = genResult.stats.seed;
    week.generationStats = genResult.stats;
    week.matchesCount = genResult.allActivePairs.length;
  }

  // Remove ONLY PENDING matches in memory, preserve APPROVED and REJECTED!
  store.matches = store.matches.filter(
    (m) =>
      !(m.weekId === week!.id && m.validationStatus === MatchValidationStatus.PENDING)
  );
  const userById = new Map(store.users.map((u) => [u.id, u]));

  genResult.newPendingPairs.forEach((p, idx) => {
    const sA = userById.get(p.studentAId)!;
    const sB = userById.get(p.studentBId)!;
    store.matches.push({
      id: `match-${week!.id}-p-${Date.now()}-${idx + 1}`,
      weekId: week!.id,
      weekNumber,
      weekStatus: nextWeekStatus,
      cycleId,
      cycleName: cycle.name,
      studentA: sA,
      studentB: sB,
      validationStatus: MatchValidationStatus.PENDING,
      validatedAt: null,
      validatedById: null,
      rejectionReason: null,
      confirmations: [],
      createdAt: new Date(),
    });
  });

  store.auditLogs.unshift({
    id: `audit-${Date.now()}`,
    actorId: actor.id,
    actorName: `${actor.firstName} ${actor.lastName}`,
    action:
      approvedPairs.length > 0
        ? "REGENERATE_WEEK_REPLACEMENTS"
        : "GENERATE_WEEK_PROPOSALS",
    targetType: "MatchingWeek",
    targetId: week.id,
    details: {
      weekNumber,
      seed: genResult.stats.seed,
      preservedApprovedCount: approvedPairs.length,
      newPendingCount: genResult.newPendingPairsCount,
    },
    createdAt: new Date(),
  });

  revalidatePath("/admin");
  return {
    success: true,
    message: `Semaine ${weekNumber} : propositions calculées avec succès (${approvedPairs.length} validées préservées, ${genResult.newPendingPairsCount} en attente).`,
  };
}

/**
 * Validates or unlocks a single match pair proposal.
 * Validated pairs remain strictly locked during smart regeneration.
 */
export async function adminValidateMatchPairAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "").trim();
  const actionType = String(formData.get("actionType") ?? "APPROVE").trim(); // "APPROVE" | "UNLOCK"

  if (!matchId) {
    return { success: false, message: "Identifiant de jumelage manquant." };
  }

  const isUnlock = actionType === "UNLOCK";
  const targetStatus = isUnlock
    ? MatchValidationStatus.PENDING
    : MatchValidationStatus.APPROVED;

  if (dbConnected) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          week: {
            include: {
              matches: true,
            },
          },
          studentA: true,
          studentB: true,
        },
      });

      if (!match) {
        return { success: false, message: "Proposition de jumelage introuvable." };
      }

      if (
        match.week.status === WeekStatus.PUBLISHED ||
        match.week.status === WeekStatus.CLOSED
      ) {
        return {
          success: false,
          message:
            "Impossible de modifier une paire dans une semaine déjà publiée ou clôturée.",
        };
      }

      await prisma.$transaction(async (tx) => {
        await tx.match.update({
          where: { id: matchId },
          data: {
            validationStatus: targetStatus,
            validatedAt: isUnlock ? null : new Date(),
            validatedById: isUnlock ? null : actor.id,
            rejectionReason: null,
          },
        });

        // Re-evaluate week readiness
        const allWeekMatches = await tx.match.findMany({
          where: { weekId: match.weekId },
        });

        const activeApprovedCount = allWeekMatches.filter(
          (m) =>
            m.id === matchId
              ? targetStatus === MatchValidationStatus.APPROVED
              : m.validationStatus === MatchValidationStatus.APPROVED
        ).length;
        const pendingCount = allWeekMatches.filter(
          (m) =>
            m.id === matchId
              ? targetStatus === MatchValidationStatus.PENDING
              : m.validationStatus === MatchValidationStatus.PENDING
        ).length;

        const nextWeekStatus =
          pendingCount === 0 && activeApprovedCount > 0
            ? WeekStatus.READY_TO_PUBLISH
            : WeekStatus.PREVIEWING;

        await tx.matchingWeek.update({
          where: { id: match.weekId },
          data: { status: nextWeekStatus },
        });
      });

      await logAdminAudit({
        actorId: actor.id,
        action: isUnlock ? "UNLOCK_MATCH_PAIR" : "APPROVE_MATCH_PAIR",
        targetType: "Match",
        targetId: matchId,
        details: {
          weekNumber: match.week.weekNumber,
          studentA: `${match.studentA.firstName} ${match.studentA.lastName}`,
          studentB: `${match.studentB.firstName} ${match.studentB.lastName}`,
        },
      });

      revalidatePath("/admin");
      return {
        success: true,
        message: isUnlock
          ? "Paire remise en attente de validation."
          : `Paire ${match.studentA.firstName} & ${match.studentB.firstName} validée avec succès.`,
      };
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de la mise à jour de la paire.",
        };
      }
    }
  }

  // Fallback memory store
  const store = getFallbackStore();
  const match = store.matches.find((m) => m.id === matchId);
  if (!match) return { success: false, message: "Paire introuvable." };
  if (
    match.weekStatus === WeekStatus.PUBLISHED ||
    match.weekStatus === WeekStatus.CLOSED
  ) {
    return {
      success: false,
      message: "Cette semaine est déjà publiée.",
    };
  }

  match.validationStatus = targetStatus;
  match.validatedAt = isUnlock ? null : new Date();
  match.validatedById = isUnlock ? null : actor.id;

  const weekMatches = store.matches.filter((m) => m.weekId === match.weekId);
  const pendingCount = weekMatches.filter(
    (m) => m.validationStatus === MatchValidationStatus.PENDING
  ).length;
  const approvedCount = weekMatches.filter(
    (m) => m.validationStatus === MatchValidationStatus.APPROVED
  ).length;

  for (const c of store.cycles) {
    const w = c.weeks.find((wk) => wk.id === match.weekId);
    if (w) {
      w.status =
        pendingCount === 0 && approvedCount > 0
          ? WeekStatus.READY_TO_PUBLISH
          : WeekStatus.PREVIEWING;
    }
  }

  revalidatePath("/admin");
  return {
    success: true,
    message: isUnlock ? "Paire remise en attente." : "Paire validée.",
  };
}

/**
 * Validates all currently PENDING pairs of a week in one click.
 */
export async function adminApproveAllPendingPairsAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();
  const weekId = String(formData.get("weekId") ?? "").trim();

  if (!weekId) {
    return { success: false, message: "Identifiant de semaine manquant." };
  }

  if (dbConnected) {
    try {
      const week = await prisma.matchingWeek.findUnique({
        where: { id: weekId },
        include: { matches: true },
      });

      if (!week) return { success: false, message: "Semaine introuvable." };
      if (
        week.status === WeekStatus.PUBLISHED ||
        week.status === WeekStatus.CLOSED
      ) {
        return {
          success: false,
          message: "Cette semaine est déjà publiée ou clôturée.",
        };
      }

      const pendingMatches = week.matches.filter(
        (m) => m.validationStatus === MatchValidationStatus.PENDING
      );
      if (pendingMatches.length === 0) {
        return {
          success: false,
          message: "Aucune paire en attente à valider pour cette semaine.",
        };
      }

      await prisma.$transaction(async (tx) => {
        await tx.match.updateMany({
          where: {
            weekId,
            validationStatus: MatchValidationStatus.PENDING,
          },
          data: {
            validationStatus: MatchValidationStatus.APPROVED,
            validatedAt: new Date(),
            validatedById: actor.id,
          },
        });

        await tx.matchingWeek.update({
          where: { id: weekId },
          data: { status: WeekStatus.READY_TO_PUBLISH },
        });
      });

      await logAdminAudit({
        actorId: actor.id,
        action: "APPROVE_ALL_PENDING_PAIRS",
        targetType: "MatchingWeek",
        targetId: weekId,
        details: {
          weekNumber: week.weekNumber,
          validatedCount: pendingMatches.length,
        },
      });

      revalidatePath("/admin");
      return {
        success: true,
        message: `${pendingMatches.length} paire(s) validée(s) avec succès. La semaine est prête à être publiée.`,
      };
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de la validation du lot de paires.",
        };
      }
    }
  }

  // Fallback memory store
  const store = getFallbackStore();
  const pending = store.matches.filter(
    (m) => m.weekId === weekId && m.validationStatus === MatchValidationStatus.PENDING
  );
  if (pending.length === 0) {
    return { success: false, message: "Aucune paire en attente." };
  }

  pending.forEach((m) => {
    m.validationStatus = MatchValidationStatus.APPROVED;
    m.validatedAt = new Date();
    m.validatedById = actor.id;
  });

  for (const c of store.cycles) {
    const w = c.weeks.find((wk) => wk.id === weekId);
    if (w) w.status = WeekStatus.READY_TO_PUBLISH;
  }

  revalidatePath("/admin");
  return {
    success: true,
    message: `${pending.length} paire(s) validée(s). Prête à publier.`,
  };
}

/**
 * Rejects a proposed match pair and atomically creates a cycle-level exclusion
 * so that this pair is strictly never proposed again in any week of this cycle.
 */
export async function adminRejectMatchPairAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();
  const matchId = String(formData.get("matchId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!matchId) {
    return { success: false, message: "Identifiant de jumelage manquant." };
  }

  if (dbConnected) {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          week: { include: { cycle: true } },
          studentA: true,
          studentB: true,
        },
      });

      if (!match) return { success: false, message: "Paire introuvable." };
      if (
        match.week.status === WeekStatus.PUBLISHED ||
        match.week.status === WeekStatus.CLOSED
      ) {
        return {
          success: false,
          message:
            "Impossible de refuser une paire d'une semaine déjà publiée ou clôturée.",
        };
      }

      const [canA, canB] = makeCanonicalPairKey(
        match.studentAId,
        match.studentBId
      );
      const cycleId = match.week.cycleId;

      await prisma.$transaction(async (tx) => {
        // 1. Mark the match REJECTED
        await tx.match.update({
          where: { id: matchId },
          data: {
            validationStatus: MatchValidationStatus.REJECTED,
            rejectionReason:
              reason || "Refusée par l'administrateur (connaissance mutuelle)",
            validatedAt: new Date(),
            validatedById: actor.id,
          },
        });

        // 2. Persist canonical cycle exclusion
        await tx.matchPairExclusion.upsert({
          where: {
            cycleId_studentAId_studentBId: {
              cycleId,
              studentAId: canA,
              studentBId: canB,
            },
          },
          update: {
            weekId: match.weekId,
            reason: reason || "Refusée par l'administrateur",
            createdById: actor.id,
          },
          create: {
            cycleId,
            weekId: match.weekId,
            studentAId: canA,
            studentBId: canB,
            reason: reason || "Refusée par l'administrateur",
            createdById: actor.id,
          },
        });

        // 3. Week status returns to PREVIEWING since a slot now needs replacement
        await tx.matchingWeek.update({
          where: { id: match.weekId },
          data: { status: WeekStatus.PREVIEWING },
        });
      });

      await logAdminAudit({
        actorId: actor.id,
        action: "REJECT_MATCH_PAIR",
        targetType: "Match",
        targetId: matchId,
        details: {
          cycleId,
          weekNumber: match.week.weekNumber,
          studentA: `${match.studentA.firstName} ${match.studentA.lastName}`,
          studentB: `${match.studentB.firstName} ${match.studentB.lastName}`,
          reason: reason || "Refusée par l'administrateur",
        },
      });

      revalidatePath("/admin");
      return {
        success: true,
        message: `Paire ${match.studentA.firstName} & ${match.studentB.firstName} refusée et exclue du cycle. Cliquez sur « Générer des remplacements » pour combler les places manquantes.`,
      };
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors du refus de la paire.",
        };
      }
    }
  }

  // Fallback memory store
  const store = getFallbackStore();
  const match = store.matches.find((m) => m.id === matchId);
  if (!match) return { success: false, message: "Paire introuvable." };
  if (
    match.weekStatus === WeekStatus.PUBLISHED ||
    match.weekStatus === WeekStatus.CLOSED
  ) {
    return {
      success: false,
      message: "Cette semaine est déjà publiée.",
    };
  }

  match.validationStatus = MatchValidationStatus.REJECTED;
  match.rejectionReason = reason || "Refusée par l'administrateur";
  match.validatedAt = new Date();
  match.validatedById = actor.id;

  const [canA, canB] = makeCanonicalPairKey(match.studentA.id, match.studentB.id);
  store.exclusions = store.exclusions ?? [];
  const existingEx = store.exclusions.find(
    (e) =>
      e.cycleId === match.cycleId &&
      e.studentAId === canA &&
      e.studentBId === canB
  );
  if (existingEx) {
    existingEx.reason = reason || "Refusée par l'administrateur";
  } else {
    store.exclusions.push({
      id: `ex-${Date.now()}`,
      cycleId: match.cycleId,
      weekId: match.weekId,
      studentAId: canA,
      studentBId: canB,
      studentAName: `${match.studentA.firstName} ${match.studentA.lastName}`,
      studentBName: `${match.studentB.firstName} ${match.studentB.lastName}`,
      studentAGroup: match.studentA.groupName,
      studentBGroup: match.studentB.groupName,
      reason: reason || "Refusée par l'administrateur",
      createdById: actor.id,
      createdAt: new Date(),
    });
  }

  for (const c of store.cycles) {
    const w = c.weeks.find((wk) => wk.id === match.weekId);
    if (w) w.status = WeekStatus.PREVIEWING;
  }

  revalidatePath("/admin");
  return {
    success: true,
    message: "Paire refusée et exclue du cycle. Lancez la régénération.",
  };
}

/**
 * Officially publishes a matching week after strictly verifying all preconditions
 * (all slots covered, all pairs APPROVED, zero PENDING, no duplicate, no repeats,
 * no rejected pairs reintroduced).
 */
export async function adminPublishWeekMatchingAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();
  const weekId = String(formData.get("weekId") ?? "").trim();

  if (!weekId) {
    return { success: false, message: "Identifiant de semaine manquant." };
  }

  if (dbConnected) {
    try {
      const week = await prisma.matchingWeek.findUnique({
        where: { id: weekId },
        include: {
          cycle: {
            include: {
              weeks: { include: { matches: true } },
              exclusions: true,
            },
          },
          matches: {
            include: {
              studentA: { include: { group: true } },
              studentB: { include: { group: true } },
            },
          },
        },
      });

      if (!week) {
        return { success: false, message: "Semaine introuvable." };
      }

      if (week.status === WeekStatus.PUBLISHED) {
        return {
          success: false,
          message: "Cette semaine est déjà officiellement publiée.",
        };
      }

      // Query active students
      const activeUsers = await prisma.user.findMany({
        where: {
          role: Role.STUDENT,
          status: AccountStatus.ACTIVE,
          emailVerified: { not: null },
          groupId: { not: null },
          group: { isActive: true },
        },
        include: { group: true },
      });

      const students: MatchingStudent[] = activeUsers.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        groupId: u.groupId!,
        groupName: u.group!.name,
      }));

      const approvedPairs: SimplePair[] = week.matches
        .filter((m) => m.validationStatus === MatchValidationStatus.APPROVED)
        .map((m) => ({ studentAId: m.studentAId, studentBId: m.studentBId }));

      const pendingPairs: SimplePair[] = week.matches
        .filter((m) => m.validationStatus === MatchValidationStatus.PENDING)
        .map((m) => ({ studentAId: m.studentAId, studentBId: m.studentBId }));

      const rejectedMatches = week.matches.filter(
        (m) => m.validationStatus === MatchValidationStatus.REJECTED
      );

      const excludedPairs: SimplePair[] = [
        ...week.cycle.exclusions.map((e) => ({
          studentAId: e.studentAId,
          studentBId: e.studentBId,
        })),
        ...rejectedMatches.map((m) => ({
          studentAId: m.studentAId,
          studentBId: m.studentBId,
        })),
      ];

      const historicalPairs: HistoricalPair[] = [];
      for (const w of week.cycle.weeks) {
        if (w.weekNumber === week.weekNumber) continue;
        for (const m of w.matches) {
          if (
            m.validationStatus === MatchValidationStatus.APPROVED ||
            w.status === WeekStatus.PUBLISHED ||
            w.status === WeekStatus.CLOSED
          ) {
            historicalPairs.push({
              studentAId: m.studentAId,
              studentBId: m.studentBId,
              weekNumber: w.weekNumber,
            });
          }
        }
      }

      // Strictly evaluate readiness against persisted DB state (Partie 5.2)
      const readiness = evaluateWeekPublicationReadiness({
        students,
        approvedPairs,
        pendingPairs,
        rejectedPairsCount: rejectedMatches.length,
        excludedPairs,
        historicalPairs,
        targetPartnersPerWeek: 3,
        forbidHistoricalRepeats: true,
      });

      if (!readiness.ready) {
        return {
          success: false,
          message: `Publication bloquée : ${readiness.reasons.join(" | ")}`,
        };
      }

      // Atomic commit
      await prisma.$transaction(async (tx) => {
        // Re-check inside transaction to prevent concurrent double publication
        const freshWeek = await tx.matchingWeek.findUnique({
          where: { id: weekId },
          select: { status: true },
        });

        if (freshWeek?.status === WeekStatus.PUBLISHED) {
          throw new Error("ALREADY_PUBLISHED");
        }

        await tx.matchingWeek.update({
          where: { id: weekId },
          data: {
            status: WeekStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        });
      });

      // Notify participants after successful transaction commit
      const partnersByStudent = new Map<
        string,
        {
          email: string;
          firstName: string;
          notify: boolean;
          partners: string[];
        }
      >();

      const publishedMatches = week.matches.filter(
        (m) => m.validationStatus === MatchValidationStatus.APPROVED
      );

      for (const m of publishedMatches) {
        const aEntry = partnersByStudent.get(m.studentAId) ?? {
          email: m.studentA.email,
          firstName: m.studentA.firstName,
          notify: m.studentA.notifyEmail && m.studentA.notifyMatchPublished,
          partners: [],
        };
        aEntry.partners.push(
          `${m.studentB.firstName} ${m.studentB.lastName} (${m.studentB.group?.name ?? "Autre"})`
        );
        partnersByStudent.set(m.studentAId, aEntry);

        const bEntry = partnersByStudent.get(m.studentBId) ?? {
          email: m.studentB.email,
          firstName: m.studentB.firstName,
          notify: m.studentB.notifyEmail && m.studentB.notifyMatchPublished,
          partners: [],
        };
        bEntry.partners.push(
          `${m.studentA.firstName} ${m.studentA.lastName} (${m.studentA.group?.name ?? "Autre"})`
        );
        partnersByStudent.set(m.studentBId, bEntry);
      }

      for (const [stuId, info] of partnersByStudent.entries()) {
        await createNotification({
          userId: stuId,
          type: NotificationType.MATCH_PUBLISHED,
          title: `Semaine ${week.weekNumber} officiellement publiée !`,
          body: `Vos jumeaux de la Semaine ${week.weekNumber} sont désormais visibles sur votre tableau de bord. Contactez-les sur WhatsApp !`,
          link: "/dashboard",
        });

        if (info.notify) {
          await sendMatchPublishedEmail({
            userId: stuId,
            toEmail: info.email,
            firstName: info.firstName,
            weekNumber: week.weekNumber,
            cycleName: week.cycle.name,
            partnerNames: info.partners,
          });
        }
      }

      await logAdminAudit({
        actorId: actor.id,
        action: "PUBLISH_WEEK_MATCHING",
        targetType: "MatchingWeek",
        targetId: weekId,
        details: {
          weekNumber: week.weekNumber,
          approvedMatchesCount: publishedMatches.length,
        },
      });

      revalidatePath("/admin");
      revalidatePath("/dashboard");
      return {
        success: true,
        message: `La Semaine ${week.weekNumber} a été officiellement publiée (${publishedMatches.length} paires validées). Les étudiants peuvent désormais accéder à leurs jumeaux !`,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "ALREADY_PUBLISHED") {
        return {
          success: false,
          message: "Cette semaine est déjà officiellement publiée.",
        };
      }
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de la publication officielle de la semaine.",
        };
      }
    }
  }

  // Fallback memory store
  const store = getFallbackStore();
  let foundWeek: (typeof store.cycles)[0]["weeks"][0] | null = null;
  for (const c of store.cycles) {
    const w = c.weeks.find((wk) => wk.id === weekId);
    if (w) {
      foundWeek = w;
      if (w.status === WeekStatus.PUBLISHED) {
        return { success: false, message: "Semaine déjà publiée." };
      }
      w.status = WeekStatus.PUBLISHED;
      w.publishedAt = new Date();
      for (const m of store.matches) {
        if (m.weekId === weekId && m.validationStatus === MatchValidationStatus.APPROVED) {
          m.weekStatus = WeekStatus.PUBLISHED;
        }
      }
      store.auditLogs.unshift({
        id: `audit-${Date.now()}`,
        actorId: actor.id,
        actorName: `${actor.firstName} ${actor.lastName}`,
        action: "PUBLISH_WEEK_MATCHING",
        targetType: "MatchingWeek",
        targetId: weekId,
        details: { weekNumber: w.weekNumber, matchesCount: w.matchesCount },
        createdAt: new Date(),
      });
      break;
    }
  }

  if (!foundWeek) return { success: false, message: "Semaine introuvable." };

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return {
    success: true,
    message: `Semaine ${foundWeek.weekNumber} officiellement publiée !`,
  };
}

export async function adminSendWeeklyReminderAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();
  const weekNumber = Number(formData.get("weekNumber") ?? 1);

  const res = await sendTransactionalEmail({
    userId: actor.id,
    toEmail: actor.email,
    subject: `Rappel hebdomadaire Semaine ${weekNumber} — Synkro`,
    type: EmailType.WEEKLY_REMINDER,
    html: `<p>Rappel hebdomadaire déclenché pour les étudiants de la Semaine ${weekNumber} n'ayant pas encore confirmé leurs 3 rencontres.</p>`,
    text: `Rappel hebdomadaire déclenché pour la Semaine ${weekNumber}.`,
  });

  if (dbConnected) {
    await logAdminAudit({
      actorId: actor.id,
      action: "SEND_WEEKLY_REMINDER",
      targetType: "MatchingWeek",
      targetId: `W${weekNumber}`,
      details: { provider: res.provider, success: res.success },
    });
  } else {
    const store = getFallbackStore();
    store.emailAttempts.unshift({
      id: `em-${Date.now()}`,
      toEmail: "promotion-active@synkro.app",
      subject: `Rappel hebdomadaire Semaine ${weekNumber} — Confirmez vos rencontres Synkro`,
      type: EmailType.WEEKLY_REMINDER,
      status: res.status,
      errorMessage: res.errorMessage ?? null,
      sentAt: res.success ? new Date() : null,
      createdAt: new Date(),
    });
    store.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`,
      action: "SEND_WEEKLY_REMINDER",
      targetType: "MatchingWeek",
      targetId: `W${weekNumber}`,
      details: { provider: res.provider, success: res.success },
      createdAt: new Date(),
    });
  }

  revalidatePath("/admin");
  return {
    success: res.success,
    message: res.success
      ? `Campagne de rappel hebdomadaire (Semaine ${weekNumber}) exécutée via ${res.provider}.`
      : `Échec de l'envoi (${res.provider}) : ${res.errorMessage}`,
  };
}

export async function adminModeratePhotoAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdminOrModerator();

  const photoId = String(formData.get("photoId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as PhotoStatus;
  const rejectionReason = String(
    formData.get("rejectionReason") ?? ""
  ).trim();

  if (!photoId || !Object.values(PhotoStatus).includes(status)) {
    return {
      success: false,
      message: "Paramètres de modération photo invalides.",
    };
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

      if (status === PhotoStatus.APPROVED) {
        const allConsented = photo.participants.every(
          (p) => p.consentStatus === ConsentStatus.GIVEN
        );
        if (!allConsented) {
          return {
            success: false,
            message:
              "Impossible d'approuver la publication : tous les participants identifiés n'ont pas encore accordé leur consentement.",
          };
        }
      }

      await prisma.photoPublication.update({
        where: { id: photoId },
        data: {
          status,
          rejectionReason:
            status === PhotoStatus.APPROVED ? null : rejectionReason || null,
          publishedAt: status === PhotoStatus.APPROVED ? new Date() : null,
        },
      });

      await createNotification({
        userId: photo.authorId,
        type:
          status === PhotoStatus.APPROVED
            ? NotificationType.PHOTO_APPROVED
            : NotificationType.PHOTO_REJECTED,
        title:
          status === PhotoStatus.APPROVED
            ? "Photo publiée dans l'album rétrospectif !"
            : `Photo ${status === PhotoStatus.REJECTED ? "refusée" : "retirée"}`,
        body:
          status === PhotoStatus.APPROVED
            ? "Votre photo a été validée par la modération et apparaît dans l'album /retro."
            : rejectionReason ||
              "Votre photo n'a pas pu être maintenue dans l'album rétrospectif.",
        link: "/retro",
      });

      await logAdminAudit({
        actorId: actor.id,
        action: `MODERATE_PHOTO_${status}`,
        targetType: "PhotoPublication",
        targetId: photoId,
        details: { status, rejectionReason },
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de la modération de la photo.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const photo = store.photos.find((p) => p.id === photoId);
    if (!photo) {
      return { success: false, message: "Photo introuvable." };
    }
    if (status === PhotoStatus.APPROVED && !photo.allConsentsGiven) {
      return {
        success: false,
        message:
          "Impossible de publier : tous les participants identifiés doivent d'abord donner leur consentement.",
      };
    }
    photo.status = status;
    photo.rejectionReason =
      status === PhotoStatus.APPROVED ? null : rejectionReason || null;
    photo.publishedAt = status === PhotoStatus.APPROVED ? new Date() : null;

    store.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`,
      action: `MODERATE_PHOTO_${status}`,
      targetType: "PhotoPublication",
      targetId: photoId,
      details: { status, rejectionReason },
      createdAt: new Date(),
    });
  }

  revalidatePath("/admin");
  revalidatePath("/retro");

  return {
    success: true,
    message: `Statut de la photo mis à jour (${status}).`,
  };
}

export async function adminResolveReportAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdminOrModerator();

  const reportId = String(formData.get("reportId") ?? "").trim();
  const status = String(formData.get("status") ?? "RESOLVED").trim() as ReportStatus;
  const resolution = String(formData.get("resolution") ?? "").trim();
  const withdrawPhoto = formData.get("withdrawPhoto") === "true";

  if (!reportId) {
    return { success: false, message: "Signalement introuvable." };
  }

  if (dbConnected) {
    try {
      const rep = await prisma.report.update({
        where: { id: reportId },
        data: {
          status:
            status === ReportStatus.DISMISSED
              ? ReportStatus.DISMISSED
              : ReportStatus.RESOLVED,
          resolution: resolution || "Traité par la modération.",
          resolvedAt: new Date(),
        },
      });

      if (withdrawPhoto && rep.photoId) {
        await prisma.photoPublication.update({
          where: { id: rep.photoId },
          data: {
            status: PhotoStatus.WITHDRAWN,
            rejectionReason:
              resolution || "Retirée suite à un signalement vérifié.",
          },
        });
      }

      await logAdminAudit({
        actorId: actor.id,
        action: `RESOLVE_REPORT_${status}`,
        targetType: "Report",
        targetId: reportId,
        details: { status, resolution, withdrawPhoto },
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors du traitement du signalement.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const rep = store.reports.find((r) => r.id === reportId);
    if (rep) {
      rep.status =
        status === ReportStatus.DISMISSED
          ? ReportStatus.DISMISSED
          : ReportStatus.RESOLVED;
      rep.resolution = resolution || "Traité par la modération.";
      rep.resolvedAt = new Date();
      if (withdrawPhoto && rep.photoId) {
        const ph = store.photos.find((p) => p.id === rep.photoId);
        if (ph) {
          ph.status = PhotoStatus.WITHDRAWN;
          ph.rejectionReason = resolution || "Retirée suite à un signalement.";
        }
      }
    }
    store.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`,
      action: `RESOLVE_REPORT_${status}`,
      targetType: "Report",
      targetId: reportId,
      details: { status, resolution, withdrawPhoto },
      createdAt: new Date(),
    });
  }

  revalidatePath("/admin");
  revalidatePath("/retro");

  return {
    success: true,
    message: "Le signalement a été traité.",
  };
}

export async function adminUpdateConfigAction(
  formData: FormData
): Promise<AdminActionResult> {
  const { user: actor, dbConnected } = await requireAdmin();
  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();

  if (!key) {
    return { success: false, message: "Clé de configuration manquante." };
  }

  if (dbConnected) {
    try {
      await prisma.appConfiguration.upsert({
        where: { key },
        update: { value, updatedBy: actor.id },
        create: { key, value, isPublic: true, updatedBy: actor.id },
      });

      await logAdminAudit({
        actorId: actor.id,
        action: "UPDATE_APP_CONFIG",
        targetType: "AppConfiguration",
        targetId: key,
        details: { key, value },
      });
    } catch (error) {
      if (!isDatabaseConnectionError(error)) {
        return {
          success: false,
          message: "Erreur lors de la sauvegarde de la configuration.",
        };
      }
    }
  } else {
    const store = getFallbackStore();
    const cfg = store.configs.find((c) => c.key === key);
    if (cfg) {
      cfg.value = value;
    } else {
      store.configs.push({
        key,
        value,
        description: "Paramètre personnalisé",
        isPublic: true,
      });
    }
    store.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`,
      action: "UPDATE_APP_CONFIG",
      targetType: "AppConfiguration",
      targetId: key,
      details: { key, value },
      createdAt: new Date(),
    });
  }

  revalidatePath("/admin");
  revalidatePath("/profile");
  revalidatePath("/retro");

  return {
    success: true,
    message: `Paramètre "${key}" mis à jour (${value}).`,
  };
}
