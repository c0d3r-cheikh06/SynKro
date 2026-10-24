import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { verifyEmailTokenAction } from "@/app/actions/auth-actions";
import { OwlMascot } from "@/components/OwlMascot";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { getCurrentUser } from "@/lib/auth";

async function VerifyEmailContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ user, dbConnected }, resolvedSearch] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);
  const token = resolvedSearch.token ?? "";
  const result = await verifyEmailTokenAction(token);

  return (
    <div className="sk-tech-bg flex min-h-screen flex-col">
      <SynkroNavbar user={user} dbConnected={dbConnected} />

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="sk-card sk-animate-in relative w-full max-w-md overflow-hidden p-6 text-center sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#173B67] via-[#2563EB] to-[#60A5FA]" />

          <div className="flex justify-center">
            <div className="rounded-2xl p-1 ring-1 ring-[var(--border)]">
              <OwlMascot size="md" />
            </div>
          </div>

          <div className="mt-5 flex justify-center">
            {result.success ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]">
                <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]">
                <AlertCircle aria-hidden="true" className="h-6 w-6" />
              </div>
            )}
          </div>

          <h1 className="mt-4 text-xl font-extrabold text-[var(--foreground)]">
            {result.success
              ? "Adresse e-mail confirmée"
              : "Vérification impossible"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
            {result.message}
          </p>

          <div className="mt-6">
            <Link
              href={user ? "/account-status" : "/login"}
              className="sk-btn sk-btn-primary w-full py-3"
            >
              {user ? "Voir le statut de mon compte" : "Se connecter"}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          Vérification de votre adresse e-mail…
        </div>
      }
    >
      <VerifyEmailContent searchParams={searchParams} />
    </Suspense>
  );
}
