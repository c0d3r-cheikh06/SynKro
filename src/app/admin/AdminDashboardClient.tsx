"use client";

import {
  AccountStatus,
  ConfirmationStatus,
  MatchValidationStatus,
  PhotoStatus,
  ReportStatus,
  Role,
  WeekStatus,
} from "@prisma/client";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit3,
  Eye,
  FileText,
  Flag,
  HelpCircle,
  Layers,
  Lock,
  Mail,
  Network,
  Play,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { StudentAvatar } from "@/components/StudentAvatar";
import {
  adminApproveAllPendingPairsAction,
  adminCreateCycleAction,
  adminGenerateWeekMatchingAction,
  adminModeratePhotoAction,
  adminPublishWeekMatchingAction,
  adminRejectMatchPairAction,
  adminResolveReportAction,
  adminSendWeeklyReminderAction,
  adminUpdateAccountStatusAction,
  adminUpdateConfigAction,
  adminUpdateStudentInfoAction,
  adminUpsertGroupAction,
  adminValidateMatchPairAction,
} from "@/app/actions/admin-actions";
import {
  AppConfigItem,
  AuditLogView,
  CycleView,
  EmailAttemptView,
  GroupRecord,
  MatchPairExclusionView,
  MatchView,
  PhotoPublicationView,
  ReportView,
  UserRecord,
} from "@/lib/data-store";

interface AdminDashboardClientProps {
  currentUserRole: Role;
  groups: GroupRecord[];
  users: UserRecord[];
  cycles: CycleView[];
  matches: MatchView[];
  exclusions?: MatchPairExclusionView[];
  photos: PhotoPublicationView[];
  reports: ReportView[];
  auditLogs: AuditLogView[];
  emailAttempts: EmailAttemptView[];
  configs: AppConfigItem[];
}

type AdminTab =
  | "matching"
  | "students"
  | "groups"
  | "moderation"
  | "emails"
  | "config_audit";

