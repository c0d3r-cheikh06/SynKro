"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { requestPasswordResetAction } from "@/app/actions/auth-actions";
import { OwlMascot } from "@/components/OwlMascot";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setDevResetUrl(null);

    const formData = new FormData(e.currentTarget);
    const res = await requestPasswordResetAction(formData);
    setLoading(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    setMessage(res.message);
    if (res.devResetUrl) {
      setDevResetUrl(res.devResetUrl);
    }
  };

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
              Mot de passe oublié
            </h1>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
              Saisissez votre adresse e-mail pour recevoir un lien de
              réinitialisation sécurisé.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div role="alert" className="sk-alert sk-alert-danger">
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div
                role="status"
                className="space-y-3 rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)] p-4 text-sm text-[var(--success-foreground)]"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>{message}</span>
                </div>
                {devResetUrl && (
                  <div className="rounded-xl border border-[var(--primary-subtle-border)] bg-[var(--surface)] p-3.5 text-xs text-[var(--foreground)]">
                    <p className="font-semibold text-[var(--primary-subtle-foreground)]">
                      Mode dev (CONSOLE) — Lien direct :
                    </p>
                    <Link
                      href={devResetUrl}
                      className="sk-btn sk-btn-primary mt-2 py-1.5 text-xs"
                    >
                      <span>Choisir un nouveau mot de passe</span>
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="sk-label">
                Adresse e-mail
              </label>
              <div className="sk-field-wrap">
                <Mail aria-hidden="true" className="sk-field-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="etudiant@exemple.sn"
                  className="sk-input sk-input-icon-left min-h-11"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="sk-btn sk-btn-primary w-full py-3"
            >
              {loading
                ? "Envoi en cours…"
                : "Envoyer le lien de réinitialisation"}
            </button>
          </form>

          <div className="mt-6 border-t border-[var(--border)] pt-5 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span>Retour à la connexion</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
