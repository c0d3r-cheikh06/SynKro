import { Camera, HeartHandshake, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { OwlMascot } from "@/components/OwlMascot";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { requireActiveMember } from "@/lib/auth";
import { getRetroAlbumData } from "@/lib/data-store";
import { RetroInteractiveClient } from "./RetroInteractiveClient";

async function RetroAlbumContent() {
  const { user } = await requireActiveMember();
  const retroData = await getRetroAlbumData(user.id);

  return (
    <div className="flex min-h-screen flex-col">
      <SynkroNavbar user={user} dbConnected={retroData.dbConnected} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Clean Cosmic Tech Header */}
        <section className="sk-card sk-edge sk-animate-in relative mb-7 overflow-hidden p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3.5">
              <OwlMascot size="md" mood="welcome" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="sk-badge sk-badge-primary">
                    <Camera aria-hidden="true" className="h-3.5 w-3.5" />
                    <span>Souvenirs de promotion</span>
                  </span>
                  <span className="sk-badge sk-badge-success">
                    <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                    <span>Consentement unanime</span>
                  </span>
                </div>

                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
                  Album Rétro
                </h1>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted-foreground)] sm:text-sm">
                  Partagez les souvenirs de vos rencontres inter-groupes. Chaque
                  photo est publiée avec l&apos;accord de tous les participants.
                </p>
              </div>
            </div>

            <div className="sk-surface-muted flex items-center gap-2.5 px-3.5 py-2.5 text-xs">
              <HeartHandshake
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-[var(--primary)]"
              />
              <span>Retrait en 1 clic à tout moment</span>
            </div>
          </div>
        </section>

        <div className="sk-animate-in sk-delay-1">
          <RetroInteractiveClient
            currentUserId={user.id}
            approvedPhotos={retroData.approvedPhotos}
            myPhotos={retroData.myPhotos}
            taggedPhotos={retroData.taggedPhotos}
            eligibleParticipants={retroData.eligibleParticipants}
            retroEnabled={retroData.retroEnabled}
          />
        </div>
      </main>
    </div>
  );
}

export default function RetroPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          Chargement de l&apos;album rétrospectif…
        </div>
      }
    >
      <RetroAlbumContent />
    </Suspense>
  );
}
