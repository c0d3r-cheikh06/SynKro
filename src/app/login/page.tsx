import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OwlMascot } from "@/components/OwlMascot";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { getCurrentUser, isGoogleOAuthConfigured } from "@/lib/auth";
import { resolveUserPrimaryDestination } from "@/lib/auth-guards";
import { LoginForm } from "./LoginForm";

async function LoginContent() {
  const { user, dbConnected } = await getCurrentUser();
  if (user) {
    redirect(resolveUserPrimaryDestination(user));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SynkroNavbar user={null} dbConnected={dbConnected} />

      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10 sm:px-6">
        <div className="sk-animate-in w-full">
          <div className="sk-card sk-edge relative overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <OwlMascot size="md" mood="welcome" />
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
                Connexion à Synkro
              </h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Accède à tes jumelages entre anciennes classes de la semaine.
              </p>
            </div>

            <div className="mt-6">
              <LoginForm googleEnabled={isGoogleOAuthConfigured} />
            </div>

            <p className="mt-6 border-t border-[var(--border)] pt-5 text-center text-sm text-[var(--muted-foreground)]">
              Pas encore inscrit ?{" "}
              <Link
                href="/register"
                className="font-semibold text-[var(--primary)] transition-colors hover:underline"
              >
                Créer mon compte étudiant
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          <OwlMascot size="md" mood="thinking" />
          <span>Chargement de la connexion…</span>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
