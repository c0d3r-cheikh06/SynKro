"use client";

import { ExternalLink, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { resendVerificationEmailAction } from "@/app/actions/auth-actions";

export function ResendVerifyButton({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  const handleResend = async () => {
    setLoading(true);
    const res = await resendVerificationEmailAction(email);
    setLoading(false);
    setMsg(res.message);
    if (res.devVerificationUrl) {
      setDevUrl(res.devVerificationUrl);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading}
        onClick={handleResend}
        className="sk-btn sk-btn-primary py-2 text-xs"
      >
        <Mail aria-hidden="true" className="h-4 w-4" />
        <span>
          {loading
            ? "Envoi en cours…"
            : "Renvoyer l'e-mail de vérification"}
        </span>
      </button>

      {msg && (
        <p className="text-xs font-semibold text-[var(--success-foreground)]">
          {msg}
        </p>
      )}

      {devUrl && (
        <div className="rounded-xl border border-[var(--primary-subtle-border)] bg-[var(--surface)] p-3 text-xs">
          <p className="font-semibold text-[var(--primary-subtle-foreground)]">
            Lien de vérification direct (Mode CONSOLE) :
          </p>
          <Link
            href={devUrl}
            className="mt-1.5 inline-flex items-center gap-1 font-semibold text-[var(--primary)] underline"
          >
            <span>Confirmer mon adresse maintenant</span>
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
