import {
  AccountStatus,
  ConfirmationStatus,
  ConsentStatus,
  CycleStatus,
  EmailStatus,
  EmailType,
  MatchValidationStatus,
  NotificationType,
  PhotoStatus,
  ReportStatus,
  Role,
  WeekStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeEmail } from "./crypto";
import {
  generateWeeklyMatching,
  MatchingGenerationStats,
  MatchingStudent,
} from "./matching/algorithm";
import { normalizePhoneNumber } from "./phone";
import { isDatabaseConnectionError, prisma } from "./prisma";
import { AVATAR_PRESETS, DEFAULT_GROUPS } from "./validation";

export interface GroupRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  order: number;
  studentCount: number;
}

export interface UserRecord {
  id: string;
  email: string;
  emailNormalized: string;
  emailVerified: Date | null;
  phone: string | null;
  phoneNormalized: string | null;
  firstName: string;
  lastName: string;
  passwordHash: string | null;
  image: string | null;
  bio: string | null;
  interests: string[];
  role: Role;
  status: AccountStatus;
  statusReason: string | null;
  groupId: string | null;
  groupName: string | null;
  groupColor: string | null;
  notifyEmail: boolean;
  notifyMatchPublished: boolean;
  notifyWeeklyReminder: boolean;
  notifyEndOfCycle: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface MatchConfirmationView {
  id: string;
  matchId: string;
  userId: string;
  status: ConfirmationStatus;
  confirmedAt: Date;
  note: string | null;
}

export interface MatchView {
  id: string;
  weekId: string;
  weekNumber: number;
  weekStatus: WeekStatus;
  cycleId: string;
  cycleName: string;
  studentA: UserRecord;
  studentB: UserRecord;
  validationStatus: MatchValidationStatus;
  validatedAt: Date | null;
  validatedById: string | null;
  rejectionReason: string | null;
  confirmations: MatchConfirmationView[];
  createdAt: Date;
}

export interface MatchPairExclusionView {
  id: string;
  cycleId: string;
  weekId: string | null;
  studentAId: string;
  studentBId: string;
  studentAName: string;
  studentBName: string;
  studentAGroup: string | null;
  studentBGroup: string | null;
  reason: string | null;
  createdById: string | null;
  createdAt: Date;
}

export interface WeekView {
  id: string;
  cycleId: string;
  weekNumber: number;
  status: WeekStatus;
  publishedAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  algorithmVersion: string | null;
  generationSeed: string | null;
  generationStats: MatchingGenerationStats | null;
  matchesCount: number;
}

export interface CycleView {
  id: string;
  name: string;
  description: string | null;
  status: CycleStatus;
  totalWeeks: number;
  startDate: Date | null;
  endDate: Date | null;
  timezone: string;
  weeks: WeekView[];
}

export interface NotificationView {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface PhotoParticipantView {
  userId: string;
  firstName: string;
  lastName: string;
  groupName: string | null;
  consentStatus: ConsentStatus;
}

export interface PhotoPublicationView {
  id: string;
  authorId: string;
  authorName: string;
  authorGroup: string | null;
  authorImage: string | null;
  caption: string | null;
  imageKey: string;
  imageUrl: string;
  status: PhotoStatus;
  rejectionReason: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  participants: PhotoParticipantView[];
  allConsentsGiven: boolean;
}

export interface ReportView {
  id: string;
  authorId: string;
  authorName: string;
  targetUserId: string | null;
  targetUserName: string | null;
  photoId: string | null;
  photoCaption: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolution: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface AuditLogView {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface EmailAttemptView {
  id: string;
  toEmail: string;
  subject: string;
  type: EmailType;
  status: EmailStatus;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface AppConfigItem {
  key: string;
  value: string;
  description: string;
  isPublic: boolean;
}

// ==================== FALLBACK MEMORY STORE (WHEN POSTGRESQL IS OFFLINE) ====================

interface FallbackState {
  groups: GroupRecord[];
  users: UserRecord[];
  cycles: CycleView[];
  matches: MatchView[];
  exclusions: MatchPairExclusionView[];
  notifications: NotificationView[];
  photos: PhotoPublicationView[];
  reports: ReportView[];
  auditLogs: AuditLogView[];
  emailAttempts: EmailAttemptView[];
  configs: AppConfigItem[];
  tokens: Array<{
    tokenHash: string;
    userId: string;
    type: "EMAIL_VERIFICATION" | "PASSWORD_RESET";
    expiresAt: Date;
    usedAt: Date | null;
  }>;
}

const globalFallback = globalThis as unknown as {
  __synkroFallbackState?: FallbackState;
};

const FIRST_NAMES = [
  "Mamadou", "Fatou", "Moussa", "Aminata", "Ibrahima", "Aïssatou", "Ousmane", "Mariama",
  "Cheikh", "Khadija", "Abdoulaye", "Ndèye", "Babacar", "Coumba", "Modou", "Awa",
  "Serigne", "Mame", "Pape", "Sokhna", "Alioune", "Seynabou", "El Hadji", "Astou",
];

const LAST_NAMES = [
  "Ndiaye", "Diop", "Fall", "Sow", "Ba", "Diallo", "Gueye", "Sy",
  "Sarr", "Cissé", "Seck", "Mbaye", "Thiam", "Faye", "Kane", "Toure",
];

const INTERESTS_POOL = [
  "Développement Web", "Cybersécurité", "Réseaux & Cisco", "Intelligence Artificielle",
  "Cloud & DevOps", "Mobile Flutter", "Linux & Open Source", "Data Science",
  "Design UI/UX", "Robotique", "Football", "Lecture & Mangas",
];

function initFallbackState(): FallbackState {
  if (globalFallback.__synkroFallbackState) {
    return globalFallback.__synkroFallbackState;
  }

  const now = new Date();
  const adminHash = bcrypt.hashSync("AdminSynkro2026!", 10);
  const studentHash = bcrypt.hashSync("EtudiantSynkro2026!", 10);

  const groups: GroupRecord[] = DEFAULT_GROUPS.map((g, i) => ({
    id: `grp-${g.slug}`,
    name: g.name,
    slug: g.slug,
    description: g.description,
    color: g.color,
    isActive: true,
    order: i + 1,
    studentCount: g.indicativeCount,
  }));

  const users: UserRecord[] = [];

  // Primary Administrator (Faze Thiam)
  const primaryAdminEmail = normalizeEmail(process.env.ADMIN_EMAIL || "fazethiam@gmail.com");
  const primaryAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || "passer123";
  const primaryAdminHash = bcrypt.hashSync(primaryAdminPassword, 10);

  const primaryAdminUser: UserRecord = {
    id: "admin-faze",
    email: primaryAdminEmail,
    emailNormalized: primaryAdminEmail,
    emailVerified: now,
    phone: "+221 77 100 00 00",
    phoneNormalized: "+221771000000",
    firstName: "Faze",
    lastName: "Thiam",
    passwordHash: primaryAdminHash,
    image: "/avatars/avatar-vector.svg",
    bio: "Administrateur principal de la plateforme Synkro.",
    interests: ["Architecture Logicielle", "Cybersécurité", "Intelligence Artificielle"],
    role: Role.ADMIN,
    status: AccountStatus.ACTIVE,
    statusReason: null,
    groupId: groups[0].id,
    groupName: groups[0].name,
    groupColor: groups[0].color,
    notifyEmail: true,
    notifyMatchPublished: true,
    notifyWeeklyReminder: true,
    notifyEndOfCycle: true,
    createdAt: now,
    lastLoginAt: now,
  };
  users.push(primaryAdminUser);

  // Admin account (also first member of DUT INFO)
  const adminUser: UserRecord = {
    id: "stu-001",
    email: "admin@synkro.app",
    emailNormalized: "admin@synkro.app",
    emailVerified: now,
    phone: "+221 77 100 00 01",
    phoneNormalized: "+221771000001",
    firstName: "Cheikh",
    lastName: "Ndiaye",
    passwordHash: adminHash,
    image: "/avatars/avatar-vector.svg",
    bio: "Administrateur Synkro & Étudiant en DUT INFO. Passionné d'architecture full-stack et de cybersécurité.",
    interests: ["Architecture Logicielle", "Cybersécurité", "Cloud & DevOps"],
    role: Role.ADMIN,
    status: AccountStatus.ACTIVE,
    statusReason: null,
    groupId: groups[0].id,
    groupName: groups[0].name,
    groupColor: groups[0].color,
    notifyEmail: true,
    notifyMatchPublished: true,
    notifyWeeklyReminder: true,
    notifyEndOfCycle: true,
    createdAt: now,
    lastLoginAt: now,
  };
  users.push(adminUser);

  // Primary demo student account (easy login: etudiant@synkro.app / EtudiantSynkro2026!)
  const demoStudent: UserRecord = {
    id: "stu-002",
    email: "etudiant@synkro.app",
    emailNormalized: "etudiant@synkro.app",
    emailVerified: now,
    phone: "+221 77 200 00 02",
    phoneNormalized: "+221772000002",
    firstName: "Fatou",
    lastName: "Diop",
    passwordHash: studentHash,
    image: "/avatars/avatar-pixel.svg",
    bio: "Étudiante en DUT INFO, fan de développement web moderne, d'algorithmique et de design d'interfaces.",
    interests: ["Développement Web", "Design UI/UX", "Intelligence Artificielle"],
    role: Role.STUDENT,
    status: AccountStatus.ACTIVE,
    statusReason: null,
    groupId: groups[0].id,
    groupName: groups[0].name,
    groupColor: groups[0].color,
    notifyEmail: true,
    notifyMatchPublished: true,
    notifyWeeklyReminder: true,
    notifyEndOfCycle: true,
    createdAt: now,
    lastLoginAt: now,
  };
  users.push(demoStudent);

  // Moderator account (first member of DUT TR)
  const modUser: UserRecord = {
    id: "stu-024",
    email: "moderateur@synkro.app",
    emailNormalized: "moderateur@synkro.app",
    emailVerified: now,
    phone: "+221 77 100 00 02",
    phoneNormalized: "+221771000002",
    firstName: "Aminata",
    lastName: "Fall",
    passwordHash: adminHash,
    image: "/avatars/avatar-nova.svg",
    bio: "Modératrice de la promotion & étudiante en DUT Télécoms & Réseaux.",
    interests: ["Réseaux & Cisco", "Cybersécurité", "Linux & Open Source"],
    role: Role.MODERATOR,
    status: AccountStatus.ACTIVE,
    statusReason: null,
    groupId: groups[1].id,
    groupName: groups[1].name,
    groupColor: groups[1].color,
    notifyEmail: true,
    notifyMatchPublished: true,
    notifyWeeklyReminder: true,
    notifyEndOfCycle: true,
    createdAt: now,
    lastLoginAt: now,
  };

  let stuCounter = 3;
  const groupTargetCounts = [23, 23, 8, 8, 6]; // Total = 68 active students

  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const grp = groups[gIdx];
    const target = groupTargetCounts[gIdx];
    const alreadyInGroup =
      gIdx === 0 ? 2 : gIdx === 1 ? 1 : 0;

    if (gIdx === 1) {
      users.push(modUser);
    }

    for (let k = alreadyInGroup + 1; k <= target; k++) {
      if (stuCounter === 24) stuCounter++;
      const id = `stu-${String(stuCounter).padStart(3, "0")}`;
      const fName = FIRST_NAMES[(stuCounter - 1) % FIRST_NAMES.length];
      const lName = LAST_NAMES[(stuCounter * 3 + k) % LAST_NAMES.length];
      const email = `etudiant${stuCounter}.${grp.slug}@synkro.app`;
      const rawPhone = `77${String(3100000 + stuCounter).slice(0, 7)}`;

      users.push({
        id,
        email,
        emailNormalized: email,
        emailVerified: now,
        phone: `+221 ${rawPhone.slice(0, 2)} ${rawPhone.slice(2, 5)} ${rawPhone.slice(5, 7)} ${rawPhone.slice(7, 9)}`,
        phoneNormalized: normalizePhoneNumber(rawPhone),
        firstName: fName,
        lastName: lName,
        passwordHash: studentHash,
        image: AVATAR_PRESETS[stuCounter % AVATAR_PRESETS.length].url,
        bio: `Étudiant(e) en ${grp.name}. Toujours partant(e) pour échanger autour d'un café et partager nos projets entre anciennes classes !`,
        interests: [
          INTERESTS_POOL[stuCounter % INTERESTS_POOL.length],
          INTERESTS_POOL[(stuCounter + 4) % INTERESTS_POOL.length],
          INTERESTS_POOL[(stuCounter + 7) % INTERESTS_POOL.length],
        ],
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        statusReason: null,
        groupId: grp.id,
        groupName: grp.name,
        groupColor: grp.color,
        notifyEmail: true,
        notifyMatchPublished: true,
        notifyWeeklyReminder: true,
        notifyEndOfCycle: true,
        createdAt: now,
        lastLoginAt: null,
      });

      stuCounter++;
    }
  }

  // Add 3 non-active accounts to showcase admin approval/correction workflows
  users.push(
    {
      id: "stu-pending-1",
      email: "oumar.diagne@synkro.app",
      emailNormalized: "oumar.diagne@synkro.app",
      emailVerified: now,
      phone: "+221 78 401 22 33",
      phoneNormalized: "+221784012233",
      firstName: "Oumar",
      lastName: "Diagne",
      passwordHash: studentHash,
      image: "/avatars/avatar-orbit.svg",
      bio: "Nouvel étudiant en GLSI, e-mail vérifié, en attente d'approbation par l'administrateur.",
      interests: ["Développement Web", "Cloud & DevOps"],
      role: Role.STUDENT,
      status: AccountStatus.PENDING_APPROVAL,
      statusReason: null,
      groupId: groups[2].id,
      groupName: groups[2].name,
      groupColor: groups[2].color,
      notifyEmail: true,
      notifyMatchPublished: true,
      notifyWeeklyReminder: true,
      notifyEndOfCycle: true,
      createdAt: now,
      lastLoginAt: null,
    },
    {
      id: "stu-pending-2",
      email: "khadija.sarr@synkro.app",
      emailNormalized: "khadija.sarr@synkro.app",
      emailVerified: now,
      phone: "+221 76 512 44 55",
      phoneNormalized: "+221765124455",
      firstName: "Khadija",
      lastName: "Sarr",
      passwordHash: studentHash,
      image: "/avatars/avatar-cipher.svg",
      bio: "Étudiante en SRT souhaitant rejoindre le cycle de jumelage.",
      interests: ["Réseaux & Cisco", "Data Science"],
      role: Role.STUDENT,
      status: AccountStatus.PENDING_APPROVAL,
      statusReason: null,
      groupId: groups[3].id,
      groupName: groups[3].name,
      groupColor: groups[3].color,
      notifyEmail: true,
      notifyMatchPublished: true,
      notifyWeeklyReminder: true,
      notifyEndOfCycle: true,
      createdAt: now,
      lastLoginAt: null,
    },
    {
      id: "stu-unverified-1",
      email: "nonverifie@synkro.app",
      emailNormalized: "nonverifie@synkro.app",
      emailVerified: null,
      phone: "+221 70 800 99 00",
      phoneNormalized: "+221708009900",
      firstName: "Bamba",
      lastName: "Seck",
      passwordHash: studentHash,
      image: "/avatars/avatar-nexus.svg",
      bio: "Compte en attente de vérification d'adresse e-mail.",
      interests: ["Linux & Open Source"],
      role: Role.STUDENT,
      status: AccountStatus.PENDING_VERIFICATION,
      statusReason: null,
      groupId: groups[4].id,
      groupName: groups[4].name,
      groupColor: groups[4].color,
      notifyEmail: true,
      notifyMatchPublished: true,
      notifyWeeklyReminder: true,
      notifyEndOfCycle: true,
      createdAt: now,
      lastLoginAt: null,
    }
  );

  const activeMatchingStudents: MatchingStudent[] = users
    .filter((u) => u.status === AccountStatus.ACTIVE && u.groupId && u.groupName)
    .map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      groupId: u.groupId!,
      groupName: u.groupName!,
    }));

