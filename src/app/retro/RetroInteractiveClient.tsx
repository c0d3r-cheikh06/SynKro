"use client";

import { ConsentStatus } from "@prisma/client";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { StudentAvatar } from "@/components/StudentAvatar";
import {
  createReportAction,
  respondPhotoConsentAction,
  submitRetroPhotoAction,
  withdrawPhotoAction,
} from "@/app/actions/retro-actions";
import { PhotoPublicationView } from "@/lib/data-store";

interface RetroClientProps {
  currentUserId: string;
  approvedPhotos: PhotoPublicationView[];
  myPhotos: PhotoPublicationView[];
  taggedPhotos: PhotoPublicationView[];
  eligibleParticipants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    groupName: string | null;
  }>;
  retroEnabled: boolean;
}

export function RetroInteractiveClient({
  currentUserId,
  approvedPhotos,
  myPhotos,
  taggedPhotos,
  eligibleParticipants,
  retroEnabled,
}: RetroClientProps) {
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [searchParticipant, setSearchParticipant] = useState("");
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Live Camera Capture State
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(
    null
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reporting modal state
  const [reportingPhotoId, setReportingPhotoId] = useState<string | null>(null);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch {
      setFeedback({
        ok: false,
        text: "Accès caméra non disponible sur cet appareil ou refusé. Utilisez le sélecteur de fichier (qui ouvre aussi l'appareil photo sur mobile).",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhotoFromVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `synkro-camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setCapturedFile(file);
        setCapturedPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setFeedback(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (capturedFile) {
      formData.set("photoFile", capturedFile);
    }

    selectedParticipants.forEach((pId) => {
      formData.append("participantIds", pId);
    });

    const res = await submitRetroPhotoAction(formData);
    setUploading(false);
    setFeedback({ ok: res.success, text: res.message });

    if (res.success) {
      form.reset();
      setCapturedFile(null);
      setCapturedPreviewUrl(null);
      setSelectedParticipants([]);
    }
  };

  const handleConsent = async (
    photoId: string,
    decision: "GIVEN" | "REVOKED"
  ) => {
    const fd = new FormData();
    fd.set("photoId", photoId);
    fd.set("decision", decision);
    const res = await respondPhotoConsentAction(fd);
    setFeedback({ ok: res.success, text: res.message });
  };

  const handleWithdraw = async (photoId: string) => {
    const fd = new FormData();
    fd.set("photoId", photoId);
    const res = await withdrawPhotoAction(fd);
    setFeedback({ ok: res.success, text: res.message });
  };

  const handleReportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await createReportAction(fd);
    setReportMsg(res.message);
    if (res.success) {
      setTimeout(() => {
        setReportingPhotoId(null);
        setReportMsg(null);
      }, 1500);
    }
  };

  const filteredParticipants = eligibleParticipants
    .filter((p) =>
      `${p.firstName} ${p.lastName} ${p.groupName || ""}`
        .toLowerCase()
        .includes(searchParticipant.toLowerCase())
    )
    .slice(0, 18);

  return (
    <div className="space-y-10">
      {feedback && (
        <div
          role="status"
          className={`sk-alert ${
            feedback.ok ? "sk-alert-success" : "sk-alert-danger"
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
          ) : (
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ==================== 1. CONSENT REQUESTS FOR TAGGED STUDENT ==================== */}
      {taggedPhotos.length > 0 && (
        <section
          aria-labelledby="consent-requests-heading"
          className="rounded-2xl border border-[var(--primary-subtle-border)] bg-[var(--primary-subtle)] p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="consent-requests-heading"
                className="flex items-center gap-2 text-lg font-extrabold text-[var(--foreground)]"
              >
                <ShieldCheck
                  aria-hidden="true"
                  className="h-5 w-5 text-[var(--primary)]"
                />
                <span>
                  Votre consentement sur les photos où vous êtes identifié(e) (
                  {taggedPhotos.length})
                </span>
              </h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Une photo ne peut jamais être publiée sans l&apos;accord de tous
                les participants identifiés. Vous pouvez également révoquer
                votre accord à tout moment.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {taggedPhotos.map((p) => {
              const myEntry = p.participants.find(
                (pt) => pt.userId === currentUserId
              );
              const isGiven = myEntry?.consentStatus === ConsentStatus.GIVEN;
              return (
                <div key={p.id} className="sk-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[var(--foreground)]">
                      Par {p.authorName}{" "}
                      <span className="font-normal text-[var(--muted-foreground)]">
                        ({p.authorGroup})
                      </span>
                    </span>
                    <span
                      className={`sk-badge ${
                        isGiven ? "sk-badge-success" : "sk-badge-warning"
                      }`}
                    >
                      Votre statut : {myEntry?.consentStatus}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    « {p.caption || "Sans légende"} »
                  </p>
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleConsent(p.id, "GIVEN")}
                      className="sk-btn sk-btn-success py-1.5 text-xs"
                    >
                      <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>J&apos;accorde mon consentement</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConsent(p.id, "REVOKED")}
                      className="sk-btn sk-btn-danger-outline py-1.5 text-xs"
                    >
                      <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
                      <span>Révoquer / Retirer la photo</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ==================== 2. PHOTO SUBMISSION & CAMERA FORM ==================== */}
      {retroEnabled && (
        <section
          aria-labelledby="add-memory-heading"
          className="sk-card p-6 sm:p-8"
        >
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-center">
            <div>
              <span className="sk-badge sk-badge-primary">
                <Sparkles aria-hidden="true" className="h-3 w-3" />
                <span>Nouveau souvenir</span>
              </span>
              <h2
                id="add-memory-heading"
                className="mt-1.5 flex items-center gap-2 text-lg font-extrabold text-[var(--foreground)]"
              >
                <Camera
                  aria-hidden="true"
                  className="h-5 w-5 text-[var(--primary)]"
                />
                <span>Ajouter un souvenir de rencontre</span>
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Prenez une photo avec vos jumeaux ou choisissez un fichier
                existant (JPEG, PNG, WebP — max 5 Mo, métadonnées EXIF/GPS
                automatiquement purgées).
              </p>
            </div>

            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="sk-btn sk-btn-subtle text-xs"
              >
                <Video
                  aria-hidden="true"
                  className="h-4 w-4 text-[var(--primary)]"
                />
                <span>Ouvrir la caméra en direct</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="sk-btn sk-btn-danger-outline text-xs"
              >
                <span>Fermer la caméra</span>
              </button>
            )}
          </div>

          {cameraActive && (
            <div className="sk-animate-in mt-5 overflow-hidden rounded-2xl border border-[var(--primary)] bg-slate-950 p-4 text-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="mx-auto max-h-80 rounded-xl"
              />
              <div className="mt-3 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={capturePhotoFromVideo}
                  className="sk-btn sk-btn-primary text-xs"
                >
                  <Camera aria-hidden="true" className="h-4 w-4" />
                  <span>Capturer cette photo</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: File + Caption */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="photoFile" className="sk-label">
                    1. Sélectionner ou prendre une photo
                  </label>
                  <input
                    id="photoFile"
                    name="photoFile"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    required={!capturedFile}
                    className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-[var(--muted-foreground)] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[var(--primary-hover)]"
                  />
                  {capturedPreviewUrl && (
                    <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)] p-2.5 text-xs text-[var(--success-foreground)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={capturedPreviewUrl}
                        alt="Aperçu capture caméra"
                        className="h-12 w-16 rounded-lg object-cover"
                      />
                      <span className="font-semibold">
                        Photo capturée depuis la caméra prête à l&apos;envoi
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="caption" className="sk-label">
                    2. Légende de la rencontre
                  </label>
                  <textarea
                    id="caption"
                    name="caption"
                    rows={3}
                    maxLength={400}
                    required
                    placeholder="Ex: Rencontre Semaine 1 entre DUT INFO, GLSI et SRT autour d'un café !"
                    className="sk-textarea"
                  />
                </div>
              </div>

              {/* Right Column: Participant Tagging */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="search-participant"
                    className="sk-label !mb-0 flex items-center gap-1.5"
                  >
                    <Users
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-[var(--primary)]"
                    />
                    <span>3. Identifier les jumeaux présents</span>
                  </label>
                  <span className="sk-badge sk-badge-primary font-mono">
                    {selectedParticipants.length} sélectionné(s)
                  </span>
                </div>

                <div className="sk-field-wrap">
                  <Search aria-hidden="true" className="sk-field-icon" />
                  <input
                    id="search-participant"
                    type="search"
                    value={searchParticipant}
                    onChange={(e) => setSearchParticipant(e.target.value)}
                    placeholder="Rechercher un étudiant par nom ou ancienne classe…"
                    className="sk-input sk-input-icon-left py-2 text-xs"
                  />
                </div>

                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2">
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {filteredParticipants.map((pt) => {
                      const checked = selectedParticipants.includes(pt.id);
                      return (
                        <button
                          key={pt.id}
                          type="button"
                          aria-pressed={checked}
                          onClick={() => toggleParticipant(pt.id)}
                          className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition-all ${
                            checked
                              ? "border-[var(--primary)] bg-[var(--primary)] font-semibold text-white shadow-2xs"
                              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary-subtle-border)]"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            {checked && (
                              <Check
                                aria-hidden="true"
                                className="h-3 w-3 shrink-0"
                              />
                            )}
                            <span className="truncate">
                              {pt.firstName} {pt.lastName}
                            </span>
                          </span>
                          <span
                            className={`ml-1.5 shrink-0 font-mono text-[10px] ${
                              checked
                                ? "text-blue-100"
                                : "text-[var(--muted-foreground)]"
                            }`}
                          >
                            {pt.groupName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
                  Chaque étudiant identifié recevra une notification de demande
                  de consentement.
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-[var(--border)] pt-4">
              <button
                type="submit"
                disabled={uploading}
                className="sk-btn sk-btn-primary px-6 py-3"
              >
                <Upload aria-hidden="true" className="h-4 w-4" />
                <span>
                  {uploading
                    ? "Nettoyage EXIF & envoi…"
                    : "Soumettre pour consentement & modération"}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ==================== 3. APPROVED PUBLIC RETRO GALLERY ==================== */}
      <section aria-labelledby="approved-gallery-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="approved-gallery-heading"
              className="text-xl font-extrabold tracking-tight text-[var(--foreground)]"
            >
              Photos publiées de la promotion ({approvedPhotos.length})
            </h2>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Toutes les photos ci-dessous ont reçu le consentement unanime des
              participants identifiés et la validation d&apos;un modérateur.
            </p>
          </div>
        </div>

        {approvedPhotos.length === 0 ? (
          <div className="sk-card mt-4 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-subtle)] text-[var(--primary)]">
              <Camera aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="mt-3 text-base font-bold text-[var(--foreground)]">
              Aucune photo publiée pour le moment
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Partagez votre premier souvenir de rencontre ci-dessus !
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {approvedPhotos.map((photo) => {
              const canWithdrawDirectly =
                photo.authorId === currentUserId ||
                photo.participants.some((p) => p.userId === currentUserId);

              return (
                <article
                  key={photo.id}
                  className="sk-card-interactive flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Framed Photo Container */}
                    <div className="relative aspect-16/10 w-full overflow-hidden border-b border-[var(--border)] bg-[#0F2342]">
                      <Image
                        src={photo.imageUrl}
                        alt={photo.caption || "Photo rencontre Synkro"}
                        fill
                        className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                      />
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/75 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur-xs">
                          <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                          <span>Consentements & modération validés</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <StudentAvatar
                            src={photo.authorImage}
                            firstName={photo.authorName.split(" ")[0] || "S"}
                            lastName={photo.authorName.split(" ")[1] || ""}
                            seedKey={photo.authorId}
                            size="xs"
                          />
                          <span className="font-bold text-[var(--foreground)]">
                            Publiée par {photo.authorName}{" "}
                            <span className="font-mono font-normal text-[var(--muted-foreground)]">
                              ({photo.authorGroup})
                            </span>
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
                        {photo.caption}
                      </p>

                      {photo.participants.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                            Jumeaux présents sur le souvenir :
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {photo.participants.map((pt) => (
                              <span
                                key={pt.userId}
                                className="sk-badge sk-badge-primary"
                              >
                                <Users aria-hidden="true" className="h-3 w-3" />
                                <span>
                                  {pt.firstName} {pt.lastName} ({pt.groupName})
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-5 pb-5 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3.5">
                      <button
                        type="button"
                        onClick={() =>
                          setReportingPhotoId((prev) =>
                            prev === photo.id ? null : photo.id
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger-foreground)]"
                      >
                        <Flag aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>Signaler ou demander un retrait</span>
                      </button>

                      {canWithdrawDirectly && (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(photo.id)}
                          className="sk-btn sk-btn-danger-outline px-3 py-1.5 text-xs"
                        >
                          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                          <span>Retirer immédiatement</span>
                        </button>
                      )}
                    </div>

                    {reportingPhotoId === photo.id && (
                      <form
                        onSubmit={handleReportSubmit}
                        className="sk-animate-in mt-3 space-y-2.5 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3.5"
                      >
                        <input type="hidden" name="photoId" value={photo.id} />
                        <p className="text-xs font-bold text-[var(--foreground)]">
                          Signaler ou demander le retrait de cette photo
                        </p>
                        <input
                          type="text"
                          name="reason"
                          required
                          placeholder="Motif (ex: Je souhaite retirer mon image / Contenu inapproprié)"
                          className="sk-input py-1.5 text-xs"
                        />
                        <textarea
                          name="details"
                          rows={2}
                          placeholder="Précisions complémentaires pour les modérateurs…"
                          className="sk-textarea py-1.5 text-xs"
                        />
                        {reportMsg && (
                          <p className="text-xs font-semibold text-[var(--success-foreground)]">
                            {reportMsg}
                          </p>
                        )}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReportingPhotoId(null)}
                            className="sk-btn sk-btn-secondary px-3 py-1.5 text-xs"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            className="rounded-xl bg-[var(--danger)] px-3.5 py-1.5 text-xs font-semibold text-white"
                          >
                            Envoyer le signalement
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================== 4. MY SUBMITTED PHOTOS STATUS ==================== */}
      {myPhotos.length > 0 && (
        <section className="sk-card p-6">
          <h2 className="text-base font-bold text-[var(--foreground)]">
            Mes soumissions de photos ({myPhotos.length})
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Suivez l&apos;état des consentements et de la modération pour vos
            souvenirs soumis.
          </p>
          <div className="mt-4 space-y-2.5">
            {myPhotos.map((p) => {
              const givenCount = p.participants.filter(
                (pt) => pt.consentStatus === ConsentStatus.GIVEN
              ).length;
              return (
                <div
                  key={p.id}
                  className="sk-surface-muted flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-[var(--foreground)]">
                      {p.caption || "Photo sans légende"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[var(--muted-foreground)]">
                      <Clock aria-hidden="true" className="h-3 w-3" />
                      <span>
                        Consentements participants : {givenCount}/
                        {p.participants.length}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="sk-badge sk-badge-primary font-mono">
                      {p.status}
                    </span>
                    {p.status !== "WITHDRAWN" && (
                      <button
                        type="button"
                        onClick={() => handleWithdraw(p.id)}
                        className="sk-btn sk-btn-danger-outline px-2.5 py-1 text-xs"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
