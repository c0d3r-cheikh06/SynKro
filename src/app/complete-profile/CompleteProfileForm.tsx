"use client";

import {
  ArrowRight,
  CheckCircle2,
  Globe,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { completeStudentPhoneAction } from "@/app/actions/student-actions";
import { GroupRecord } from "@/lib/data-store";
import {
  SUPPORTED_COUNTRY_DIAL_CODES,
  validateAndNormalizePhoneWithCountry,
} from "@/lib/phone";

interface CompleteProfileFormProps {
  firstName: string;
  currentGroupId: string | null;
  currentGroupName: string | null;
  groups: GroupRecord[];
}

export function CompleteProfileForm({
  firstName,
  currentGroupId,
  currentGroupName,
  groups,
}: CompleteProfileFormProps) {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState("221");
  const [customDialCode, setCustomDialCode] = useState("");
  const [phone, setPhone] = useState("");
  const [groupId, setGroupId] = useState(currentGroupId ?? "");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCustomCountry = countryCode === "OTHER";
  const effectiveDialCode = isCustomCountry
    ? customDialCode.replace(/\D/g, "")
    : countryCode;

  const selectedCountry = useMemo(
    () =>
      SUPPORTED_COUNTRY_DIAL_CODES.find((c) => c.dialCode === countryCode) ??
      SUPPORTED_COUNTRY_DIAL_CODES[0],
    [countryCode]
  );

  const livePreview = useMemo(() => {
    if (!phone.trim()) return null;
    return validateAndNormalizePhoneWithCountry(effectiveDialCode, phone);
  }, [effectiveDialCode, phone]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);

    const check = validateAndNormalizePhoneWithCountry(effectiveDialCode, phone);
    if (!check.valid) {
      setFeedback({ type: "error", text: check.error });
      return;
    }

    const fd = new FormData();
    fd.set("countryCode", `+${effectiveDialCode}`);
    fd.set("phone", phone.trim());
    if (!currentGroupId && groupId) {
      fd.set("groupId", groupId);
    }

    startTransition(async () => {
      const res = await completeStudentPhoneAction(fd);
      if (!res.success) {
        setFeedback({ type: "error", text: res.message });
        return;
      }

      setFeedback({ type: "success", text: res.message });
      router.refresh();
      setTimeout(() => {
        router.push("/dashboard");
      }, 650);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {feedback && (
        <div
          role="alert"
          aria-live="polite"
          className={`sk-alert ${
            feedback.type === "success" ? "sk-alert-success" : "sk-alert-danger"
          }`}
        >
          {feedback.type === "success" && (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="space-y-2">
            <p>{feedback.text}</p>
            {feedback.type === "success" && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-bold underline"
              >
                <span>Accéder immédiatement à mes jumelages</span>
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Country dial-code + national phone input */}
      <div className="space-y-3">
        <div>
          <label
            htmlFor="onboarding-country"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]"
          >
            <Globe aria-hidden="true" className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span>Indicatif du pays</span>
          </label>
          <select
            id="onboarding-country"
            value={countryCode}
            disabled={isPending}
            onChange={(e) => {
              setCountryCode(e.target.value);
              setFeedback(null);
            }}
            className="sk-input min-h-11 font-medium"
          >
            {SUPPORTED_COUNTRY_DIAL_CODES.map((opt) => (
              <option key={opt.iso} value={opt.dialCode}>
                {opt.label}
              </option>
            ))}
            <option value="OTHER">Autre indicatif international…</option>
          </select>
        </div>

        {isCustomCountry && (
          <div>
            <label
              htmlFor="onboarding-custom-dial"
              className="mb-1.5 block text-xs font-semibold text-[var(--foreground)]"
            >
              Indicatif international (sans le +)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-sm font-bold text-[var(--muted-foreground)]">
                +
              </span>
              <input
                id="onboarding-custom-dial"
                type="tel"
                inputMode="numeric"
                maxLength={4}
                placeholder="220"
                value={customDialCode}
                disabled={isPending}
                onChange={(e) =>
                  setCustomDialCode(e.target.value.replace(/\D/g, ""))
                }
                className="sk-input min-h-11 pl-8 font-mono"
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="onboarding-phone"
            className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-[var(--foreground)]"
          >
            <span className="inline-flex items-center gap-1.5">
              <Phone aria-hidden="true" className="h-3.5 w-3.5 text-[var(--primary)]" />
              <span>Numéro de téléphone WhatsApp</span>
            </span>
            <span className="font-mono text-[11px] text-[var(--primary)]">
              +{effectiveDialCode || "221"}
            </span>
          </label>

          <div className="flex items-stretch gap-2">
            <div
              aria-hidden="true"
              className="flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 font-mono text-sm font-bold text-[var(--foreground)]"
            >
              +{effectiveDialCode || "221"}
            </div>
            <input
              id="onboarding-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              disabled={isPending}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (feedback?.type === "error") setFeedback(null);
              }}
              placeholder={
                isCustomCountry ? "Numéro sans l'indicatif" : selectedCountry.placeholder
              }
              aria-describedby="onboarding-phone-hint"
              className="sk-input min-h-12 flex-1 font-mono text-base tracking-wide"
            />
          </div>

          <div
            id="onboarding-phone-hint"
            className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]"
          >
            <span>
              Format attendu :{" "}
              <strong className="font-medium text-[var(--foreground)]">
                {isCustomCountry
                  ? "8 à 12 chiffres valides selon votre opérateur"
                  : selectedCountry.formatHint}
              </strong>
            </span>
            {livePreview?.valid && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--success)]">
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                {livePreview.formatted}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Optional ancienne classe selection ONLY if the student doesn't have one assigned yet */}
      {!currentGroupId && groups.length > 0 && (
        <div>
          <label
            htmlFor="onboarding-group"
            className="mb-1.5 block text-xs font-semibold text-[var(--foreground)]"
          >
            Ton ancienne classe (si elle n&apos;a pas encore été renseignée)
          </label>
          <select
            id="onboarding-group"
            name="groupId"
            value={groupId}
            disabled={isPending}
            onChange={(e) => setGroupId(e.target.value)}
            className="sk-input min-h-11"
          >
            <option value="">Sélectionner mon ancienne classe (optionnel)</option>
            {groups.map((grp) => (
              <option key={grp.id} value={grp.id}>
                {grp.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentGroupName && (
        <div className="sk-surface-muted flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
          <span className="text-[var(--muted-foreground)]">
            Profil approuvé pour{" "}
            <strong className="text-[var(--foreground)]">{firstName}</strong>
          </span>
          <span className="sk-badge sk-badge-primary">{currentGroupName}</span>
        </div>
      )}

      {/* Privacy reassurance */}
      <div className="sk-surface-muted flex items-start gap-2.5 p-3.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
        <ShieldCheck
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
        />
        <p>
          Ton numéro reste confidentiel : seuls tes jumeaux attribués et
          l&apos;administration peuvent l&apos;utiliser pour faciliter vos
          rencontres sur WhatsApp.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="sk-btn sk-btn-primary min-h-12 w-full text-sm font-bold"
      >
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            <span>Validation et enregistrement…</span>
          </>
        ) : (
          <>
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            <span>Enregistrer mon numéro</span>
          </>
        )}
      </button>
    </form>
  );
}