  const userById = new Map(users.map((u) => [u.id, u]));

  // Generate Week 1 (PUBLISHED) and Week 2 (PREVIEWING) using the real algorithm
  const week1Gen = generateWeeklyMatching({
    students: activeMatchingStudents,
    historicalPairs: [],
    weekNumber: 1,
    totalWeeksInCycle: 6,
    targetPartnersPerWeek: 3,
    seed: "synkro-2026-sem1-w1",
  });

  const week2Gen = generateWeeklyMatching({
    students: activeMatchingStudents,
    historicalPairs: week1Gen.pairs.map((p) => ({
      studentAId: p.studentAId,
      studentBId: p.studentBId,
      weekNumber: 1,
    })),
    weekNumber: 2,
    totalWeeksInCycle: 6,
    targetPartnersPerWeek: 3,
    seed: "synkro-2026-sem1-w2",
  });

  const cycleId = "cycle-semestre-1";
  const week1Id = "week-sem1-1";
  const week2Id = "week-sem1-2";

  const matches: MatchView[] = [];

  week1Gen.pairs.forEach((p, idx) => {
    const sA = userById.get(p.studentAId)!;
    const sB = userById.get(p.studentBId)!;
    const matchId = `match-w1-${idx + 1}`;
    const confirmations: MatchConfirmationView[] = [];

    // Pre-populate some mutual and one-sided confirmations for Week 1
    if (idx % 3 === 0) {
      confirmations.push(
        {
          id: `conf-${matchId}-a`,
          matchId,
          userId: sA.id,
          status: ConfirmationStatus.CONFIRMED,
          confirmedAt: now,
          note: "Super échange autour de nos projets respectifs !",
        },
        {
          id: `conf-${matchId}-b`,
          matchId,
          userId: sB.id,
          status: ConfirmationStatus.CONFIRMED,
          confirmedAt: now,
          note: "Rencontre très enrichissante à la cafétéria.",
        }
      );
    } else if (idx % 3 === 1) {
      confirmations.push({
        id: `conf-${matchId}-b`,
        matchId,
        userId: sB.id,
        status: ConfirmationStatus.CONFIRMED,
        confirmedAt: now,
        note: "Discussion lancée après les cours.",
      });
    }

    matches.push({
      id: matchId,
      weekId: week1Id,
      weekNumber: 1,
      weekStatus: WeekStatus.PUBLISHED,
      cycleId,
      cycleName: "Cycle Semestre 1 — Anciennes Classes",
      studentA: sA,
      studentB: sB,
      validationStatus: MatchValidationStatus.APPROVED,
      validatedAt: now,
      validatedById: "adm-1",
      rejectionReason: null,
      confirmations,
      createdAt: now,
    });
  });

