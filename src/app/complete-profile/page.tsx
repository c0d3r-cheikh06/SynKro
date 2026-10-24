import { Sparkles } from "lucide-react";
import { Suspense } from "react";
import { OwlMascot } from "@/components/OwlMascot";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { requirePhoneOnboardingUser } from "@/lib/auth";
import { getActiveGroups } from "@/lib/data-store";
import { CompleteProfileForm } from "./CompleteProfileForm";

async function CompleteProfileContent() {
  const { user, dbConnected } = await requirePhoneOnboardingUser();
  const { groups } = await getActiveGroups();

  return (
    <div className="flex min-h-screen flex-col">
      <SynkroNavbar user={user} dbConnected={dbConnected} />

      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10 sm:px-6">
        <div className="sk-animate-in w-full">
          <div className="sk-card sk-edge relative overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <OwlMascot size="md" mood="welcome" />

              <span className="sk-badge sk-badge-primary mt-4">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Dernière étape avant tes jumelages</span>
              </span>

              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
                Finalisons ton profil
              </h1>

              <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted-foreground)]">
                Ton numéro de téléphone permettra à tes jumeaux de te contacter
                facilement sur WhatsApp.
              </p>
            </div>

            <div className="mt-6">
              <CompleteProfileForm
                firstName={user.firstName}
                currentGroupId={user.groupId}
                currentGroupName={user.groupName}
                groups={groups}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          <OwlMascot size="md" mood="thinking" />
          <span>Préparation de ton espace…</span>
        </div>
      }
    >
      <CompleteProfileContent />
    </Suspense>
  );
}
