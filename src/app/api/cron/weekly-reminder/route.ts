import { AccountStatus, CycleStatus, EmailType, WeekStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getFallbackStore } from "@/lib/data-store";
import { sendTransactionalEmail } from "@/lib/email";
import { isDatabaseConnectionError, prisma } from "@/lib/prisma";

/**
 * Vercel Cron-compatible Route Handler (`GET /api/cron/weekly-reminder`).
 * Protected by `Authorization: Bearer <CRON_SECRET>`.
 * Sends weekly reminders with deduplication (`dedupeWindowMinutes: 720`).
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Non autorisé (CRON_SECRET requis)" },
      { status: 401 }
    );
  }

  let sentCount = 0;
  let failedCount = 0;

  try {
    const activeCycle = await prisma.matchingCycle.findFirst({
      where: { status: CycleStatus.ACTIVE },
      include: {
        weeks: {
          where: { status: WeekStatus.PUBLISHED },
          orderBy: { weekNumber: "desc" },
          take: 1,
        },
      },
    });

    const publishedWeek = activeCycle?.weeks[0];
    if (!activeCycle || !publishedWeek) {
      return NextResponse.json({
        ok: true,
        message: "Aucune semaine active publiée nécessitant un rappel.",
      });
    }

    const recipients = await prisma.user.findMany({
      where: {
        status: AccountStatus.ACTIVE,
        notifyEmail: true,
        notifyWeeklyReminder: true,
      },
      select: { id: true, email: true, firstName: true },
    });

    for (const r of recipients) {
      const res = await sendTransactionalEmail({
        userId: r.id,
        toEmail: r.email,
        subject: `Rappel Semaine ${publishedWeek.weekNumber} — Confirmez vos rencontres Synkro`,
        type: EmailType.WEEKLY_REMINDER,
        html: `<p>Bonjour ${r.firstName}, pensez à contacter vos 3 jumeaux de la Semaine ${publishedWeek.weekNumber} et à confirmer vos rencontres sur votre tableau de bord Synkro.</p>`,
        text: `Bonjour ${r.firstName}, pensez à confirmer vos rencontres de la Semaine ${publishedWeek.weekNumber} sur Synkro.`,
        dedupeWindowMinutes: 720,
      });

      if (res.success) sentCount++;
      else failedCount++;
    }

    return NextResponse.json({
      ok: true,
      weekNumber: publishedWeek.weekNumber,
      sentCount,
      failedCount,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      const store = getFallbackStore();
      return NextResponse.json({
        ok: true,
        mode: "fallback-memory",
        activeUsers: store.users.filter((u) => u.status === AccountStatus.ACTIVE)
          .length,
      });
    }
    return NextResponse.json(
      { error: "Erreur lors de l'exécution de la tâche planifiée" },
      { status: 500 }
    );
  }
}