  week2Gen.pairs.forEach((p, idx) => {
    const sA = userById.get(p.studentAId)!;
    const sB = userById.get(p.studentBId)!;
    matches.push({
      id: `match-w2-${idx + 1}`,
      weekId: week2Id,
      weekNumber: 2,
      weekStatus: WeekStatus.PREVIEWING,
      cycleId,
      cycleName: "Cycle Semestre 1 — Anciennes Classes",
      studentA: sA,
      studentB: sB,
      validationStatus: MatchValidationStatus.PENDING,
      validatedAt: null,
      validatedById: null,
      rejectionReason: null,
      confirmations: [],
      createdAt: now,
    });
  });

  const weeks: WeekView[] = [
    {
      id: week1Id,
      cycleId,
      weekNumber: 1,
      status: WeekStatus.PUBLISHED,
      publishedAt: now,
      startDate: now,
      endDate: new Date(now.getTime() + 7 * 86400000),
      algorithmVersion: week1Gen.stats.algorithmVersion,
      generationSeed: week1Gen.stats.seed,
      generationStats: week1Gen.stats,
      matchesCount: week1Gen.pairs.length,
    },
    {
      id: week2Id,
      cycleId,
      weekNumber: 2,
      status: WeekStatus.PREVIEWING,
      publishedAt: null,
      startDate: new Date(now.getTime() + 7 * 86400000),
      endDate: new Date(now.getTime() + 14 * 86400000),
      algorithmVersion: week2Gen.stats.algorithmVersion,
      generationSeed: week2Gen.stats.seed,
      generationStats: week2Gen.stats,
      matchesCount: week2Gen.pairs.length,
    },
    ...[3, 4, 5, 6].map((wNum) => ({
      id: `week-sem1-${wNum}`,
      cycleId,
      weekNumber: wNum,
      status: WeekStatus.DRAFT,
      publishedAt: null,
      startDate: new Date(now.getTime() + (wNum - 1) * 7 * 86400000),
      endDate: new Date(now.getTime() + wNum * 7 * 86400000),
      algorithmVersion: null,
      generationSeed: null,
      generationStats: null,
      matchesCount: 0,
    })),
  ];