export function AdminDashboardClient({
  currentUserRole,
  groups,
  users,
  cycles,
  matches,
  exclusions = [],
  photos,
  reports,
  auditLogs,
  emailAttempts,
  configs,
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("matching");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  // Matching preview & validation state
  const activeCycle =
    cycles.find((c) => c.status === "ACTIVE") ?? cycles[0] ?? null;
  const [selectedCycleId, setSelectedCycleId] = useState(
    activeCycle?.id ?? ""
  );
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(2);
  const [customSeed, setCustomSeed] = useState("");
  const [pairFilter, setPairFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("ALL");
  const [pairSearch, setPairSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<MatchView | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<MatchView | null>(null);
  const [approveAllConfirmOpen, setApproveAllConfirmOpen] = useState(false);
  const [selectedGroupByUser, setSelectedGroupByUser] = useState<
    Record<string, string>
  >({});

  // Student filtering & editing
  const [studentFilter, setStudentFilter] = useState<string>("ALL");
  const [studentSearch, setStudentSearch] = useState("");
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  // Group editing
  const [editingGroup, setEditingGroup] = useState<GroupRecord | null>(null);

  const runAction = async (
    fn: () => Promise<{ success: boolean; message: string }>
  ) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fn();
      setBanner({ ok: res.success, text: res.message });
    } catch (e) {
      setBanner({
        ok: false,
        text: e instanceof Error ? e.message : "Erreur inattendue",
      });
    } finally {
      setBusy(false);
    }
  };

  // Global metrics
  const activeStudentsCount = users.filter(
    (u) => u.status === AccountStatus.ACTIVE
  ).length;
  const pendingApprovalUsers = users.filter(
    (u) =>
      u.status === AccountStatus.PENDING_APPROVAL ||
      u.status === AccountStatus.PENDING_VERIFICATION ||
      u.status === AccountStatus.CORRECTION_REQUESTED
  );
  const confirmedMatchesCount = matches.filter((m) =>
    m.confirmations.some((c) => c.status === ConfirmationStatus.CONFIRMED)
  ).length;
  const mutualMatchesCount = matches.filter(
    (m) =>
      m.confirmations.filter((c) => c.status === ConfirmationStatus.CONFIRMED)
        .length >= 2
  ).length;
  const pendingPhotosCount = photos.filter(
    (p) => p.status === PhotoStatus.PENDING_MODERATION
  ).length;
  const pendingReportsCount = reports.filter(
    (r) => r.status === ReportStatus.PENDING
  ).length;

  const currentCycleObj =
    cycles.find((c) => c.id === selectedCycleId) ?? activeCycle;
  const selectedWeekObj =
    currentCycleObj?.weeks.find((w) => w.weekNumber === selectedWeekNumber) ??
    null;
  const selectedWeekMatches = selectedWeekObj
    ? matches.filter((m) => m.weekId === selectedWeekObj.id)
    : [];

  const filteredUsers = users.filter((u) => {
    if (studentFilter !== "ALL" && u.status !== studentFilter) return false;
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.groupName || "").toLowerCase().includes(q)
    );
  });

  const kpiItems = [
    {
      label: "Étudiants actifs",
      value: activeStudentsCount,
      sub: `dans ${groups.filter((g) => g.isActive).length} anciennes classes`,
      icon: Users,
      accent: "text-[var(--foreground)]",
    },
    {
      label: "Comptes à valider",
      value: pendingApprovalUsers.length,
      sub: "Approbation requise",
      icon: Clock,
      accent:
        pendingApprovalUsers.length > 0
          ? "text-[var(--warning)]"
          : "text-[var(--foreground)]",
    },
    {
      label: "Binômes générés",
      value: matches.length,
      sub: "0 intra-groupe",
      icon: Network,
      accent: "text-[var(--primary)]",
    },
    {
      label: "Rencontres confirmées",
      value: confirmedMatchesCount,
      sub: `dont ${mutualMatchesCount} mutuelles`,
      icon: UserCheck,
      accent: "text-[var(--success)]",
    },
    {
      label: "Photos à modérer",
      value: pendingPhotosCount,
      sub: "Album /retro",
      icon: Camera,
      accent: "text-[var(--foreground)]",
    },
    {
      label: "Signalements ouverts",
      value: pendingReportsCount,
      sub: "File de modération",
      icon: Flag,
      accent:
        pendingReportsCount > 0
          ? "text-[var(--danger)]"
          : "text-[var(--foreground)]",
    },
  ];

  const tabs = [
    {
      id: "matching" as const,
      label: "Cycles & Algorithme",
      badge: `${cycles.length}`,
      icon: Sparkles,
    },
    {
      id: "students" as const,
      label: "Étudiants & Approbations",
      badge: `${pendingApprovalUsers.length}`,
      icon: Users,
    },
    {
      id: "groups" as const,
      label: "Anciennes classes",
      badge: `${groups.length}`,
      icon: Layers,
    },
    {
      id: "moderation" as const,
      label: "Modération & Signalements",
      badge: `${pendingPhotosCount + pendingReportsCount}`,
      icon: Camera,
    },
    {
      id: "emails" as const,
      label: "Notifications & E-mails",
      badge: `${emailAttempts.length}`,
      icon: Mail,
    },
    {
      id: "config_audit" as const,
      label: "Configuration & Audit",
      badge: `${auditLogs.length}`,
      icon: ClipboardList,
    },
  ];

  return (
    <div className="space-y-8">
      {/* ==================== KPI STRIP ==================== */}
      <section
        aria-label="Indicateurs clés de pilotage"
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6"
      >
        {kpiItems.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="sk-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                  {kpi.label}
                </p>
                <Icon
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-[var(--primary)] opacity-80"
                />
              </div>
              <p className={`mt-2 font-mono text-2xl font-extrabold ${kpi.accent}`}>
                {kpi.value}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                {kpi.sub}
              </p>
            </div>
          );
        })}
      </section>

      {/* ==================== FEEDBACK BANNER ==================== */}
      {banner && (
        <div
          role="status"
          className={`sk-alert ${
            banner.ok ? "sk-alert-success" : "sk-alert-danger"
          }`}
        >
          {banner.ok ? (
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
          <span>{banner.text}</span>
        </div>
      )}

      {/* ==================== ADMIN SECTION NAVIGATION TABS ==================== */}
      <nav
        aria-label="Sections d'administration"
        className="sk-card flex gap-1.5 overflow-x-auto p-2"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                active
                  ? "bg-[var(--primary)] text-white shadow-2xs"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span>{tab.label}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-[var(--surface-secondary)] text-[var(--foreground)]"
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ==================== TAB 1: CYCLES & INTELLIGENT MATCHING ==================== */}
      {activeTab === "matching" && (() => {
        const activeCohort = users.filter(
          (u) =>
            u.role === Role.STUDENT &&
            u.status === AccountStatus.ACTIVE &&
            Boolean(u.groupId)
        );
        const requiredPairsTarget = Math.floor((activeCohort.length * 3) / 2);

        const approvedPairsList = selectedWeekMatches.filter(
          (m) => m.validationStatus === MatchValidationStatus.APPROVED
        );
        const pendingPairsList = selectedWeekMatches.filter(
          (m) => m.validationStatus === MatchValidationStatus.PENDING
        );
        const rejectedPairsList = selectedWeekMatches.filter(
          (m) => m.validationStatus === MatchValidationStatus.REJECTED
        );

        const approvedCount = approvedPairsList.length;
        const pendingCount = pendingPairsList.length;
        const rejectedCount = rejectedPairsList.length;
        const missingStudentSlots = Math.max(
          0,
          (requiredPairsTarget - approvedCount) * 2
        );

        const isWeekPublished = selectedWeekObj?.status === WeekStatus.PUBLISHED;
        const isWeekClosed = selectedWeekObj?.status === WeekStatus.CLOSED;
        const isReadyToPublish =
          !isWeekPublished &&
          !isWeekClosed &&
          pendingCount === 0 &&
          approvedCount >= requiredPairsTarget &&
          requiredPairsTarget > 0;

        let weekStateLabel = "En préparation";
        let weekStateBadgeClass = "sk-badge-neutral";
        if (isWeekPublished) {
          weekStateLabel = "Officiellement publiée";
          weekStateBadgeClass = "sk-badge-success";
        } else if (isWeekClosed) {
          weekStateLabel = "Clôturée (historique)";
          weekStateBadgeClass = "sk-badge-neutral";
        } else if (isReadyToPublish) {
          weekStateLabel = "Prête à être publiée";
          weekStateBadgeClass = "sk-badge-primary";
        } else if (approvedCount > 0 || pendingCount > 0) {
          weekStateLabel = "En cours de validation";
          weekStateBadgeClass = "sk-badge-warning";
        }

        const filteredPairs = selectedWeekMatches.filter((m) => {
          if (pairFilter === "PENDING" && m.validationStatus !== MatchValidationStatus.PENDING) {
            return false;
          }
          if (pairFilter === "APPROVED" && m.validationStatus !== MatchValidationStatus.APPROVED) {
            return false;
          }
          if (pairFilter === "REJECTED" && m.validationStatus !== MatchValidationStatus.REJECTED) {
            return false;
          }
          if (!pairSearch.trim()) return true;
          const q = pairSearch.toLowerCase();
          const matchA =
            m.studentA.firstName.toLowerCase().includes(q) ||
            m.studentA.lastName.toLowerCase().includes(q) ||
            (m.studentA.groupName || "").toLowerCase().includes(q);
          const matchB =
            m.studentB.firstName.toLowerCase().includes(q) ||
            m.studentB.lastName.toLowerCase().includes(q) ||
            (m.studentB.groupName || "").toLowerCase().includes(q);
          return matchA || matchB;
        });

        const cycleExclusions = (exclusions || []).filter(
          (e) => e.cycleId === currentCycleObj?.id
        );

        return (
          <div className="sk-animate-in space-y-6">
            {/* Header: Cycle & Week Selector */}
            <div className="sk-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="sk-badge sk-badge-primary">
                      Cycle en cours
                    </span>
                    <span className={`sk-badge ${weekStateBadgeClass}`}>
                      {weekStateLabel}
                    </span>
                  </div>
                  <h2 className="mt-2 text-xl font-extrabold text-[var(--foreground)]">
                    {currentCycleObj?.name ?? "Cycle de jumelage"} — Semaine{" "}
                    {selectedWeekNumber}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedCycleId}
                    onChange={(e) => setSelectedCycleId(e.target.value)}
                    className="sk-select py-1.5 text-xs font-semibold"
                  >
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.totalWeeks} sem.)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Week Navigation Pills */}
              <div className="mt-4">
                <span className="sk-label mb-2 block">
                  Semaines du cycle (choisir une semaine à préparer ou valider)
                </span>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {Array.from(
                    { length: currentCycleObj?.totalWeeks ?? 6 },
                    (_, i) => i + 1
                  ).map((wNum) => {
                    const wk = currentCycleObj?.weeks.find(
                      (w) => w.weekNumber === wNum
                    );
                    const isSel = selectedWeekNumber === wNum;
                    const wkMatches = matches.filter(
                      (m) => m.weekId === wk?.id
                    );
                    const wkApproved = wkMatches.filter(
                      (m) => m.validationStatus === MatchValidationStatus.APPROVED
                    ).length;

                    return (
                      <button
                        key={wNum}
                        type="button"
                        onClick={() => {
                          setSelectedWeekNumber(wNum);
                          setPairFilter("ALL");
                        }}
                        className={`flex flex-col items-center justify-center rounded-xl border p-2 text-xs font-bold transition-all ${
                          isSel
                            ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-2xs"
                            : wk?.status === WeekStatus.PUBLISHED
                              ? "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-foreground)]"
                              : wk?.status === WeekStatus.READY_TO_PUBLISH
                                ? "border-[var(--primary-subtle-border)] bg-[var(--primary-subtle)] text-[var(--primary-subtle-foreground)]"
                                : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <span className="font-mono text-sm">Semaine {wNum}</span>
                        <span className="mt-0.5 text-[10px] font-normal opacity-90">
                          {wk?.status === WeekStatus.PUBLISHED
                            ? "Publiée"
                            : wkApproved > 0
                              ? `${wkApproved} validée(s)`
                              : "En attente"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 5 Real DB-backed Validation Counters (Partie 3.4) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="sk-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">
                    Paires validées
                  </span>
                  <CheckCircle2
                    className="h-4 w-4 text-[var(--success)]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-mono text-2xl font-black text-[var(--success)]">
                  {approvedCount}
                  <span className="text-xs font-normal text-[var(--muted-foreground)]">
                    {" "}
                    / {requiredPairsTarget}
                  </span>
                </p>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  Verrouillées pour le cycle
                </span>
              </div>

              <div className="sk-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">
                    Paires en attente
                  </span>
                  <Clock
                    className="h-4 w-4 text-[var(--warning)]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-mono text-2xl font-black text-[var(--warning)]">
                  {pendingCount}
                </p>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  À valider ou remplacer
                </span>
              </div>

              <div className="sk-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">
                    Paires refusées
                  </span>
                  <ShieldAlert
                    className="h-4 w-4 text-[var(--danger)]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-mono text-2xl font-black text-[var(--danger)]">
                  {rejectedCount}
                </p>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  Exclues du cycle
                </span>
              </div>

              <div className="sk-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">
                    Places à pourvoir
                  </span>
                  <AlertCircle
                    className="h-4 w-4 text-[var(--primary)]"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-mono text-2xl font-black text-[var(--foreground)]">
                  {missingStudentSlots}
                </p>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  Places étudiantes
                </span>
              </div>

              <div className="sk-card col-span-2 p-4 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">
                    État de préparation
                  </span>
                  <Sparkles
                    className="h-4 w-4 text-[var(--primary)]"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-2">
                  <span className={`sk-badge ${weekStateBadgeClass} text-xs font-bold`}>
                    {weekStateLabel}
                  </span>
                </div>
                <span className="mt-1 block text-[11px] text-[var(--muted-foreground)]">
                  {isReadyToPublish
                    ? "Toutes les paires sont validées !"
                    : isWeekPublished
                      ? "Consultable par les étudiants"
                      : "Validation individuelle requise"}
                </span>
              </div>
            </div>

            {/* Workflow Control Actions */}
            <div className="sk-card p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-base font-bold text-[var(--foreground)]">
                    Actions d&apos;administration des jumelages
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Les paires validées restent <strong>verrouillées</strong>. La régénération recherche uniquement des remplaçants pour les places manquantes et exclut définitivement les paires refusées.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={busy || currentUserRole !== Role.ADMIN || isWeekPublished || isWeekClosed}
                    onClick={() =>
                      runAction(async () => {
                        const fd = new FormData();
                        fd.set("cycleId", currentCycleObj?.id || "");
                        fd.set("weekNumber", String(selectedWeekNumber));
                        if (customSeed.trim()) fd.set("seed", customSeed.trim());
                        return adminGenerateWeekMatchingAction(fd);
                      })
                    }
                    className="sk-btn sk-btn-primary min-h-10 text-xs font-bold"
                  >
                    <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {approvedCount > 0
                        ? `Générer des remplacements (${missingStudentSlots / 2 || 0} paire(s))`
                        : `Générer les propositions Semaine ${selectedWeekNumber}`}
                    </span>
                  </button>

                  {pendingCount > 0 && !isWeekPublished && (
                    <button
                      type="button"
                      disabled={busy || currentUserRole !== Role.ADMIN}
                      onClick={() => setApproveAllConfirmOpen(true)}
                      className="sk-btn sk-btn-secondary min-h-10 text-xs font-semibold"
                    >
                      <Check className="h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden="true" />
                      <span>Valider tout le lot ({pendingCount})</span>
                    </button>
                  )}

                  {!isWeekPublished && !isWeekClosed && (
                    <button
                      type="button"
                      disabled={busy || currentUserRole !== Role.ADMIN || !isReadyToPublish}
                      onClick={() => setPublishConfirmOpen(true)}
                      title={
                        isReadyToPublish
                          ? "Publier officiellement les jumelages pour tous les étudiants"
                          : "Toutes les places doivent être couvertes et validées (0 en attente, 0 manquante) avant publication"
                      }
                      className={`sk-btn min-h-10 text-xs font-bold ${
                        isReadyToPublish
                          ? "sk-btn-success shadow-xs"
                          : "cursor-not-allowed opacity-50 bg-[var(--surface-secondary)] text-[var(--muted-foreground)] border border-[var(--border)]"
                      }`}
                    >
                      <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Publier officiellement la Semaine {selectedWeekNumber}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Pair Proposals Management Section */}
            <div className="sk-card p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-[var(--foreground)]">
                    Propositions de jumelage — Semaine {selectedWeekNumber}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    Examinez et validez chaque paire individuellement. Refusez celles qui ne conviennent pas pour les remplacer sans perdre vos validations.
                  </p>
                </div>

                {/* Filter and Search */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      placeholder="Chercher un étudiant ou groupe…"
                      value={pairSearch}
                      onChange={(e) => setPairSearch(e.target.value)}
                      className="sk-input min-h-9 pl-8 text-xs"
                    />
                  </div>

                  <div className="flex rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 text-xs">
                    {(
                      [
                        { id: "ALL", label: `Toutes (${selectedWeekMatches.length})` },
                        { id: "PENDING", label: `En attente (${pendingCount})` },
                        { id: "APPROVED", label: `Validées (${approvedCount})` },
                        { id: "REJECTED", label: `Refusées (${rejectedCount})` },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPairFilter(f.id)}
                        className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                          pairFilter === f.id
                            ? "bg-[var(--surface)] text-[var(--foreground)] shadow-2xs"
                            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pair Cards / Table */}
              {selectedWeekMatches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/50 py-12 px-4 text-center text-sm text-[var(--muted-foreground)]">
                  Aucune proposition pour cette semaine. Cliquez sur{" "}
                  <strong className="text-[var(--foreground)]">
                    Générer les propositions Semaine {selectedWeekNumber}
                  </strong>{" "}
                  pour créer le premier lot de jumelages.
                </div>
              ) : filteredPairs.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--muted-foreground)]">
                  Aucune paire ne correspond au filtre sélectionné ({pairFilter}).
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {filteredPairs.map((m, idx) => {
                    const isApproved =
                      m.validationStatus === MatchValidationStatus.APPROVED;
                    const isPending =
                      m.validationStatus === MatchValidationStatus.PENDING;
                    const isRejected =
                      m.validationStatus === MatchValidationStatus.REJECTED;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col justify-between gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center ${
                          isApproved
                            ? "border-[var(--success-border)] bg-[var(--success-bg)]/20"
                            : isRejected
                              ? "border-[var(--danger-border)] bg-[var(--danger-bg)]/20 opacity-80"
                              : "border-[var(--border)] bg-[var(--surface)]"
                        }`}
                      >
                        {/* Participants details (strictly NO headcounts) */}
                        <div className="flex flex-1 flex-wrap items-center gap-4">
                          <span className="font-mono text-xs font-bold text-[var(--muted-foreground)]">
                            #{idx + 1}
                          </span>

                          {/* Student A */}
                          <div className="flex min-w-[200px] items-center gap-2.5">
                            <StudentAvatar
                              src={m.studentA.image}
                              firstName={m.studentA.firstName}
                              lastName={m.studentA.lastName}
                              seedKey={m.studentA.email || m.studentA.id}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[var(--foreground)]">
                                {m.studentA.firstName} {m.studentA.lastName}
                              </p>
                              <span className="sk-group-chip mt-0.5 inline-flex">
                                <span
                                  className="sk-group-dot"
                                  style={{
                                    backgroundColor:
                                      m.studentA.groupColor || "#2563EB",
                                  }}
                                />
                                <span>{m.studentA.groupName}</span>
                              </span>
                            </div>
                          </div>

                          <span className="font-mono text-xs font-extrabold text-[var(--primary)]">
                            ✕
                          </span>

                          {/* Student B */}
                          <div className="flex min-w-[200px] items-center gap-2.5">
                            <StudentAvatar
                              src={m.studentB.image}
                              firstName={m.studentB.firstName}
                              lastName={m.studentB.lastName}
                              seedKey={m.studentB.email || m.studentB.id}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[var(--foreground)]">
                                {m.studentB.firstName} {m.studentB.lastName}
                              </p>
                              <span className="sk-group-chip mt-0.5 inline-flex">
                                <span
                                  className="sk-group-dot"
                                  style={{
                                    backgroundColor:
                                      m.studentB.groupColor || "#173B67",
                                  }}
                                />
                                <span>{m.studentB.groupName}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status & Actions */}
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          {isApproved && (
                            <span className="sk-badge sk-badge-success flex items-center gap-1 text-xs">
                              <Lock className="h-3 w-3" aria-hidden="true" />
                              <span>Validée</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="sk-badge sk-badge-warning flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              <span>En attente</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="sk-badge sk-badge-danger flex items-center gap-1 text-xs" title={m.rejectionReason || "Exclue"}>
                              <X className="h-3 w-3" aria-hidden="true" />
                              <span>Refusée (exclue)</span>
                            </span>
                          )}

                          {/* Action Buttons */}
                          {!isWeekPublished && !isWeekClosed && (
                            <div className="flex items-center gap-1.5">
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy || currentUserRole !== Role.ADMIN}
                                    onClick={() =>
                                      runAction(async () => {
                                        const fd = new FormData();
                                        fd.set("matchId", m.id);
                                        fd.set("actionType", "APPROVE");
                                        return adminValidateMatchPairAction(fd);
                                      })
                                    }
                                    className="sk-btn sk-btn-success min-h-8 px-2.5 py-1 text-xs font-semibold"
                                  >
                                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Valider</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={busy || currentUserRole !== Role.ADMIN}
                                    onClick={() => {
                                      setRejectTarget(m);
                                      setRejectReason("Les deux étudiants se connaissent déjà");
                                    }}
                                    className="sk-btn sk-btn-danger min-h-8 px-2.5 py-1 text-xs font-semibold"
                                  >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>Refuser & remplacer</span>
                                  </button>
                                </>
                              )}

                              {isApproved && (
                                <button
                                  type="button"
                                  disabled={busy || currentUserRole !== Role.ADMIN}
                                  onClick={() => setUnlockTarget(m)}
                                  title="Remettre cette paire en attente si vous souhaitez autoriser une permutation"
                                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                >
                                  <Unlock className="h-3 w-3" aria-hidden="true" />
                                  <span>Déverrouiller</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Traceable Cycle Exclusions Log Panel (Partie 3.3 & 4.4) */}
            {cycleExclusions.length > 0 && (
              <div className="sk-card p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
                      <ShieldAlert className="h-4 w-4 text-[var(--danger)]" aria-hidden="true" />
                      <span>Journal des paires refusées & exclues du cycle ({cycleExclusions.length})</span>
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      Ces paires ne seront plus jamais reproposées pendant toute la durée de ce cycle de 6 semaines.
                    </p>
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                        <th className="py-2 pr-3 font-semibold">Paire exclue</th>
                        <th className="py-2 pr-3 font-semibold">Anciennes classes</th>
                        <th className="py-2 pr-3 font-semibold">Motif du refus</th>
                        <th className="py-2 font-semibold">Date d&apos;exclusion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {cycleExclusions.map((ex) => (
                        <tr key={ex.id}>
                          <td className="py-2 pr-3 font-bold text-[var(--foreground)]">
                            {ex.studentAName} ✕ {ex.studentBName}
                          </td>
                          <td className="py-2 pr-3 text-[var(--muted-foreground)]">
                            {ex.studentAGroup} / {ex.studentBGroup}
                          </td>
                          <td className="py-2 pr-3 text-[var(--danger)]">
                            {ex.reason || "Refusée par l'administrateur"}
                          </td>
                          <td className="py-2 font-mono text-[var(--muted-foreground)]">
                            {new Date(ex.createdAt).toLocaleDateString("fr-FR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ==================== MODALS ==================== */}

            {/* Rejection Modal */}
            {rejectTarget && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reject-dialog-title"
              >
                <div className="sk-card w-full max-w-md p-6 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--danger-bg)] text-[var(--danger)]">
                      <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 id="reject-dialog-title" className="text-base font-extrabold text-[var(--foreground)]">
                        Refuser cette proposition
                      </h4>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {rejectTarget.studentA.firstName} ✕ {rejectTarget.studentB.firstName}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    En refusant cette paire, elle sera <strong>exclue définitivement pour toutes les semaines de ce cycle</strong>. Lors de la prochaine génération, l&apos;algorithme recherchera automatiquement d&apos;autres camarades pour ces deux étudiants.
                  </p>

                  <div className="mt-4">
                    <label htmlFor="reject-reason-input" className="sk-label">
                      Motif du refus (optionnel)
                    </label>
                    <input
                      id="reject-reason-input"
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Ex : Les deux étudiants se connaissent déjà très bien"
                      className="sk-input text-xs"
                    />
                  </div>

                  <div className="mt-6 flex justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRejectTarget(null)}
                      className="sk-btn sk-btn-secondary text-xs"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(async () => {
                          const fd = new FormData();
                          fd.set("matchId", rejectTarget.id);
                          if (rejectReason.trim()) fd.set("reason", rejectReason.trim());
                          const res = await adminRejectMatchPairAction(fd);
                          setRejectTarget(null);
                          return res;
                        })
                      }
                      className="sk-btn sk-btn-danger text-xs font-bold"
                    >
                      Confirmer le refus & exclure du cycle
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Unlock Approved Pair Modal */}
            {unlockTarget && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
                role="dialog"
                aria-modal="true"
                aria-labelledby="unlock-dialog-title"
              >
                <div className="sk-card w-full max-w-md p-6 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--warning-bg)] text-[var(--warning-foreground)]">
                      <Unlock className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 id="unlock-dialog-title" className="text-base font-extrabold text-[var(--foreground)]">
                        Déverrouiller cette paire validée ?
                      </h4>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {unlockTarget.studentA.firstName} ✕ {unlockTarget.studentB.firstName}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    Cette paire a été précédemment validée. Si vous la remettez en attente, elle pourra être permutée lors de la prochaine génération de remplacement pour débloquer d&apos;autres places.
                  </p>

                  <div className="mt-6 flex justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setUnlockTarget(null)}
                      className="sk-btn sk-btn-secondary text-xs"
                    >
                      Conserver validée
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(async () => {
                          const fd = new FormData();
                          fd.set("matchId", unlockTarget.id);
                          fd.set("actionType", "UNLOCK");
                          const res = await adminValidateMatchPairAction(fd);
                          setUnlockTarget(null);
                          return res;
                        })
                      }
                      className="sk-btn sk-btn-primary text-xs font-bold"
                    >
                      Remettre en attente
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Approve All Pending Modal */}
            {approveAllConfirmOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
                role="dialog"
                aria-modal="true"
                aria-labelledby="approve-all-dialog-title"
              >
                <div className="sk-card w-full max-w-md p-6 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--success-bg)] text-[var(--success)]">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 id="approve-all-dialog-title" className="text-base font-extrabold text-[var(--foreground)]">
                        Valider toutes les paires en attente ?
                      </h4>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {pendingCount} proposition(s) en attente
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    Toutes les propositions actuellement en attente pour la Semaine {selectedWeekNumber} seront marquées comme <strong>validées</strong>. Elles seront verrouillées et la semaine sera prête pour publication officielle.
                  </p>

                  <div className="mt-6 flex justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setApproveAllConfirmOpen(false)}
                      className="sk-btn sk-btn-secondary text-xs"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(async () => {
                          const fd = new FormData();
                          fd.set("weekId", selectedWeekObj?.id || "");
                          const res = await adminApproveAllPendingPairsAction(fd);
                          setApproveAllConfirmOpen(false);
                          return res;
                        })
                      }
                      className="sk-btn sk-btn-success text-xs font-bold"
                    >
                      Confirmer la validation du lot ({pendingCount})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Publish Confirmation Modal with Full Verification Recap (Partie 5.3) */}
            {publishConfirmOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
                role="dialog"
                aria-modal="true"
                aria-labelledby="publish-dialog-title"
              >
                <div className="sk-card w-full max-w-lg p-6 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
                      <Send className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 id="publish-dialog-title" className="text-base font-extrabold text-[var(--foreground)]">
                        Confirmation de Publication Officielle
                      </h4>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Semaine {selectedWeekNumber} — {currentCycleObj?.name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 text-xs space-y-2.5">
                    <p className="font-bold text-[var(--foreground)]">
                      Récapitulatif des contrôles de conformité :
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[var(--muted-foreground)]">
                      <div>
                        Paires validées : <strong className="text-[var(--success)]">{approvedCount} / {requiredPairsTarget}</strong>
                      </div>
                      <div>
                        Paires en attente : <strong className="text-[var(--foreground)]">{pendingCount}</strong>
                      </div>
                      <div>
                        Paires refusées : <strong className="text-[var(--foreground)]">{rejectedCount}</strong>
                      </div>
                      <div>
                        Places restantes : <strong className="text-[var(--foreground)]">{missingStudentSlots}</strong>
                      </div>
                    </div>
                    <ul className="space-y-1 text-[11px] text-[var(--muted-foreground)] border-t border-[var(--border)] pt-2.5">
                      <li className="flex items-center gap-1.5 text-[var(--success-foreground)]">
                        <Check className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden="true" />
                        <span>0 paire au sein de la même ancienne classe (strictement entre anciennes classes)</span>
                      </li>
                      <li className="flex items-center gap-1.5 text-[var(--success-foreground)]">
                        <Check className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden="true" />
                        <span>0 doublon de jumelage dans la semaine</span>
                      </li>
                      <li className="flex items-center gap-1.5 text-[var(--success-foreground)]">
                        <Check className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden="true" />
                        <span>Aucune paire refusée n&apos;est réintroduite</span>
                      </li>
                      <li className="flex items-center gap-1.5 text-[var(--success-foreground)]">
                        <Check className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden="true" />
                        <span>Les notifications et courriels seront envoyés aux étudiants</span>
                      </li>
                    </ul>
                  </div>

                  <p className="mt-4 text-xs text-[var(--muted-foreground)] leading-relaxed">
                    Une fois publiée, cette semaine deviendra <strong>officielle</strong> et sera immédiatement visible par tous les étudiants concernés. Les régénérations ordinaires ne pourront plus la modifier.
                  </p>

                  <div className="mt-6 flex justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPublishConfirmOpen(false)}
                      className="sk-btn sk-btn-secondary text-xs"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(async () => {
                          const fd = new FormData();
                          fd.set("weekId", selectedWeekObj?.id || "");
                          const res = await adminPublishWeekMatchingAction(fd);
                          setPublishConfirmOpen(false);
                          return res;
                        })
                      }
                      className="sk-btn sk-btn-success text-xs font-bold"
                    >
                      Confirmer la publication officielle
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== TAB 2: STUDENTS & APPROVALS ==================== */}
      {activeTab === "students" && (
        <div className="sk-animate-in space-y-6">
          {/* Edit Student Modal/Drawer */}
          {editingUser && (
            <div className="sk-card sk-animate-in border-2 border-[var(--primary)] p-6">
              <h3 className="text-base font-extrabold text-[var(--foreground)]">
                Modifier les informations de {editingUser.firstName}{" "}
                {editingUser.lastName}
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  runAction(async () => {
                    const res = await adminUpdateStudentInfoAction(fd);
                    if (res.success) setEditingUser(null);
                    return res;
                  });
                }}
                className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
              >
                <input
                  type="hidden"
                  name="targetUserId"
                  value={editingUser.id}
                />
                <div>
                  <label className="sk-label">Prénom</label>
                  <input
                    type="text"
                    name="firstName"
                    defaultValue={editingUser.firstName}
                    required
                    className="sk-input py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="sk-label">Nom</label>
                  <input
                    type="text"
                    name="lastName"
                    defaultValue={editingUser.lastName}
                    required
                    className="sk-input py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="sk-label">Groupe</label>
                  <select
                    name="groupId"
                    defaultValue={editingUser.groupId || ""}
                    className="sk-select py-2 text-xs"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="sk-label">Rôle</label>
                  <select
                    name="role"
                    defaultValue={editingUser.role}
                    className="sk-select py-2 text-xs"
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="MODERATOR">MODERATOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="sk-label">Téléphone</label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingUser.phone || ""}
                    className="sk-input py-2 font-mono text-xs"
                  />
                </div>
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
                  <button
                    type="submit"
                    disabled={busy}
                    className="sk-btn sk-btn-primary py-2 text-xs"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="sk-btn sk-btn-secondary py-2 text-xs"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filters & Search Bar */}
          <div className="sk-card flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "ALL", label: `Tous (${users.length})` },
                {
                  id: "PENDING_APPROVAL",
                  label: `En attente d'approbation (${users.filter((u) => u.status === "PENDING_APPROVAL").length})`,
                },
                {
                  id: "PENDING_VERIFICATION",
                  label: `E-mail non vérifié (${users.filter((u) => u.status === "PENDING_VERIFICATION").length})`,
                },
                {
                  id: "ACTIVE",
                  label: `Actifs (${activeStudentsCount})`,
                },
                {
                  id: "SUSPENDED",
                  label: "Suspendus / Rejetés",
                },
              ].map((f) => {
                const isSelected = studentFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStudentFilter(f.id)}
                    aria-pressed={isSelected}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isSelected
                        ? "bg-[var(--primary)] text-white"
                        : "border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="sk-field-wrap w-full sm:max-w-xs">
              <Search aria-hidden="true" className="sk-field-icon" />
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Rechercher par nom, e-mail ou groupe…"
                className="sk-input sk-input-icon-left py-2 text-xs"
              />
            </div>
          </div>

          {/* Students Table */}
          <div className="sk-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Étudiant</th>
                    <th className="px-4 py-3 font-semibold">Groupe</th>
                    <th className="px-4 py-3 font-semibold">E-mail vérifié</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">Rôle</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actions administratives
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-[var(--surface-secondary)]/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            src={u.image}
                            firstName={u.firstName}
                            lastName={u.lastName}
                            seedKey={u.email || u.id}
                            size="sm"
                          />
                          <div>
                            <p className="font-bold text-[var(--foreground)]">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-[var(--muted-foreground)]">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="sk-group-chip">
                          <span
                            className="sk-group-dot"
                            style={{
                              backgroundColor: u.groupColor || "#2563EB",
                            }}
                          />
                          <span>{u.groupName || "Non assigné"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.emailVerified ? (
                          <span className="sk-badge sk-badge-success">Oui</span>
                        ) : (
                          <span className="sk-badge sk-badge-warning">
                            Non vérifié
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`sk-badge font-mono ${
                            u.status === AccountStatus.ACTIVE
                              ? "sk-badge-success"
                              : u.status === AccountStatus.PENDING_APPROVAL ||
                                  u.status ===
                                    AccountStatus.PENDING_VERIFICATION ||
                                  u.status ===
                                    AccountStatus.CORRECTION_REQUESTED
                                ? "sk-badge-warning"
                                : "sk-badge-danger"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-[var(--foreground)]">
                        {u.role}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {u.status !== AccountStatus.ACTIVE && (
                            <div className="inline-flex items-center gap-1.5">
                              {!u.groupId && (
                                <select
                                  aria-label={`Assigner une ancienne classe à ${u.firstName} ${u.lastName}`}
                                  value={selectedGroupByUser[u.id] || ""}
                                  onChange={(e) =>
                                    setSelectedGroupByUser((prev) => ({
                                      ...prev,
                                      [u.id]: e.target.value,
                                    }))
                                  }
                                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--foreground)]"
                                >
                                  <option value="">Choisir une ancienne classe…</option>
                                  {groups.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  runAction(async () => {
                                    const fd = new FormData();
                                    fd.set("targetUserId", u.id);
                                    fd.set("status", AccountStatus.ACTIVE);
                                    fd.set("verifyEmailNow", "true");
                                    const chosenGroup = selectedGroupByUser[u.id];
                                    if (chosenGroup) {
                                      fd.set("groupId", chosenGroup);
                                    }
                                    return adminUpdateAccountStatusAction(fd);
                                  })
                                }
                                className="sk-btn sk-btn-success px-2.5 py-1 text-[11px]"
                              >
                                Approuver
                              </button>
                            </div>
                          )}

                          {u.status !== AccountStatus.CORRECTION_REQUESTED && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(async () => {
                                  const fd = new FormData();
                                  fd.set("targetUserId", u.id);
                                  fd.set(
                                    "status",
                                    AccountStatus.CORRECTION_REQUESTED
                                  );
                                  fd.set(
                                    "reason",
                                    "Veuillez vérifier votre groupe et votre numéro WhatsApp."
                                  );
                                  return adminUpdateAccountStatusAction(fd);
                                })
                              }
                              className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--warning-foreground)]"
                            >
                              Correction
                            </button>
                          )}

                          {u.status === AccountStatus.ACTIVE ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(async () => {
                                  const fd = new FormData();
                                  fd.set("targetUserId", u.id);
                                  fd.set("status", AccountStatus.SUSPENDED);
                                  fd.set(
                                    "reason",
                                    "Suspension administrative."
                                  );
                                  return adminUpdateAccountStatusAction(fd);
                                })
                              }
                              className="sk-btn sk-btn-danger-outline px-2.5 py-1 text-[11px]"
                            >
                              Suspendre
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runAction(async () => {
                                  const fd = new FormData();
                                  fd.set("targetUserId", u.id);
                                  fd.set("status", AccountStatus.REJECTED);
                                  fd.set(
                                    "reason",
                                    "Compte non rattaché à la promotion."
                                  );
                                  return adminUpdateAccountStatusAction(fd);
                                })
                              }
                              className="sk-btn sk-btn-danger-outline px-2.5 py-1 text-[11px]"
                            >
                              Rejeter
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setEditingUser(u)}
                            className="sk-btn sk-btn-secondary px-2.5 py-1 text-[11px]"
                          >
                            <Edit3 aria-hidden="true" className="h-3 w-3" />
                            <span>Éditer</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: GROUPS MANAGEMENT ==================== */}
      {activeTab === "groups" && (
        <div className="sk-animate-in grid gap-6 lg:grid-cols-12">
          <div className="sk-card p-6 lg:col-span-5">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              {editingGroup
                ? `Modifier l'ancienne classe ${editingGroup.name}`
                : "Ajouter ou configurer une ancienne classe"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                runAction(async () => {
                  const res = await adminUpsertGroupAction(fd);
                  if (res.success) setEditingGroup(null);
                  return res;
                });
              }}
              className="mt-4 space-y-3.5"
            >
              <input
                type="hidden"
                name="groupId"
                value={editingGroup?.id || ""}
              />
              <div>
                <label className="sk-label">Nom de l'ancienne classe</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingGroup?.name || ""}
                  placeholder="Ex: DUT INFO"
                  className="sk-input py-2 text-xs"
                />
              </div>
              <div>
                <label className="sk-label">Slug (identifiant URL)</label>
                <input
                  type="text"
                  name="slug"
                  required
                  defaultValue={editingGroup?.slug || ""}
                  placeholder="Ex: dut-info"
                  className="sk-input py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="sk-label">
                  Description de l&apos;ancienne classe
                </label>
                <input
                  type="text"
                  name="description"
                  defaultValue={
                    editingGroup?.description?.replace(
                      /\s*\(~\d+\s*étudiants?\)/i,
                      ""
                    ) || ""
                  }
                  placeholder="Ex: DUT Informatique — Génie Logiciel & Systèmes"
                  className="sk-input py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="sk-label">Couleur (#RRGGBB)</label>
                  <input
                    type="text"
                    name="color"
                    defaultValue={editingGroup?.color || "#2563EB"}
                    className="sk-input py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="sk-label">Ordre d&apos;affichage</label>
                  <input
                    type="number"
                    name="order"
                    defaultValue={editingGroup?.order ?? groups.length + 1}
                    className="sk-input py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="sk-btn sk-btn-primary py-2.5 text-xs"
                >
                  {editingGroup ? "Mettre à jour" : "Enregistrer l'ancienne classe"}
                </button>
                {editingGroup && (
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    className="sk-btn sk-btn-secondary py-2.5 text-xs"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="sk-card p-6 lg:col-span-7">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">
              Anciennes classes configurées ({groups.length})
            </h2>
            <div className="mt-4 space-y-3">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="sk-surface-muted flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white/30"
                      style={{ backgroundColor: g.color || "#2563EB" }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[var(--foreground)]">
                          {g.name}
                        </p>
                        <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                          /{g.slug}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {g.description?.replace(
                          /\s*\(~\d+\s*étudiants?\)/i,
                          ""
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingGroup(g)}
                    className="sk-btn sk-btn-secondary px-3 py-1.5 text-xs"
                  >
                    Modifier
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: PHOTO MODERATION & REPORTS ==================== */}
      {activeTab === "moderation" && (
        <div className="sk-animate-in grid gap-6 lg:grid-cols-2">
          {/* Photo Moderation */}
          <div className="sk-card p-6">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--foreground)]">
              <Camera
                aria-hidden="true"
                className="h-5 w-5 text-[var(--primary)]"
              />
              <span>
                Modération de l&apos;Album Rétrospectif ({photos.length})
              </span>
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Une photo ne peut être approuvée que si tous les participants
              identifiés ont donné leur consentement.
            </p>

            <div className="mt-4 space-y-3.5">
              {photos.map((p) => (
                <div key={p.id} className="sk-surface-muted p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[var(--foreground)]">
                      Par {p.authorName} ({p.authorGroup})
                    </span>
                    <span className="sk-badge sk-badge-primary font-mono">
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[var(--foreground)]">{p.caption}</p>
                  <p className="mt-1 text-[var(--muted-foreground)]">
                    Consentements participants :{" "}
                    <strong className="text-[var(--foreground)]">
                      {p.allConsentsGiven
                        ? "Complet (tous ont accepté)"
                        : "En attente d'au moins un participant"}
                    </strong>
                  </p>

                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !p.allConsentsGiven}
                      onClick={() =>
                        runAction(async () => {
                          const fd = new FormData();
                          fd.set("photoId", p.id);
                          fd.set("status", PhotoStatus.APPROVED);
                          return adminModeratePhotoAction(fd);
                        })
                      }
                      className="sk-btn sk-btn-success px-3 py-1.5 text-xs"
                    >
                      Approuver & Publier
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(async () => {
                          const fd = new FormData();
                          fd.set("photoId", p.id);
                          fd.set("status", PhotoStatus.REJECTED);
                          fd.set(
                            "rejectionReason",
                            "Non conforme à la charte de l'album rétrospectif."
                          );
                          return adminModeratePhotoAction(fd);
                        })
                      }
                      className="sk-btn sk-btn-danger-outline px-3 py-1.5 text-xs"
                    >
                      Rejeter
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(async () => {
                          const fd = new FormData();
                          fd.set("photoId", p.id);
                          fd.set("status", PhotoStatus.WITHDRAWN);
                          return adminModeratePhotoAction(fd);
                        })
                      }
                      className="sk-btn sk-btn-secondary px-3 py-1.5 text-xs"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reports Queue */}
          <div className="sk-card p-6">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--foreground)]">
              <Flag
                aria-hidden="true"
                className="h-5 w-5 text-[var(--danger)]"
              />
              <span>Signalements ({reports.length})</span>
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Traitez les demandes de retrait ou signalements soumis par les
              membres.
            </p>

            <div className="mt-4 space-y-3.5">
              {reports.map((r) => (
                <div key={r.id} className="sk-surface-muted p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[var(--foreground)]">
                      Motif : {r.reason}
                    </span>
                    <span
                      className={`sk-badge font-mono ${
                        r.status === ReportStatus.PENDING
                          ? "sk-badge-warning"
                          : "sk-badge-success"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[var(--muted-foreground)]">
                    Signalé par {r.authorName}
                    {r.photoCaption ? ` • Photo : « ${r.photoCaption} »` : ""}
                  </p>
                  {r.details && (
                    <p className="mt-1 italic text-[var(--foreground)]">
                      {r.details}
                    </p>
                  )}

                  {r.status === ReportStatus.PENDING && (
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(async () => {
                            const fd = new FormData();
                            fd.set("reportId", r.id);
                            fd.set("status", ReportStatus.RESOLVED);
                            fd.set("withdrawPhoto", "true");
                            fd.set(
                              "resolution",
                              "Contenu retiré par la modération."
                            );
                            return adminResolveReportAction(fd);
                          })
                        }
                        className="rounded-xl bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Résoudre & Retirer la photo
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(async () => {
                            const fd = new FormData();
                            fd.set("reportId", r.id);
                            fd.set("status", ReportStatus.DISMISSED);
                            fd.set(
                              "resolution",
                              "Signalement classé sans suite après vérification."
                            );
                            return adminResolveReportAction(fd);
                          })
                        }
                        className="sk-btn sk-btn-secondary px-3 py-1.5 text-xs"
                      >
                        Classer sans suite
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 5: EMAILS & NOTIFICATIONS ==================== */}
      {activeTab === "emails" && (
        <div className="sk-animate-in space-y-6">
          <div className="sk-card flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="text-base font-extrabold text-[var(--foreground)]">
                Campagnes de rappels & E-mails transactionnels
              </h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Déclenchez manuellement un rappel hebdomadaire ou inspectez le
                journal des tentatives d&apos;envoi (`EmailDeliveryAttempt`).
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                runAction(async () => {
                  const fd = new FormData();
                  fd.set("weekNumber", String(selectedWeekNumber));
                  return adminSendWeeklyReminderAction(fd);
                })
              }
              className="sk-btn sk-btn-primary text-xs"
            >
              <Send aria-hidden="true" className="h-4 w-4" />
              <span>
                Envoyer le rappel hebdomadaire (Sem. {selectedWeekNumber})
              </span>
            </button>
          </div>

          <div className="sk-card p-6">
            <h3 className="text-sm font-bold text-[var(--foreground)]">
              Historique des envois d&apos;e-mails ({emailAttempts.length})
            </h3>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Destinataire</th>
                    <th className="px-4 py-2.5 font-semibold">Type</th>
                    <th className="px-4 py-2.5 font-semibold">Sujet</th>
                    <th className="px-4 py-2.5 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {emailAttempts.map((em) => (
                    <tr
                      key={em.id}
                      className="transition-colors hover:bg-[var(--surface-secondary)]/50"
                    >
                      <td className="px-4 py-2.5 font-mono text-[var(--foreground)]">
                        {em.toEmail}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[var(--muted-foreground)]">
                        {em.type}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-[var(--foreground)]">
                        {em.subject}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`sk-badge font-mono ${
                            em.status === "SENT"
                              ? "sk-badge-success"
                              : "sk-badge-danger"
                          }`}
                        >
                          {em.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 6: CONFIG & AUDIT LOG ==================== */}
      {activeTab === "config_audit" && (
        <div className="sk-animate-in grid gap-6 lg:grid-cols-12">
          {/* App Configuration */}
          <div className="sk-card p-6 lg:col-span-5">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--foreground)]">
              <Settings
                aria-hidden="true"
                className="h-5 w-5 text-[var(--primary)]"
              />
              <span>Configuration de l&apos;application</span>
            </h2>
            <div className="mt-4 space-y-3">
              {configs.map((cfg) => (
                <form
                  key={cfg.key}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    runAction(() => adminUpdateConfigAction(fd));
                  }}
                  className="sk-surface-muted p-3.5 text-xs"
                >
                  <input type="hidden" name="key" value={cfg.key} />
                  <p className="font-mono font-bold text-[var(--primary-subtle-foreground)]">
                    {cfg.key}
                  </p>
                  <p className="mt-0.5 text-[var(--muted-foreground)]">
                    {cfg.description}
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <input
                      type="text"
                      name="value"
                      defaultValue={cfg.value}
                      aria-label={cfg.key}
                      className="sk-input flex-1 py-1.5 font-mono text-xs"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="sk-btn sk-btn-primary px-3 py-1.5 text-xs"
                    >
                      Sauvegarder
                    </button>
                  </div>
                </form>
              ))}
            </div>
          </div>

          {/* Audit Logs */}
          <div className="sk-card p-6 lg:col-span-7">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[var(--foreground)]">
              <ShieldCheck
                aria-hidden="true"
                className="h-5 w-5 text-[var(--primary)]"
              />
              <span>
                Journal d&apos;Audit Administratif ({auditLogs.length})
              </span>
            </h2>
            <div className="mt-4 max-h-96 space-y-2.5 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="sk-surface-muted p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-[var(--primary-subtle-foreground)]">
                      {log.action}
                    </span>
                    <span className="text-[var(--muted-foreground)]">
                      Par {log.actorName}
                    </span>
                  </div>
                  {log.targetType && (
                    <p className="mt-1 text-[var(--muted-foreground)]">
                      Cible : {log.targetType} ({log.targetId})
                    </p>
                  )}
                  {log.details && (
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-[11px] text-[var(--foreground)]">
                      {JSON.stringify(log.details)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
