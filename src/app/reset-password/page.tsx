"use client";

import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { resetPasswordAction } from "@/app/actions/auth-actions";
import { OwlMascot } from "@/components/OwlMascot";
import { ThemeToggle } from "@/components/ThemeToggle";

function ResetPasswordFormInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData(e.currentTarget);
    const res = await resetPasswordAction(formData);
    setLoading(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    setSuccessMsg(res.message);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />

      {error && (
        <div role="alert" className="sk-alert sk-alert-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg ? (
        <div
          role="status"
          className="space-y-4 rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)] p-4 text-sm text-[var(--success-foreground)]"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>{successMsg}</span>
          </div>
          <Link href="/login" className="sk-btn sk-btn-primary w-full">
            Se connecter maintenant
          </Link>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="password" className="sk-label">
              Nouveau mot de passe (8+ caractères, majuscule, minuscule, chiffre)
            </label>
            <div className="sk-field-wrap">
              <KeyRound aria-hidden="true" className="sk-field-icon" />
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••••••"
                className="sk-input sk-input-icon-left min-h-11"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="sk-btn sk-btn-primary w-full py-3"
          >
            {loading ? "Mise à jour…" : "Enregistrer le nouveau mot de passe"}
          </button>
        </>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="sk-tech-bg flex min-h-screen flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <OwlMascot size="sm" />
            <span className="text-base font-extrabold tracking-tight text-[var(--foreground)]">
              Synkro
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="sk-card sk-animate-in relative w-full max-w-md overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#173B67] via-[#2563EB] to-[#60A5FA]" />

          <div className="flex flex-col items-center text-center">
            <div className="rounded-2xl p-1 ring-1 ring-[var(--border)]">
              <OwlMascot size="md" />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
              Nouveau mot de passe
            </h1>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
              Choisissez un mot de passe robuste pour protéger votre compte
              Synkro.
            </p>
          </div>

          <Suspense
            fallback={
              <p className="mt-4 text-center text-xs text-[var(--muted-foreground)]">
                Chargement…
              </p>
            }
          >
            <ResetPasswordFormInner />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
