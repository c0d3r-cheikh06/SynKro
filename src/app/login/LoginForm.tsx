"use client";

import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Mail,
} from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Impossible d'initialiser la connexion avec Google.",
  OAuthCallback: "Erreur lors du retour d'authentification Google.",
  OAuthCallbackError: "La connexion Google a été interrompue ou annulée.",
  OAuthAccountNotLinked:
    "Cette adresse e-mail est déjà associée à un autre mode de connexion.",
  AccessDenied: "Accès refusé lors de l'authentification.",
  Configuration:
    "Configuration Google OAuth incomplète sur le serveur (vérifiez AUTH_GOOGLE_ID et AUTH_GOOGLE_SECRET).",
};

export function LoginForm({
  googleEnabled,
}: {
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const urlErrorCode = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);
  const [error, setError] = useState<string | null>(
    urlErrorCode
      ? OAUTH_ERROR_MESSAGES[urlErrorCode] ||
          "Une erreur d'authentification est survenue."
      : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(
          "Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe."
        );
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Une erreur est survenue lors de la connexion.");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleEnabled) {
      setShowGoogleGuide((prev) => !prev);
      return;
    }
    setGoogleLoading(true);
    setError(null);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="sk-alert sk-alert-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="etudiant@exemple.sn"
              className="sk-input sk-input-icon-left min-h-11"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="sk-label !mb-0">
              Mot de passe
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[var(--primary)] transition-colors hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="sk-field-wrap">
            <KeyRound aria-hidden="true" className="sk-field-icon" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          disabled={loading || googleLoading}
          className="sk-btn sk-btn-primary min-h-11 w-full py-3"
        >
          <span>{loading ? "Connexion en cours…" : "Se connecter"}</span>
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </form>

      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-[var(--border)]" />
        <span className="bg-[var(--surface)] px-3 text-xs text-[var(--muted-foreground)]">
          ou
        </span>
        <div className="w-full border-t border-[var(--border)]" />
      </div>

      <div>
        <button
          type="button"
          disabled={loading || googleLoading}
          onClick={handleGoogleSignIn}
          className="sk-btn sk-btn-secondary min-h-11 w-full py-2.5"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.5 1.18-4.22 1.18-3.24 0-5.98-2.19-6.96-5.14H1.05v3.14C3.06 21.17 7.21 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.04 14.03c-.25-.74-.39-1.53-.39-2.35s.14-1.61.39-2.35V6.19H1.05C.38 7.52 0 9.02 0 10.68s.38 3.16 1.05 4.49l3.99-1.14z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.14 15.3 0 12 0 7.21 0 3.06 2.83 1.05 6.83l3.99 3.14c.98-2.95 3.72-5.22 6.96-5.22z"
            />
          </svg>
          <span>
            {googleLoading
              ? "Redirection vers Google…"
              : "Continuer avec Google"}
          </span>
        </button>

        {!googleEnabled && showGoogleGuide && (
          <div className="sk-animate-in mt-3 rounded-xl border border-[var(--primary-subtle-border)] bg-[var(--primary-subtle)] p-3.5 text-xs text-[var(--primary-subtle-foreground)]">
            <div className="flex items-start gap-2">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1.5 leading-relaxed">
                <p className="font-bold">
                  Activation de Google OAuth dans votre environnement :
                </p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>
                    Créez un ID client OAuth 2.0 dans{" "}
                    <strong>Google Cloud Console</strong>.
                  </li>
                  <li>
                    Ajoutez l&apos;URI de redirection autorisée :{" "}
                    <code className="rounded bg-[var(--surface)] px-1 py-0.5 font-mono text-[11px]">
                      http://localhost:3000/api/auth/callback/google
                    </code>
                  </li>
                  <li>
                    Renseignez{" "}
                    <code className="font-mono font-semibold">
                      AUTH_GOOGLE_ID
                    </code>{" "}
                    et{" "}
                    <code className="font-mono font-semibold">
                      AUTH_GOOGLE_SECRET
                    </code>{" "}
                    dans votre fichier <code className="font-mono">.env</code>.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