  const cycles: CycleView[] = [
    {
      id: cycleId,
      name: "Cycle Semestre 1 — Anciennes Classes",
      description:
        "Programme officiel de 6 semaines pour connecter les 5 groupes de la promotion (DUT INFO, DUT TR, GLSI, SRT, Autres).",
      status: CycleStatus.ACTIVE,
      totalWeeks: 6,
      startDate: now,
      endDate: new Date(now.getTime() + 42 * 86400000),
      timezone: "Africa/Dakar",
      weeks,
    },
  ];

  const photos: PhotoPublicationView[] = [
    {
      id: "photo-1",
      authorId: demoStudent.id,
      authorName: `${demoStudent.firstName} ${demoStudent.lastName}`,
      authorGroup: demoStudent.groupName,
      authorImage: demoStudent.image,
      caption:
        "Première rencontre Synkro entre DUT INFO, DUT TR et GLSI autour d'un atelier d'architecture réseau !",
      imageKey: "retro/demo-encounter-1.svg",
      imageUrl: "/retro-demo-1.svg",
      status: PhotoStatus.APPROVED,
      rejectionReason: null,
      publishedAt: now,
      createdAt: now,
      participants: [
        {
          userId: modUser.id,
          firstName: modUser.firstName,
          lastName: modUser.lastName,
          groupName: modUser.groupName,
          consentStatus: ConsentStatus.GIVEN,
        },
      ],
      allConsentsGiven: true,
    },
    {
      id: "photo-2",
      authorId: modUser.id,
      authorName: `${modUser.firstName} ${modUser.lastName}`,
      authorGroup: modUser.groupName,
      authorImage: modUser.image,
      caption:
        "Session révision et débriefing de la Semaine 1 avec nos jumeaux SRT et Autres.",
      imageKey: "retro/demo-encounter-2.svg",
      imageUrl: "/retro-demo-2.svg",
      status: PhotoStatus.PENDING_MODERATION,
      rejectionReason: null,
      publishedAt: null,
      createdAt: now,
      participants: [
        {
          userId: demoStudent.id,
          firstName: demoStudent.firstName,
          lastName: demoStudent.lastName,
          groupName: demoStudent.groupName,
          consentStatus: ConsentStatus.GIVEN,
        },
        {
          userId: adminUser.id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          groupName: adminUser.groupName,
          consentStatus: ConsentStatus.PENDING,
        },
      ],
      allConsentsGiven: false,
    },
  ];

  const notifications: NotificationView[] = [
    {
      id: "notif-1",
      userId: demoStudent.id,
      type: NotificationType.MATCH_PUBLISHED,
      title: "Semaine 1 publiée — Découvrez vos 3 jumeaux !",
      body: "Vos 3 partenaires inter-groupes de la Semaine 1 sont disponibles sur votre tableau de bord.",
      link: "/dashboard",
      isRead: false,
      createdAt: now,
    },
    {
      id: "notif-2",
      userId: adminUser.id,
      type: NotificationType.MATCH_PUBLISHED,
      title: "Semaine 1 publiée (102 paires générées)",
      body: "Les 68 étudiants actifs ont reçu exactement 3 partenaires hors de leur groupe (0 répétition).",
      link: "/admin",
      isRead: false,
      createdAt: now,
    },
  ];

