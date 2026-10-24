"use client";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Shield,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { registerStudentAction } from "@/app/actions/auth-actions";
import { GroupRecord } from "@/lib/data-store";

export function RegisterForm({ groups }: { groups: GroupRecord[] }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setDevVerifyUrl(null);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await registerStudentAction(formData);
      setLoading(false);

      if (!res.success) {
        setError(res.message);
        return;
      }

      setSuccessMsg(res.message);
      if (res.devVerificationUrl) {
        setDevVerifyUrl(res.devVerificationUrl);
      }
    } catch {
      setLoading(false);
      setError(
        "La requête d'inscription n'a pas pu aboutir. Vérifiez votre connexion ou l'URL utilisée."
      );
    }
  };

  if (successMsg) {
    return (
      <div className="sk-animate-in space-y-5 rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 h-6 w-6 shrink-0 text-[var(--success)]"
          />
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">
              Étape 1/2 : Vérifiez votre adresse e-mail
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {successMsg}
            </p>
          </div>
        </div>

        {devVerifyUrl && (
          <div className="rounded-xl border border-[var(--primary-subtle-border)] bg-[var(--surface)] p-4 text-xs">
            <p className="font-semibold text-[var(--primary-subtle-foreground)]">
              Mode développement (CONSOLE) — Lien de vérification direct :
            </p>
            <Link
              href={devVerifyUrl}
              className="sk-btn sk-btn-primary mt-2.5 min-h-10 py-2 text-xs"
            >
              <span>Confirmer mon adresse e-mail maintenant</span>
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className="pt-2">
          <Link href="/login" className="sk-btn sk-btn-secondary min-h-11 w-full">
            Aller à la page de connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="sk-alert sk-alert-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="sk-label">
            Prénom
          </label>
          <div className="sk-field-wrap">
            <User aria-hidden="true" className="sk-field-icon" />
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              placeholder="Ex: Moussa"
              className="sk-input sk-input-icon-left min-h-11"
            />
          </div>
        </div>

        <div>
          <label htmlFor="lastName" className="sk-label">
            Nom
          </label>
          <div className="sk-field-wrap">
            <User aria-hidden="true" className="sk-field-icon" />
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              placeholder="Ex: Diallo"
              className="sk-input sk-input-icon-left min-h-11"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="email" className="sk-label">
          Adresse e-mail étudiante
        </label>
        <div className="sk-field-wrap">
          <Mail aria-hidden="true" className="sk-field-icon" />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="moussa.diallo@ecole.sn"
            className="sk-input sk-input-icon-left min-h-11"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="sk-label">
            Téléphone (WhatsApp)
          </label>
          <div className="sk-field-wrap">
            <Phone aria-hidden="true" className="sk-field-icon" />
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="+221 77 123 45 67"
              className="sk-input sk-input-icon-left min-h-11"
            />
          </div>
        </div>

        <div>
          <label htmlFor="groupId" className="sk-label">
            Ancienne classe
          </label>
          <div className="sk-field-wrap">
            <Users aria-hidden="true" className="sk-field-icon" />
            <select
              id="groupId"
              name="groupId"
              required
              defaultValue=""
              className="sk-select sk-input-icon-left min-h-11"
            >
              <option value="" disabled>
                Choisir mon ancienne classe…
              </option>
              {groups
                .filter((g) => g.isActive)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="password" className="sk-label">
          Mot de passe (8+ caractères, majuscule, minuscule, chiffre)
        </label>
        <div className="sk-field-wrap">
          <Shield aria-hidden="true" className="sk-field-icon" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••••••"
            className="sk-input sk-input-icon-left sk-input-icon-right min-h-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={
              showPassword
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
            }
            className="sk-field-trailing-btn"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="sk-btn sk-btn-primary min-h-11 w-full py-3"
      >
        {loading ? "Inscription en cours…" : "Créer mon compte étudiant"}
      </button>
    </form>
  );
}
