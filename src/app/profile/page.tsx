import { History, UserCircle } from "lucide-react";
import { Suspense } from "react";
import { StudentAvatar } from "@/components/StudentAvatar";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { requireAuthenticatedUser } from "@/lib/auth";
import {
  getActiveGroups,
  getStudentDashboardData,
} from "@/lib/data-store";
import { ProfileForm } from "./ProfileForm";

async function ProfileContent() {
  const { user } = await requireAuthenticatedUser();
  const [dashboardData, { groups }] = await Promise.all([
    getStudentDashboardData(user.id),
    getActiveGroups(),
  ]);

  const allMatches = [
    ...dashboardData.currentWeekMatches,
    ...dashboardData.historicalMatches,
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SynkroNavbar user={user} dbConnected={dashboardData.dbConnected} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="sk-animate-in mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="sk-badge sk-badge-primary">
              <UserCircle aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Espace personnel</span>
            </span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Mon Profil Étudiant
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Personnalisez votre profil, choisissez un portrait de profil ou
              téléversez votre photo personnelle, et gérez vos préférences de
              notification.
            </p>
          </div>
        </div>

        <div className="sk-animate-in sk-delay-1">
          <ProfileForm
            user={dashboardData.user}
            groups={groups}
            allowNameEdit={dashboardData.allowNameEdit}
          />
        </div>

        {/* ==================== HISTORICAL MATCHES SUMMARY ==================== */}
        <section
          aria-labelledby="profile-history-heading"
          className="sk-card sk-animate-in sk-delay-2 mt-8 p-5 sm:p-7"
        >
          <h2
            id="profile-history-heading"
            className="flex items-center gap-2 text-base font-bold text-[var(--foreground)] sm:text-lg"
          >
            <History
              aria-hidden="true"
              className="h-4 w-4 text-[var(--primary)]"
            />
            <span>
              Mes jumelages sur le cycle ({allMatches.length})
            </span>
          </h2>

          {allMatches.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
              Aucun jumelage enregistré pour le moment.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allMatches.map((m) => {
                const partner =
                  m.studentA.id === user.id ? m.studentB : m.studentA;
                return (
                  <div
                    key={m.id}
                    className="sk-surface-muted flex items-center justify-between gap-2.5 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StudentAvatar
                        src={partner.image}
                        firstName={partner.firstName}
                        lastName={partner.lastName}
                        seedKey={partner.email || partner.id}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--foreground)]">
                          {partner.firstName} {partner.lastName}
                        </p>
                        <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                          {partner.groupName}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-[#173B67] px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                      Sem. {m.weekNumber}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          Chargement de votre profil…
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