  const reports: ReportView[] = [
    {
      id: "rep-1",
      authorId: demoStudent.id,
      authorName: `${demoStudent.firstName} ${demoStudent.lastName}`,
      targetUserId: null,
      targetUserName: null,
      photoId: "photo-1",
      photoCaption: "Première rencontre Synkro entre DUT INFO, DUT TR et GLSI...",
      reason: "Vérification du floutage d'arrière-plan",
      details: "Simple signalement de test pour vérifier la file de modération.",
      status: ReportStatus.PENDING,
      resolution: null,
      createdAt: now,
      resolvedAt: null,
    },
  ];

  const auditLogs: AuditLogView[] = [
    {
      id: "audit-1",
      actorId: adminUser.id,
      actorName: `${adminUser.firstName} ${adminUser.lastName}`,
      action: "PUBLISH_WEEK_MATCHING",
      targetType: "MatchingWeek",
      targetId: week1Id,
      details: {
        weekNumber: 1,
        pairsGenerated: week1Gen.pairs.length,
        seed: week1Gen.stats.seed,
      },
      createdAt: now,
    },
    {
      id: "audit-2",
      actorId: adminUser.id,
      actorName: `${adminUser.firstName} ${adminUser.lastName}`,
      action: "GENERATE_WEEK_PREVIEW",
      targetType: "MatchingWeek",
      targetId: week2Id,
      details: {
        weekNumber: 2,
        pairsGenerated: week2Gen.pairs.length,
        repeatPairsCount: week2Gen.stats.repeatPairsCount,
      },
      createdAt: now,
    },
  ];

  const emailAttempts: EmailAttemptView[] = [
    {
      id: "em-1",
      toEmail: demoStudent.email,
      subject: "Semaine 1 (Cycle Semestre 1) : Vos nouveaux jumeaux Synkro sont disponibles !",
      type: EmailType.MATCH_PUBLISHED,
      status: EmailStatus.SENT,
      errorMessage: null,
      sentAt: now,
      createdAt: now,
    },
    {
      id: "em-2",
      toEmail: "oumar.diagne@synkro.app",
      subject: "Vérifiez votre adresse e-mail — Synkro",
      type: EmailType.EMAIL_VERIFICATION,
      status: EmailStatus.SENT,
      errorMessage: null,
      sentAt: now,
      createdAt: now,
    },
  ];

  const configs: AppConfigItem[] = [
    {
      key: "allow_student_name_edit",
      value: "false",
      description: "Autoriser les étudiants à modifier leur prénom/nom après validation administrative",
      isPublic: true,
    },
    {
      key: "target_partners_per_week",
      value: "3",
      description: "Nombre cible de jumeaux différents par étudiant et par semaine",
      isPublic: true,
    },
    {
      key: "default_cycle_weeks",
      value: "6",
      description: "Durée standard d'un cycle de jumelage (en semaines)",
      isPublic: true,
    },
    {
      key: "retro_album_enabled",
      value: "true",
      description: "Activer l'album rétrospectif /retro avec consentement des participants et modération",
      isPublic: true,
    },
  ];

  const state: FallbackState = {
    groups,
    users,
    cycles,
    matches,
    exclusions: [],
    notifications,
    photos,
    reports,
    auditLogs,
    emailAttempts,
    configs,
    tokens: [],
  };

  globalFallback.__synkroFallbackState = state;
  return state;
}

export function getFallbackStore(): FallbackState {
  return initFallbackState();
}

// ==================== UNIFIED DATA ACCESS LAYER ====================

export async function getActiveGroups(): Promise<{
  groups: GroupRecord[];
  dbConnected: boolean;
}> {
  try {
    const dbGroups = await prisma.group.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
    return {
      dbConnected: true,
      groups: dbGroups.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        description: g.description,
        color: g.color,
        isActive: g.isActive,
        order: g.order,
        studentCount: g._count.users,
      })),
    };
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      const store = getFallbackStore();
      return { dbConnected: false, groups: store.groups };
    }
    throw err;
  }
}

export async function findUserByEmail(email: string): Promise<{
  user: UserRecord | null;
  dbConnected: boolean;
}> {
  const norm = normalizeEmail(email);
  try {
    const u = await prisma.user.findFirst({
      where: {
        OR: [{ emailNormalized: norm }, { email: norm }],
      },
      include: { group: true },
    });
    if (!u) return { user: null, dbConnected: true };
    return {
      dbConnected: true,
      user: {
        id: u.id,
        email: u.email,
        emailNormalized: u.emailNormalized,
        emailVerified: u.emailVerified,
        phone: u.phone,
        phoneNormalized: u.phoneNormalized,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash: u.passwordHash,
        image: u.image,
        bio: u.bio,
        interests: u.interests,
        role: u.role,
        status: u.status,
        statusReason: u.statusReason,
        groupId: u.groupId,
        groupName: u.group?.name ?? null,
        groupColor: u.group?.color ?? null,
        notifyEmail: u.notifyEmail,
        notifyMatchPublished: u.notifyMatchPublished,
        notifyWeeklyReminder: u.notifyWeeklyReminder,
        notifyEndOfCycle: u.notifyEndOfCycle,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      },
    };
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      const store = getFallbackStore();
      const found =
        store.users.find(
          (u) => u.emailNormalized === norm || u.email.toLowerCase() === norm
        ) ?? null;
      return { user: found, dbConnected: false };
    }
    throw err;
  }
}

export async function findUserById(id: string): Promise<{
  user: UserRecord | null;
  dbConnected: boolean;
}> {
  try {
    const u = await prisma.user.findUnique({
      where: { id },
      include: { group: true },
    });
    if (!u) return { user: null, dbConnected: true };
    return {
      dbConnected: true,
      user: {
        id: u.id,
        email: u.email,
        emailNormalized: u.emailNormalized,
        emailVerified: u.emailVerified,
        phone: u.phone,
        phoneNormalized: u.phoneNormalized,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash: u.passwordHash,
        image: u.image,
        bio: u.bio,
        interests: u.interests,
        role: u.role,
        status: u.status,
        statusReason: u.statusReason,
        groupId: u.groupId,
        groupName: u.group?.name ?? null,
        groupColor: u.group?.color ?? null,
        notifyEmail: u.notifyEmail,
        notifyMatchPublished: u.notifyMatchPublished,
        notifyWeeklyReminder: u.notifyWeeklyReminder,
        notifyEndOfCycle: u.notifyEndOfCycle,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      },
    };
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      const store = getFallbackStore();
      const found = store.users.find((u) => u.id === id) ?? null;
      return { user: found, dbConnected: false };
    }
    throw err;
  }
}

