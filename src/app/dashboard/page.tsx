import { ConfirmationStatus } from "@prisma/client";
import {
  Bell,
  Camera,
  CheckCheck,
  CheckCircle2,
  Clock,
  History,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { markNotificationsReadAction } from "@/app/actions/student-actions";
import { OwlMascot } from "@/components/OwlMascot";
import { StudentAvatar } from "@/components/StudentAvatar";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { requireActiveMember } from "@/lib/auth";
import { getStudentDashboardData } from "@/lib/data-store";
import { StudentMatchCard } from "./StudentMatchCard";

async function DashboardContent() {
  const { user } = await requireActiveMember();
  const {
    dbConnected,
    currentCycle,
    currentWeek,
    currentWeekMatches,
    historicalMatches,
    notifications,
  } = await getStudentDashboardData(user.id);

  // Extract partners for current week
  const currentPartners = currentWeekMatches.map((m) => {
    const partner = m.studentA.id === user.id ? m.studentB : m.studentA;
    return {
      match: m,
      partner,
    };
  });

  // Compute personal participation metrics
  const allUserMatches = [...currentWeekMatches, ...historicalMatches];
  const mutualConfirmedCount = allUserMatches.filter(
    (m) =>
      m.confirmations.filter((c) => c.status === ConfirmationStatus.CONFIRMED)
        .length >= 2
  ).length;

  const unreadNotifs = notifications.filter((n) => !n.isRead);
  const currentWeekNumber = currentWeek?.weekNumber ?? 1;
  const totalWeeks = currentCycle?.totalWeeks ?? 6;
  const progressPercent = Math.min(
    100,
    Math.round((currentWeekNumber / totalWeeks) * 100)
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SynkroNavbar user={user} dbConnected={dbConnected} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* ==================== ZONE 1: COMPACT HEADER & CONSTELLATION PROGRESS ==================== */}
        <section
          aria-label="En-tête et progression du cycle"
          className="sk-card sk-edge sk-animate-in relative overflow-hidden p-5 sm:p-7"
        >
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <StudentAvatar
                src={user.image}
                firstName={user.firstName}
                lastName={user.lastName}
                seedKey={user.email || user.id}
                size="lg"
                accentColor={user.groupColor}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="sk-group-chip">
                    <span
                      className="sk-group-dot"
                      style={{
                        backgroundColor: user.groupColor || "#2563EB",
                      }}
                    />
                    <span>{user.groupName || "Ancienne classe"}</span>
                  </span>
                  <span className="sk-badge sk-badge-primary font-mono">
                    Semaine {currentWeekNumber} / {totalWeeks}
                  </span>
                </div>

                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
                  Bonjour, {user.firstName}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/profile"
                className="sk-btn sk-btn-secondary min-h-10 text-xs sm:text-sm"
              >
                <UserCircle
                  aria-hidden="true"
                  className="h-4 w-4 text-[var(--primary)]"
                />
                <span>Mon avatar</span>
              </Link>
              <Link
                href="/retro"
                className="sk-btn sk-btn-primary min-h-10 text-xs sm:text-sm"
              >
                <Camera aria-hidden="true" className="h-4 w-4" />
                <span>Album Rétro</span>
              </Link>
            </div>
          </div>

          {/* Compact 6-Node Constellation Progress Bar */}
          {currentCycle && (
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[var(--muted-foreground)]">
                  {currentCycle.name}
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--muted-foreground)]">
                  <CheckCircle2
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-[var(--success)]"
                  />
                  <strong className="text-[var(--foreground)]">
                    {mutualConfirmedCount}
                  </strong>{" "}
                  rencontre(s) validée(s)
                </span>
              </div>

              <div className="relative mt-3 flex items-center justify-between">
                {/* Constellation connecting track */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
                >
                  <div
                    className="sk-progress-fill h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {Array.from({ length: totalWeeks }, (_, idx) => idx + 1).map(
                  (wNum) => {
                    const wk = currentCycle.weeks.find(
                      (w) => w.weekNumber === wNum
                    );
                    const isCurrent = currentWeekNumber === wNum;
                    const isPublished =
                      wk?.status === "PUBLISHED" || wNum < currentWeekNumber;
                    return (
                      <div
                        key={wNum}
                        title={`Semaine ${wNum}${isCurrent ? " (en cours)" : ""}`}
                        className="relative z-10 flex flex-col items-center gap-1"
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold transition-all ${
                            isCurrent
                              ? "bg-[var(--primary-solid)] text-white ring-4 ring-[var(--primary-subtle)]"
                              : isPublished
                                ? "border border-[var(--primary)] bg-[var(--surface)] text-[var(--primary)]"
                                : "border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]"
                          }`}
                        >
                          {wNum}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </section>

        {/* ==================== ZONE 2: TES JUMELAGES (PRIMARY FOCUS) ==================== */}
        <section
          className="sk-animate-in sk-delay-1 mt-8"
          aria-labelledby="weekly-matches-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="weekly-matches-heading"
              className="text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-2xl"
            >
              Tes jumelages
            </h2>
            <span className="sk-badge sk-badge-neutral font-mono">
              {currentPartners.length} cette semaine
            </span>
          </div>

          {currentPartners.length === 0 ? (
            <div className="sk-card mt-4 flex flex-col items-center p-10 text-center">
              <OwlMascot size="lg" mood="empty" />
              <h3 className="mt-4 text-base font-bold text-[var(--foreground)]">
                Aucun jumelage publié pour cette semaine
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
                Dès que la prochaine semaine du cycle sera lancée, tes 3
                partenaires apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {currentPartners.map(({ match, partner }, idx) => (
                <StudentMatchCard
                  key={match.id}
                  matchId={match.id}
                  weekNumber={match.weekNumber}
                  currentUser={user}
                  partner={partner}
                  confirmations={match.confirmations}
                  index={idx}
                />
              ))}
            </div>
          )}
        </section>

        {/* ==================== ZONE 3: HISTORIQUE & NOTIFICATIONS (SECONDARY) ==================== */}
        <div className="sk-animate-in sk-delay-2 mt-10 grid gap-6 lg:grid-cols-12">
          {/* Historical Matches */}
          <section className="lg:col-span-7" aria-labelledby="history-heading">
            <div className="sk-card h-full p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="history-heading"
                  className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]"
                >
                  <History
                    aria-hidden="true"
                    className="h-4 w-4 text-[var(--primary)]"
                  />
                  <span>Historique des rencontres</span>
                </h2>
                <span className="sk-badge sk-badge-neutral font-mono">
                  {allUserMatches.length}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {allUserMatches.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                    Aucun historique disponible pour le moment.
                  </p>
                ) : (
                  allUserMatches.slice(0, 6).map((m) => {
                    const partner =
                      m.studentA.id === user.id ? m.studentB : m.studentA;
                    const myConf = m.confirmations.find(
                      (c) =>
                        c.userId === user.id &&
                        c.status === ConfirmationStatus.CONFIRMED
                    );
                    const partnerConf = m.confirmations.find(
                      (c) =>
                        c.userId === partner.id &&
                        c.status === ConfirmationStatus.CONFIRMED
                    );
                    const isMutual = Boolean(myConf && partnerConf);
                    return (
                      <div
                        key={m.id}
                        className="sk-surface-muted flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <StudentAvatar
                            src={partner.image}
                            firstName={partner.firstName}
                            lastName={partner.lastName}
                            seedKey={partner.email || partner.id}
                            size="xs"
                          />
                          <span className="font-mono text-xs font-semibold text-[var(--muted-foreground)]">
                            S{m.weekNumber}
                          </span>
                          <span className="truncate text-sm font-bold text-[var(--foreground)]">
                            {partner.firstName} {partner.lastName}
                          </span>
                          <span className="sk-group-chip hidden sm:inline-flex">
                            <span
                              className="sk-group-dot"
                              style={{
                                backgroundColor:
                                  partner.groupColor || "#2563EB",
                              }}
                            />
                            <span>{partner.groupName}</span>
                          </span>
                        </div>

                        <div>
                          {isMutual ? (
                            <span className="sk-badge sk-badge-success">
                              <CheckCircle2
                                aria-hidden="true"
                                className="h-3 w-3"
                              />
                              <span>Rencontre confirmée</span>
                            </span>
                          ) : myConf ? (
                            <span className="sk-badge sk-badge-primary">
                              <Clock aria-hidden="true" className="h-3 w-3" />
                              <span>En attente</span>
                            </span>
                          ) : (
                            <span className="sk-badge sk-badge-neutral">
                              <Clock aria-hidden="true" className="h-3 w-3" />
                              <span>À confirmer</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Notifications Center */}
          <section
            className="lg:col-span-5"
            aria-labelledby="notifications-heading"
          >
            <div className="sk-card h-full p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="notifications-heading"
                  className="flex items-center gap-2 text-base font-bold text-[var(--foreground)]"
                >
                  <Bell
                    aria-hidden="true"
                    className="h-4 w-4 text-[var(--primary)]"
                  />
                  <span>Notifications</span>
                  {unreadNotifs.length > 0 && (
                    <span className="rounded-full bg-[var(--primary-solid)] px-2 py-0.5 font-mono text-xs font-bold text-white">
                      {unreadNotifs.length}
                    </span>
                  )}
                </h2>

                {unreadNotifs.length > 0 && (
                  <form
                    action={async () => {
                      "use server";
                      await markNotificationsReadAction();
                    }}
                  >
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary-subtle)]"
                    >
                      <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>Tout lire</span>
                    </button>
                  </form>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                    Aucune notification récente.
                  </p>
                ) : (
                  notifications.slice(0, 4).map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-xl border p-3 text-xs transition-colors ${
                        n.isRead
                          ? "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]"
                          : "border-[var(--primary-subtle-border)] bg-[var(--primary-subtle)] text-[var(--foreground)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-[var(--foreground)]">
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                        )}
                      </div>
                      <p className="mt-1 leading-relaxed">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          <OwlMascot size="md" mood="thinking" />
          <span>Chargement de tes jumelages…</span>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
