import { AccountStatus } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MailCheck,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OwlMascot } from "@/components/OwlMascot";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { requireAuthenticatedUser } from "@/lib/auth";
import { resolveUserPrimaryDestination } from "@/lib/auth-guards";
import { ResendVerifyButton } from "./ResendVerifyButton";

async function AccountStatusContent() {
  const { user, dbConnected } = await requireAuthenticatedUser();

  if (user.emailVerified && user.status === AccountStatus.ACTIVE) {
    redirect(resolveUserPrimaryDestination(user));
  }

  return (
    <div className="sk-tech-bg flex min-h-screen flex-col">
      <SynkroNavbar user={user} dbConnected={dbConnected} />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="sk-card sk-animate-in relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#173B67] via-[#2563EB] to-[#60A5FA]" />

          <div className="flex items-center gap-4">
            <div className="rounded-2xl p-1 ring-1 ring-[var(--border)]">
              <OwlMascot size="md" />
            </div>
            <div className="min-w-0">
              <span className="sk-badge sk-badge-primary">
                Double validation de sécurité
              </span>
              <h1 className="mt-1.5 text-xl font-extrabold text-[var(--foreground)] sm:text-2xl">
                Statut de votre compte Synkro
              </h1>
              <p className="truncate text-sm text-[var(--muted-foreground)]">
                Bonjour{" "}
                <strong className="font-semibold text-[var(--foreground)]">
                  {user.firstName} {user.lastName}
                </strong>{" "}
                ({user.email})
              </p>
            </div>
          </div>

          {/* 2-step Security Verification Checklist */}
          <div className="mt-6 space-y-3.5">
            <div className="sk-surface-muted flex items-start gap-3.5 p-4">
              {user.emailVerified ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--success)]"
                />
              ) : (
                <MailCheck
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]"
                />
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    1. Vérification de l&apos;adresse e-mail
                  </p>
                  <span
                    className={`sk-badge ${
                      user.emailVerified
                        ? "sk-badge-success"
                        : "sk-badge-warning"
                    }`}
                  >
                    {user.emailVerified ? "Confirmée" : "En attente"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {user.emailVerified
                    ? "Votre adresse e-mail a bien été vérifiée."
                    : "Vous devez cliquer sur le lien de confirmation envoyé par e-mail avant que votre compte puisse être approuvé."}
                </p>
                {!user.emailVerified && (
                  <div className="mt-3">
                    <ResendVerifyButton email={user.email} />
                  </div>
                )}
              </div>
            </div>

            <div className="sk-surface-muted flex items-start gap-3.5 p-4">
              {user.status === AccountStatus.ACTIVE ? (
                <UserCheck
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--success)]"
                />
              ) : user.status === AccountStatus.REJECTED ||
                user.status === AccountStatus.SUSPENDED ? (
                <ShieldAlert
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]"
                />
              ) : user.status === AccountStatus.CORRECTION_REQUESTED ? (
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]"
                />
              ) : (
                <Clock
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--primary)]"
                />
              )}
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    2. Approbation administrative de la classe
                  </p>
                  <span className="sk-badge sk-badge-primary font-mono">
                    {user.status}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {user.status === AccountStatus.PENDING_APPROVAL &&
                    "Votre inscription est en file d'attente. Un administrateur vérifie votre appartenance à la promotion et votre groupe avant d'activer l'accès aux jumelages."}
                  {user.status === AccountStatus.PENDING_VERIFICATION &&
                    "Cette étape débutera dès que votre adresse e-mail sera vérifiée."}
                  {user.status === AccountStatus.CORRECTION_REQUESTED &&
                    "L'administrateur vous demande de corriger ou compléter vos informations (groupe, nom ou téléphone) sur votre profil."}
                  {user.status === AccountStatus.REJECTED &&
                    "Votre demande d'inscription n'a pas été approuvée par l'administrateur."}
                  {user.status === AccountStatus.SUSPENDED &&
                    "Votre compte est temporairement suspendu par l'administration."}
                </p>

                {user.statusReason && (
                  <div className="sk-alert sk-alert-warning mt-3 text-xs">
                    <div>
                      <strong>Note de l&apos;administrateur :</strong>{" "}
                      {user.statusReason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/profile" className="sk-btn sk-btn-primary">
              Compléter ou corriger mon profil
            </Link>
            <Link href="/" className="sk-btn sk-btn-secondary">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AccountStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          Vérification du statut de votre compte…
        </div>
      }
    >
      <AccountStatusContent />
    </Suspense>
  );
}