export async function getStudentDashboardData(userId: string): Promise<{
  dbConnected: boolean;
  user: UserRecord;
  currentCycle: CycleView | null;
  currentWeek: WeekView | null;
  currentWeekMatches: MatchView[];
  historicalMatches: MatchView[];
  notifications: NotificationView[];
  allowNameEdit: boolean;
}> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      include: { group: true },
    });
    if (!u) {
      throw new Error("Utilisateur introuvable");
    }

    const userRecord: UserRecord = {
      id: u.id,
      email: u.email,
      emailNormalized: u.emailNormalized,
      emailVerified: u.emailVerified,
      phone: u.phone,
      phoneNormalized: u.phoneNormalized,
      firstName: u.firstName,
      lastName: u.lastName,
      passwordHash: u.passwordHash,
      image: u.image,
      bio: u.bio,
      interests: u.interests,
      role: u.role,
      status: u.status,
      statusReason: u.statusReason,
      groupId: u.groupId,
      groupName: u.group?.name ?? null,
      groupColor: u.group?.color ?? null,
      notifyEmail: u.notifyEmail,
      notifyMatchPublished: u.notifyMatchPublished,
      notifyWeeklyReminder: u.notifyWeeklyReminder,
      notifyEndOfCycle: u.notifyEndOfCycle,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    };

    const activeCycle = await prisma.matchingCycle.findFirst({
      where: { status: CycleStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      include: {
        weeks: {
          orderBy: { weekNumber: "asc" },
          include: {
            _count: { select: { matches: true } },
          },
        },
      },
    });

    const allMatches = await prisma.match.findMany({
      where: {
        OR: [{ studentAId: userId }, { studentBId: userId }],
        validationStatus: MatchValidationStatus.APPROVED,
        week: {
          status: { in: [WeekStatus.PUBLISHED, WeekStatus.CLOSED] },
        },
      },
      include: {
        week: { include: { cycle: true } },
        studentA: { include: { group: true } },
        studentB: { include: { group: true } },
        confirmations: true,
      },
      orderBy: [{ week: { weekNumber: "desc" } }, { createdAt: "desc" }],
    });

    const toUserRecord = (raw: typeof u): UserRecord => ({
      id: raw.id,
      email: raw.email,
      emailNormalized: raw.emailNormalized,
      emailVerified: raw.emailVerified,
      phone: raw.phone,
      phoneNormalized: raw.phoneNormalized,
      firstName: raw.firstName,
      lastName: raw.lastName,
      passwordHash: null,
      image: raw.image,
      bio: raw.bio,
      interests: raw.interests,
      role: raw.role,
      status: raw.status,
      statusReason: raw.statusReason,
      groupId: raw.groupId,
      groupName: raw.group?.name ?? null,
      groupColor: raw.group?.color ?? null,
      notifyEmail: raw.notifyEmail,
      notifyMatchPublished: raw.notifyMatchPublished,
      notifyWeeklyReminder: raw.notifyWeeklyReminder,
      notifyEndOfCycle: raw.notifyEndOfCycle,
      createdAt: raw.createdAt,
      lastLoginAt: raw.lastLoginAt,
    });

    const mappedMatches: MatchView[] = allMatches.map((m) => ({
      id: m.id,
      weekId: m.weekId,
      weekNumber: m.week.weekNumber,
      weekStatus: m.week.status,
      cycleId: m.week.cycleId,
      cycleName: m.week.cycle.name,
      studentA: toUserRecord(m.studentA),
      studentB: toUserRecord(m.studentB),
      validationStatus: m.validationStatus,
      validatedAt: m.validatedAt,
      validatedById: m.validatedById,
      rejectionReason: m.rejectionReason,
      confirmations: m.confirmations.map((c) => ({
        id: c.id,
        matchId: c.matchId,
        userId: c.userId,
        status: c.status,
        confirmedAt: c.confirmedAt,
        note: c.note,
      })),
      createdAt: m.createdAt,
    }));

    let cycleView: CycleView | null = null;
    let currentWeekView: WeekView | null = null;

    if (activeCycle) {
      const weekViews: WeekView[] = activeCycle.weeks.map((w) => ({
        id: w.id,
        cycleId: w.cycleId,
        weekNumber: w.weekNumber,
        status: w.status,
        publishedAt: w.publishedAt,
        startDate: w.startDate,
        endDate: w.endDate,
        algorithmVersion: w.algorithmVersion,
        generationSeed: w.generationSeed,
        generationStats:
          (w.generationStats as unknown as MatchingGenerationStats) ?? null,
        matchesCount: w._count.matches,
      }));

      cycleView = {
        id: activeCycle.id,
        name: activeCycle.name,
        description: activeCycle.description,
        status: activeCycle.status,
        totalWeeks: activeCycle.totalWeeks,
        startDate: activeCycle.startDate,
        endDate: activeCycle.endDate,
        timezone: activeCycle.timezone,
        weeks: weekViews,
      };

      const publishedWeeks = weekViews.filter(
        (w) => w.status === WeekStatus.PUBLISHED
      );
      currentWeekView =
        publishedWeeks[publishedWeeks.length - 1] ?? weekViews[0] ?? null;
    }

    const currentWeekMatches = currentWeekView
      ? mappedMatches.filter((m) => m.weekId === currentWeekView!.id)
      : [];
    const historicalMatches = currentWeekView
      ? mappedMatches.filter((m) => m.weekId !== currentWeekView!.id)
      : mappedMatches;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const nameEditCfg = await prisma.appConfiguration.findUnique({
      where: { key: "allow_student_name_edit" },
    });

    return {
      dbConnected: true,
      user: userRecord,
      currentCycle: cycleView,
      currentWeek: currentWeekView,
      currentWeekMatches,
      historicalMatches,
      notifications: notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      allowNameEdit: nameEditCfg?.value === "true",
    };
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      const store = getFallbackStore();
      const user =
        store.users.find((u) => u.id === userId) ?? store.users[1];
      const currentCycle =
        store.cycles.find((c) => c.status === CycleStatus.ACTIVE) ??
        store.cycles[0] ??
        null;
      const publishedWeeks = currentCycle
        ? currentCycle.weeks.filter((w) => w.status === WeekStatus.PUBLISHED)
        : [];
      const currentWeek =
        publishedWeeks[publishedWeeks.length - 1] ??
        currentCycle?.weeks[0] ??
        null;

      const userPublishedMatches = store.matches.filter(
        (m) =>
          (m.studentA.id === user.id || m.studentB.id === user.id) &&
          (m.weekStatus === WeekStatus.PUBLISHED ||
            m.weekStatus === WeekStatus.CLOSED)
      );

      const currentWeekMatches = currentWeek
        ? userPublishedMatches.filter((m) => m.weekId === currentWeek.id)
        : [];
      const historicalMatches = currentWeek
        ? userPublishedMatches.filter((m) => m.weekId !== currentWeek.id)
        : userPublishedMatches;

      const allowNameEdit =
        store.configs.find((c) => c.key === "allow_student_name_edit")
          ?.value === "true";

      return {
        dbConnected: false,
        user,
        currentCycle,
        currentWeek,
        currentWeekMatches,
        historicalMatches,
        notifications: store.notifications.filter((n) => n.userId === user.id),
        allowNameEdit,
      };
    }
    throw err;
  }
}

