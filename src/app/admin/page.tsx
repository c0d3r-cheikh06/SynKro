import { ShieldCheck, Terminal } from "lucide-react";
import { Suspense } from "react";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { requireAdminOrModerator } from "@/lib/auth";
import { getAdminDashboardData } from "@/lib/data-store";
import { AdminDashboardClient } from "./AdminDashboardClient";

async function AdminPageContent() {
  const { user } = await requireAdminOrModerator();
  const data = await getAdminDashboardData();

  return (
    <div className="flex min-h-screen flex-col">
      <SynkroNavbar user={user} dbConnected={data.dbConnected} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="sk-card sk-animate-in relative mb-8 overflow-hidden p-6 sm:p-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#173B67] via-[#2563EB] to-[#60A5FA]" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="sk-badge sk-badge-primary">
                  <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Administration & Modération ({user.role})</span>
                </span>
                <span className="sk-badge sk-badge-neutral font-mono">
                  <Terminal aria-hidden="true" className="h-3 w-3" />
                  <span>Moteur k-facteur actif</span>
                </span>
              </div>

              <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
                Centre de Pilotage Synkro
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">
                Gérez les 5 anciennes classes, validez les inscriptions, générez et
                prévisualisez les jumelages hebdomadaires, et modérez
                l&apos;album rétrospectif.
              </p>
            </div>
          </div>
        </div>

        <div className="sk-animate-in sk-delay-1">
          <AdminDashboardClient
            currentUserRole={user.role}
            groups={data.groups}
            users={data.users}
            cycles={data.cycles}
            matches={data.matches}
            exclusions={data.exclusions}
            photos={data.photos}
            reports={data.reports}
            auditLogs={data.auditLogs}
            emailAttempts={data.emailAttempts}
            configs={data.configs}
          />
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          Chargement du centre d&apos;administration…
        </div>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
