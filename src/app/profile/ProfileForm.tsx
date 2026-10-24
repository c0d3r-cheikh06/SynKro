"use client";

import { AccountStatus, Role } from "@prisma/client";
import {
  AlertCircle,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  FileText,
  Gamepad2,
  Lock,
  Save,
  Sparkles,
  User,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { updateProfileAction } from "@/app/actions/student-actions";
import { resolveStudentAvatarUrl } from "@/components/StudentAvatar";
import { GroupRecord, UserRecord } from "@/lib/data-store";
import { AVATAR_PRESETS } from "@/lib/validation";

export function ProfileForm({
  user,
  groups,
  allowNameEdit,
}: {
  user: UserRecord;
  groups: GroupRecord[];
  allowNameEdit: boolean;
}) {
  const [selectedAvatar, setSelectedAvatar] = useState(
    resolveStudentAvatarUrl(user.image, user.email || user.id)
  );
  const [customPreviewUrl, setCustomPreviewUrl] = useState<string | null>(null);
  const [bioText, setBioText] = useState(user.bio || "");
  const [interestsText, setInterestsText] = useState(
    user.interests.join(", ")
  );
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canEditIdentity =
    user.role === Role.ADMIN ||
    user.status === AccountStatus.CORRECTION_REQUESTED ||
    user.status === AccountStatus.PENDING_APPROVAL ||
    allowNameEdit;

  const canChangeGroup =
    !user.groupId ||
    user.role === Role.ADMIN ||
    user.status === AccountStatus.CORRECTION_REQUESTED ||
    user.status === AccountStatus.PENDING_APPROVAL;

  const parsedInterestsPreview = interestsText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const res = await updateProfileAction(formData);
    setLoading(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    setIsDirty(false);
    setMessage(res.message);
  };

  const activePreviewSrc = customPreviewUrl || selectedAvatar;
  const activePreset = AVATAR_PRESETS.find((p) => p.url === selectedAvatar);

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => {
        setIsDirty(true);
        if (message) setMessage(null);
      }}
      className="space-y-6"
    >
      <input type="hidden" name="avatarPreset" value={selectedAvatar} />

      {error && (
        <div role="alert" className="sk-alert sk-alert-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div role="status" className="sk-alert sk-alert-success">
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>{message}</span>
        </div>
      )}

      {/* ==================== AVATAR GAMING GALLERY & PERSONAL PHOTO ==================== */}
      <section className="sk-card p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--foreground)] sm:text-lg">
              <Gamepad2
                aria-hidden="true"
                className="h-5 w-5 text-[var(--primary)]"
              />
              <span>Galerie d&apos;avatars Gaming & Photo personnelle</span>
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted-foreground)]">
              Choisis ton personnage parmi les 10 avatars originaux Synkro
              Cosmic Tech ou téléverse ta propre photo personnelle.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3.5 rounded-2xl border border-[var(--primary-subtle-border)] bg-[var(--surface-secondary)] px-4 py-2.5">
            <div
              key={activePreviewSrc}
              className="sk-avatar sk-animate-scale h-16 w-16 rounded-2xl ring-2 ring-[var(--primary)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePreviewSrc}
                alt="Aperçu de ton avatar"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-xs">
              <p className="font-mono text-[11px] font-semibold tracking-wider text-[var(--primary)] uppercase">
                {customPreviewUrl ? "Photo Uploadée" : "Avatar Sélectionné"}
              </p>
              <p className="text-sm font-extrabold text-[var(--foreground)]">
                {customPreviewUrl
                  ? "Photo personnelle"
                  : activePreset?.label || "Personnalisé"}
              </p>
              <p className="text-[var(--muted-foreground)]">
                {customPreviewUrl
                  ? "Visible par tes jumeaux"
                  : activePreset?.specialty || "Collection Cosmic Tech"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-5">
          {AVATAR_PRESETS.map((preset) => {
            const isSelected =
              !customPreviewUrl && selectedAvatar === preset.url;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setCustomPreviewUrl(null);
                  setSelectedAvatar(preset.url);
                  setIsDirty(true);
                }}
                className={`group relative flex flex-col items-center gap-2.5 rounded-2xl border p-3 text-center transition-all duration-200 ${
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--primary-subtle)] shadow-sm ring-2 ring-[var(--primary)]/40 -translate-y-0.5"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary-subtle-border)] hover:bg-[var(--surface-secondary)]"
                }`}
              >
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary-solid)] text-white shadow-xs"
                  >
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <div className="sk-avatar aspect-square w-full max-w-[104px] overflow-hidden rounded-2xl">
                  <Image
                    src={preset.url}
                    alt={`Avatar ${preset.label} — ${preset.specialty}`}
                    width={112}
                    height={112}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="w-full min-w-0">
                  <p className="truncate font-mono text-xs font-extrabold tracking-tight text-[var(--foreground)]">
                    {preset.label}
                  </p>
                  <p className="truncate text-[10px] font-medium text-[var(--muted-foreground)]">
                    {preset.specialty}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5 text-xs">
            <Camera
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-[var(--primary)]"
            />
            <div>
              <label
                htmlFor="avatarFile"
                className="font-bold text-[var(--foreground)] cursor-pointer"
              >
                Préfères-tu utiliser ta propre photo personnelle ?
              </label>
              <p className="text-[var(--muted-foreground)]">
                JPEG, PNG ou WebP (max 5 Mo — métadonnées EXIF automatiquement
                supprimées)
              </p>
            </div>
          </div>
          <input
            id="avatarFile"
            name="avatarFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setCustomPreviewUrl(URL.createObjectURL(file));
                setIsDirty(true);
              } else {
                setCustomPreviewUrl(null);
              }
            }}
            className="block text-xs text-[var(--muted-foreground)] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--primary-solid)] file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[var(--primary-solid-hover)]"
          />
        </div>
      </section>

      {/* ==================== PERSONAL INFO & MAJOR ==================== */}
      <section className="sk-card p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--foreground)] sm:text-lg">
          <User aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          <span>Identité & Coordonnées WhatsApp</span>
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="sk-label">
              Prénom{" "}
              {!canEditIdentity && (
                <span className="font-normal text-[var(--muted-foreground)]">
                  (verrouillé)
                </span>
              )}
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              defaultValue={user.firstName}
              readOnly={!canEditIdentity}
              className="sk-input"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="sk-label">
              Nom{" "}
              {!canEditIdentity && (
                <span className="font-normal text-[var(--muted-foreground)]">
                  (verrouillé)
                </span>
              )}
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              defaultValue={user.lastName}
              readOnly={!canEditIdentity}
              className="sk-input"
            />
          </div>

          <div>
            <label htmlFor="phone" className="sk-label">
              Numéro WhatsApp
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={user.phoneNormalized || user.phone || ""}
              placeholder="+221 77 123 45 67"
              className="sk-input font-mono"
            />
          </div>

          <div>
            <label htmlFor="groupId" className="sk-label">
              Ancienne classe
            </label>
            {canChangeGroup ? (
              <select
                id="groupId"
                name="groupId"
                defaultValue={user.groupId || ""}
                className="sk-select"
              >
                <option value="">Sélectionner mon ancienne classe…</option>
                {groups
                  .filter((g) => g.isActive)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            ) : (
              <div className="sk-surface-muted flex items-center justify-between px-3.5 py-2.5 text-sm">
                <div className="flex items-center gap-2 font-bold text-[var(--foreground)]">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: user.groupColor || "#2563EB" }}
                  />
                  <span>{user.groupName || "Non assigné"}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <Lock aria-hidden="true" className="h-3 w-3" />
                  <span>Validé</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ==================== BIOGRAPHY & INTERESTS ==================== */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="sk-card p-5 sm:p-7 lg:col-span-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--foreground)] sm:text-lg">
              <FileText
                aria-hidden="true"
                className="h-4 w-4 text-[var(--primary)]"
              />
              <span>Présentation courte</span>
            </h2>
            <span className="font-mono text-xs text-[var(--muted-foreground)]">
              {bioText.length}/500
            </span>
          </div>

          <div className="mt-3">
            <label htmlFor="bio" className="sr-only">
              Biographie
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              maxLength={500}
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              placeholder="Parle de tes projets, de ton ancienne classe et de tes passions…"
              className="sk-textarea"
            />
          </div>
        </section>

        <section className="sk-card p-5 sm:p-7 lg:col-span-6">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--foreground)] sm:text-lg">
            <Sparkles
              aria-hidden="true"
              className="h-4 w-4 text-[var(--primary)]"
            />
            <span>Centres d&apos;intérêt</span>
          </h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Sépare tes passions par des virgules (max 12).
          </p>

          <div className="mt-3">
            <label htmlFor="interests" className="sr-only">
              Centres d&apos;intérêt
            </label>
            <input
              id="interests"
              name="interests"
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder="Développement Web, Cybersécurité, Réseaux, Football"
              className="sk-input"
            />
          </div>

          {parsedInterestsPreview.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {parsedInterestsPreview.map((tag, idx) => (
                <span
                  key={`${tag}-${idx}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--primary-subtle-border)] bg-[var(--primary-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--primary-subtle-foreground)]"
                >
                  <Sparkles
                    aria-hidden="true"
                    className="h-3 w-3 text-[var(--primary)]"
                  />
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ==================== NOTIFICATION PREFERENCES ==================== */}
      <section className="sk-card p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--foreground)] sm:text-lg">
          <Bell aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
          <span>Notifications</span>
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              name: "notifyEmail",
              checked: user.notifyEmail,
              title: "Notifications par e-mail",
              desc: "Activer les e-mails Synkro.",
            },
            {
              name: "notifyMatchPublished",
              checked: user.notifyMatchPublished,
              title: "Nouveaux jumelages",
              desc: "Recevoir une alerte chaque lundi.",
            },
            {
              name: "notifyWeeklyReminder",
              checked: user.notifyWeeklyReminder,
              title: "Rappel de confirmation",
              desc: "Rappel si une rencontre est en attente.",
            },
            {
              name: "notifyEndOfCycle",
              checked: user.notifyEndOfCycle,
              title: "Bilan de fin de cycle",
              desc: "Récapitulatif des 6 semaines et Album Rétro.",
            },
          ].map((item) => (
            <label
              key={item.name}
              className="sk-surface-muted flex cursor-pointer items-start gap-3 p-3.5 transition-colors hover:border-[var(--primary-subtle-border)]"
            >
              <input
                type="checkbox"
                name={item.name}
                defaultChecked={item.checked}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border-strong)] accent-[var(--primary)]"
              />
              <div className="text-xs">
                <span className="block font-bold text-[var(--foreground)]">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[var(--muted-foreground)]">
                  {item.desc}
                </span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Action Footer */}
      <div className="sk-card flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6">
        <div className="text-xs">
          {isDirty ? (
            <span className="sk-badge sk-badge-warning">
              Modifications non enregistrées
            </span>
          ) : (
            <span className="text-[var(--muted-foreground)]">
              Profil synchronisé.
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="sk-btn sk-btn-primary min-h-11 px-6 py-2.5"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
          <span>{loading ? "Enregistrement…" : "Enregistrer mon profil"}</span>
        </button>
      </div>
    </form>
  );
}