export async function getAdminDashboardData(): Promise<{
  dbConnected: boolean;
  groups: GroupRecord[];
  users: UserRecord[];
  cycles: CycleView[];
  matches: MatchView[];
  exclusions: MatchPairExclusionView[];
  photos: PhotoPublicationView[];
  reports: ReportView[];
  auditLogs: AuditLogView[];
  emailAttempts: EmailAttemptView[];
  configs: AppConfigItem[];
}> {
  try {
    const [
      dbGroups,
      dbUsers,
      dbCycles,
      dbMatches,
      dbExclusions,
      dbPhotos,
      dbReports,
      dbLogs,
      dbEmails,
      dbConfigs,
    ] = await Promise.all([
      prisma.group.findMany({
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: { _count: { select: { users: true } } },
      }),
      prisma.user.findMany({
        orderBy: [{ createdAt: "desc" }],
        include: { group: true },
      }),
      prisma.matchingCycle.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          weeks: {
            orderBy: { weekNumber: "asc" },
            include: { _count: { select: { matches: true } } },
          },
        },
      }),
      prisma.match.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          week: { include: { cycle: true } },
          studentA: { include: { group: true } },
          studentB: { include: { group: true } },
          confirmations: true,
        },
      }),
      prisma.matchPairExclusion.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          studentA: { include: { group: true } },
          studentB: { include: { group: true } },
        },
      }),
      prisma.photoPublication.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          author: { include: { group: true } },
          participants: {
            include: { user: { include: { group: true } } },
          },
        },
      }),
      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          author: true,
          targetUser: true,
          photo: true,
        },
      }),
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { actor: true },
      }),
      prisma.emailDeliveryAttempt.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.appConfiguration.findMany({
        orderBy: { key: "asc" },
      }),
    ]);

    const mapUser = (u: (typeof dbUsers)[number]): UserRecord => ({
      id: u.id,
      email: u.email,
      emailNormalized: u.emailNormalized,
      emailVerified: u.emailVerified,
      phone: u.phone,
      phoneNormalized: u.phoneNormalized,
      firstName: u.firstName,
      lastName: u.lastName,
      passwordHash: null,
      image: u.image,
      bio: u.bio,
      interests: u.interests,
      role: u.role,
      status: u.status,
      statusReason: u.statusReason,
      groupId: u.groupId,
      groupName: u.group?.name ?? null,
      groupColor: u.group?.color ?? null,
      notifyEmail: u.notifyEmail,
      notifyMatchPublished: u.notifyMatchPublished,
      notifyWeeklyReminder: u.notifyWeeklyReminder,
      notifyEndOfCycle: u.notifyEndOfCycle,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    });

    return {
      dbConnected: true,
      groups: dbGroups.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        description: g.description,
        color: g.color,
        isActive: g.isActive,
        order: g.order,
        studentCount: g._count.users,
      })),
      users: dbUsers.map(mapUser),
      cycles: dbCycles.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        status: c.status,
        totalWeeks: c.totalWeeks,
        startDate: c.startDate,
        endDate: c.endDate,
        timezone: c.timezone,
        weeks: c.weeks.map((w) => ({
          id: w.id,
          cycleId: w.cycleId,
          weekNumber: w.weekNumber,
          status: w.status,
          publishedAt: w.publishedAt,
          startDate: w.startDate,
          endDate: w.endDate,
          algorithmVersion: w.algorithmVersion,
          generationSeed: w.generationSeed,
          generationStats:
            (w.generationStats as unknown as MatchingGenerationStats) ?? null,
          matchesCount: w._count.matches,
        })),
      })),
      matches: dbMatches.map((m) => ({
        id: m.id,
        weekId: m.weekId,
        weekNumber: m.week.weekNumber,
        weekStatus: m.week.status,
        cycleId: m.week.cycleId,
        cycleName: m.week.cycle.name,
        studentA: mapUser(m.studentA),
        studentB: mapUser(m.studentB),
        validationStatus: m.validationStatus,
        validatedAt: m.validatedAt,
        validatedById: m.validatedById,
        rejectionReason: m.rejectionReason,
        confirmations: m.confirmations.map((c) => ({
          id: c.id,
          matchId: c.matchId,
          userId: c.userId,
          status: c.status,
          confirmedAt: c.confirmedAt,
          note: c.note,
        })),
        createdAt: m.createdAt,
      })),
      exclusions: dbExclusions.map((e) => ({
        id: e.id,
        cycleId: e.cycleId,
        weekId: e.weekId,
        studentAId: e.studentAId,
        studentBId: e.studentBId,
        studentAName: `${e.studentA.firstName} ${e.studentA.lastName}`,
        studentBName: `${e.studentB.firstName} ${e.studentB.lastName}`,
        studentAGroup: e.studentA.group?.name ?? null,
        studentBGroup: e.studentB.group?.name ?? null,
        reason: e.reason,
        createdById: e.createdById,
        createdAt: e.createdAt,
      })),
      photos: dbPhotos.map((p) => {
        const parts: PhotoParticipantView[] = p.participants.map((pt) => ({
          userId: pt.userId,
          firstName: pt.user.firstName,
          lastName: pt.user.lastName,
          groupName: pt.user.group?.name ?? null,
          consentStatus: pt.consentStatus,
        }));
        return {
          id: p.id,
          authorId: p.authorId,
          authorName: `${p.author.firstName} ${p.author.lastName}`,
          authorGroup: p.author.group?.name ?? null,
          authorImage: p.author.image,
          caption: p.caption,
          imageKey: p.imageKey,
          imageUrl: p.imageUrl || `/uploads/${p.imageKey}`,
          status: p.status,
          rejectionReason: p.rejectionReason,
          publishedAt: p.publishedAt,
          createdAt: p.createdAt,
          participants: parts,
          allConsentsGiven: parts.every(
            (pt) => pt.consentStatus === ConsentStatus.GIVEN
          ),
        };
      }),
      reports: dbReports.map((r) => ({
        id: r.id,
        authorId: r.authorId,
        authorName: `${r.author.firstName} ${r.author.lastName}`,
        targetUserId: r.targetUserId,
        targetUserName: r.targetUser
          ? `${r.targetUser.firstName} ${r.targetUser.lastName}`
          : null,
        photoId: r.photoId,
        photoCaption: r.photo?.caption ?? null,
        reason: r.reason,
        details: r.details,
        status: r.status,
        resolution: r.resolution,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
      })),
      auditLogs: dbLogs.map((l) => ({
        id: l.id,
        actorId: l.actorId,
        actorName: `${l.actor.firstName} ${l.actor.lastName}`,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        details: (l.details as Record<string, unknown>) ?? null,
        createdAt: l.createdAt,
      })),
      emailAttempts: dbEmails.map((e) => ({
        id: e.id,
        toEmail: e.toEmail,
        subject: e.subject,
        type: e.type,
        status: e.status,
        errorMessage: e.errorMessage,
        sentAt: e.sentAt,
        createdAt: e.createdAt,
      })),
      configs: dbConfigs.map((c) => ({
        key: c.key,
        value: c.value,
        description: c.description ?? "",
        isPublic: c.isPublic,
      })),
    };
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      const store = getFallbackStore();
      return {
        dbConnected: false,
        groups: store.groups,
        users: store.users,
        cycles: store.cycles,
        matches: store.matches,
        exclusions: store.exclusions ?? [],
        photos: store.photos,
        reports: store.reports,
        auditLogs: store.auditLogs,
        emailAttempts: store.emailAttempts,
        configs: store.configs,
      };
    }
    throw err;
  }
}

