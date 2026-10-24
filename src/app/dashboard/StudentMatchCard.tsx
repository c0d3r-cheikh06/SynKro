"use client";

import { ConfirmationStatus } from "@prisma/client";
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  MessageSquarePlus,
  Phone,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { confirmMeetingAction } from "@/app/actions/student-actions";
import { StudentAvatar } from "@/components/StudentAvatar";
import { MatchConfirmationView, UserRecord } from "@/lib/data-store";
import { buildWhatsAppUrl, formatPhoneDisplay } from "@/lib/phone";

interface StudentMatchCardProps {
  matchId: string;
  weekNumber: number;
  currentUser: UserRecord;
  partner: UserRecord;
  confirmations: MatchConfirmationView[];
  index?: number;
}

export function StudentMatchCard({
  matchId,
  weekNumber,
  currentUser,
  partner,
  confirmations,
  index = 0,
}: StudentMatchCardProps) {
  const myConf = confirmations.find((c) => c.userId === currentUser.id);
  const partnerConf = confirmations.find((c) => c.userId === partner.id);

  const isMutual =
    myConf?.status === ConfirmationStatus.CONFIRMED &&
    partnerConf?.status === ConfirmationStatus.CONFIRMED;

  const [note, setNote] = useState(myConf?.note ?? "");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);

  const whatsappUrl = buildWhatsAppUrl(
    partner.phoneNormalized || partner.phone,
    `Salut ${partner.firstName} ! C'est ${currentUser.firstName} (${currentUser.groupName || "Synkro"}). Nous sommes jumelés sur Synkro pour la Semaine ${weekNumber} ! On s'organise une rencontre cette semaine ?`
  );

  const handleConfirm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    const formData = new FormData(e.currentTarget);
    const res = await confirmMeetingAction(formData);
    setLoading(false);
    setFeedback({ ok: res.success, text: res.message });
    if (res.success) {
      setShowForm(false);
    }
  };

  return (
    <article
      className="sk-card-interactive sk-edge relative flex flex-col justify-between overflow-hidden p-5 sm:p-6"
      style={{
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Top colored accent line matching partner's ancienne classe */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: partner.groupColor || "#2563EB" }}
      />

      <div>
        {/* Partner Header & Gaming Avatar */}
        <div className="flex items-center gap-3.5">
          <StudentAvatar
            src={partner.image}
            firstName={partner.firstName}
            lastName={partner.lastName}
            seedKey={partner.email || partner.id}
            size="lg"
            accentColor={partner.groupColor}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="sk-group-chip">
                <span
                  className="sk-group-dot"
                  style={{ backgroundColor: partner.groupColor || "#2563EB" }}
                />
                <span>{partner.groupName || "Autre ancienne classe"}</span>
              </span>

              {/* Clear 1-line human status badge */}
              {isMutual ? (
                <span className="sk-badge sk-badge-success">
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Rencontre confirmée</span>
                </span>
              ) : myConf ? (
                <span className="sk-badge sk-badge-primary">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>En attente de ton partenaire</span>
                </span>
              ) : (
                <span className="sk-badge sk-badge-warning">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>À confirmer</span>
                </span>
              )}
            </div>

            <h3 className="mt-1.5 truncate text-lg font-extrabold text-[var(--foreground)]">
              {partner.firstName} {partner.lastName}
            </h3>

            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-[var(--muted-foreground)]">
              <Phone
                aria-hidden="true"
                className="h-3 w-3 shrink-0 text-[var(--primary)]"
              />
              <span>
                {formatPhoneDisplay(partner.phoneNormalized || partner.phone)}
              </span>
            </p>
          </div>
        </div>

        {/* Concise Bio */}
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
          {partner.bio ||
            `Étudiant(e) en ${partner.groupName}. Ravi(e) d'échanger cette semaine !`}
        </p>

        {/* Interests Tags (up to 3 for visual clarity) */}
        {partner.interests && partner.interests.length > 0 && (
          <div
            className="mt-3 flex flex-wrap gap-1.5"
            aria-label="Centres d'intérêt"
          >
            {partner.interests.slice(0, 3).map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--foreground)]"
              >
                <Sparkles
                  aria-hidden="true"
                  className="h-2.5 w-2.5 text-[var(--primary)]"
                />
                <span>{interest}</span>
              </span>
            ))}
          </div>
        )}

        {/* Compact Note Preview if present */}
        {(partnerConf?.note || myConf?.note) && !showForm && (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {partnerConf?.note && (
              <p className="truncate">
                <strong className="text-[var(--foreground)]">
                  {partner.firstName} :
                </strong>{" "}
                « {partnerConf.note} »
              </p>
            )}
            {myConf?.note && (
              <p className="truncate">
                <strong className="text-[var(--foreground)]">Toi :</strong> «{" "}
                {myConf.note} »
              </p>
            )}
          </div>
        )}
      </div>

      {/* Primary Thumb-Friendly Actions Footer */}
      <div className="mt-5 space-y-2.5 border-t border-[var(--border)] pt-4">
        <div className="grid grid-cols-2 gap-2.5">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="sk-btn sk-btn-success min-h-11 py-2.5 text-xs sm:text-sm"
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>WhatsApp</span>
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 text-xs text-[var(--muted-foreground)]">
              Sans numéro
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
            className={`sk-btn min-h-11 py-2.5 text-xs sm:text-sm ${
              myConf ? "sk-btn-secondary" : "sk-btn-primary"
            }`}
          >
            {myConf ? (
              <>
                <MessageSquarePlus
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-[var(--primary)]"
                />
                <span>Note</span>
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>Confirmer</span>
              </>
            )}
          </button>
        </div>

        {feedback && (
          <p
            role="status"
            className={`text-xs font-semibold ${
              feedback.ok
                ? "text-[var(--success-foreground)]"
                : "text-[var(--danger-foreground)]"
            }`}
          >
            {feedback.text}
          </p>
        )}

        {showForm && (
          <form
            onSubmit={handleConfirm}
            className="sk-animate-in mt-2 space-y-2.5 rounded-xl border border-[var(--primary-subtle-border)] bg-[var(--surface-secondary)] p-3.5"
          >
            <input type="hidden" name="matchId" value={matchId} />
            <input type="hidden" name="status" value="CONFIRMED" />
            <label
              htmlFor={`note-${matchId}`}
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              Ajouter une note sur votre rencontre (facultatif)
            </label>
            <input
              id={`note-${matchId}`}
              type="text"
              name="note"
              maxLength={250}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Café pris après le cours, super échange !"
              className="sk-input py-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="sk-btn sk-btn-secondary min-h-9 px-3 py-1.5 text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="sk-btn sk-btn-primary min-h-9 px-3.5 py-1.5 text-xs"
              >
                {loading ? "Validation…" : "Valider la rencontre"}
              </button>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}
