import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OwlMascot } from "@/components/OwlMascot";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { getCurrentUser } from "@/lib/auth";
import { getActiveGroups } from "@/lib/data-store";
import { RegisterForm } from "./RegisterForm";

async function RegisterContent() {
  const [{ user, dbConnected }, { groups }] = await Promise.all([
    getCurrentUser(),
    getActiveGroups(),
  ]);

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SynkroNavbar user={null} dbConnected={dbConnected} />

      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10 sm:px-6">
        <div className="sk-animate-in w-full">
          <div className="sk-card sk-edge relative overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <OwlMascot size="md" mood="welcome" />
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
                Rejoindre Synkro
              </h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Sélectionne ton ancienne classe pour participer aux jumelages
                entre anciennes classes.
              </p>
            </div>

            <div className="mt-6">
              <RegisterForm groups={groups} />
            </div>

            <p className="mt-6 border-t border-[var(--border)] pt-5 text-center text-sm text-[var(--muted-foreground)]">
              Déjà inscrit ?{" "}
              <Link
                href="/login"
                className="font-semibold text-[var(--primary)] transition-colors hover:underline"
              >
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          <OwlMascot size="md" mood="thinking" />
          <span>Chargement de l&apos;inscription…</span>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