export async function getRetroAlbumData(currentUserId: string): Promise<{
  dbConnected: boolean;
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
}> {
  try {
    const [dbPhotos, dbUsers, retroCfg] = await Promise.all([
      prisma.photoPublication.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          author: { include: { group: true } },
          participants: {
            include: { user: { include: { group: true } } },
          },
        },
      }),
      prisma.user.findMany({
        where: { status: AccountStatus.ACTIVE },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        include: { group: true },
      }),
      prisma.appConfiguration.findUnique({
        where: { key: "retro_album_enabled" },
      }),
    ]);

    const allMapped: PhotoPublicationView[] = dbPhotos.map((p) => {
      const parts: PhotoParticipantView[] = p.participants.map((pt) => ({
        userId: pt.userId,
        firstName: pt.user.firstName,
        lastName: pt.user.lastName,
        groupName: pt.user.group?.name ?? null,
        consentStatus: pt.consentStatus,
      }));
      const allConsentsGiven = parts.every(
        (pt) => pt.consentStatus === ConsentStatus.GIVEN
      );
      return {
        id: p.id,
        authorId: p.authorId,
        authorName: `${p.author.firstName} ${p.author.lastName}`,
        authorGroup: p.author.group?.name ?? null,
        authorImage: p.author.image,
        caption: p.caption,
        imageKey: p.imageKey,
        imageUrl: p.imageUrl || `/uploads/${p.imageKey}`,
        status: p.status,
        rejectionReason: p.rejectionReason,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
        participants: parts,
        allConsentsGiven,
      };
    });

    // Security rule: Photos are ONLY publicly shown in the retro album once BOTH
    // admin moderation is APPROVED AND all identified participants have given consent.
    const approvedPhotos = allMapped.filter(
      (p) => p.status === PhotoStatus.APPROVED && p.allConsentsGiven
    );
    const myPhotos = allMapped.filter((p) => p.authorId === currentUserId);
    const taggedPhotos = allMapped.filter((p) =>
      p.participants.some((pt) => pt.userId === currentUserId)
    );

    return {
      dbConnected: true,
      approvedPhotos,
      myPhotos,
      taggedPhotos,
      eligibleParticipants: dbUsers
        .filter((u) => u.id !== currentUserId)
        .map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          groupName: u.group?.name ?? null,
        })),
      retroEnabled: retroCfg ? retroCfg.value === "true" : true,
    };
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      const store = getFallbackStore();
      const approvedPhotos = store.photos.filter(
        (p) => p.status === PhotoStatus.APPROVED && p.allConsentsGiven
      );
      const myPhotos = store.photos.filter(
        (p) => p.authorId === currentUserId
      );
      const taggedPhotos = store.photos.filter((p) =>
        p.participants.some((pt) => pt.userId === currentUserId)
      );
      const retroEnabled =
        store.configs.find((c) => c.key === "retro_album_enabled")?.value !==
        "false";

      return {
        dbConnected: false,
        approvedPhotos,
        myPhotos,
        taggedPhotos,
        eligibleParticipants: store.users
          .filter(
            (u) => u.status === AccountStatus.ACTIVE && u.id !== currentUserId
          )
          .map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            groupName: u.groupName,
          })),
        retroEnabled,
      };
    }
    throw err;
  }
}
