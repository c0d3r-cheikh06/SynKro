import { AccountStatus, CycleStatus, PrismaClient, Role, WeekStatus } from "@prisma/client";
import { hashPassword, normalizeEmail } from "../src/lib/crypto";
import { generateWeeklyMatching, MatchingStudent } from "../src/lib/matching/algorithm";
import { normalizePhoneNumber } from "../src/lib/phone";
import { AVATAR_PRESETS, DEFAULT_GROUPS } from "../src/lib/validation";

const prisma = new PrismaClient();

const SENEGAL_FIRST_NAMES = [
  "Mamadou", "Fatou", "Moussa", "Aminata", "Ibrahima", "Aïssatou", "Ousmane", "Mariama",
  "Cheikh", "Khadija", "Abdoulaye", "Ndèye", "Babacar", "Coumba", "Modou", "awa",
  "Serigne", "Mame", "Pape", "Sokhna", "Alioune", "Seynabou", "El Hadji", "Astou",
];

const SENEGAL_LAST_NAMES = [
  "Ndiaye", "Diop", "Fall", "Sow", "Ba", "Diallo", "Gueye", "Sy",
  "Sarr", "Cissé", "Seck", "Mbaye", "Thiam", "Faye", "Kane", "Toure",
];

const TECH_INTERESTS = [
  "Développement Web", "Cybersécurité", "Réseaux & Cisco", "Intelligence Artificielle",
  "Cloud & DevOps", "Mobile Flutter", "Linux & Open Source", "Data Science",
  "Design UI/UX", "Jeux Vidéo", "Football", "Lecture & Mangas",
];

async function main() {
  console.log("🌱 Initialisation de la base de données Synkro...");

  // =========================================================================
  // PHASE PRÉALABLE — Validation stricte des prérequis SANS écriture en base
  // =========================================================================
  const isProduction = process.env.NODE_ENV === "production";
  const primaryAdminEmail = normalizeEmail(
    process.env.ADMIN_EMAIL || "fazethiam@gmail.com"
  );
  const rawAdminPassword = process.env.ADMIN_INITIAL_PASSWORD?.trim();

  // 1. Lecture non destructive : vérifier si le compte administrateur existe déjà
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: primaryAdminEmail },
        { emailNormalized: primaryAdminEmail },
      ],
    },
  });

  // 2. Vérification rigoureuse des prérequis administrateur avant toute écriture en base
  let primaryAdminHash: string | null = null;

  if (existingAdmin) {
    // Cas A : L'utilisateur existe déjà
    // Vérification de sécurité anti-élévation de privilèges accidentelle
    if (existingAdmin.role !== Role.ADMIN) {
      if (process.env.ALLOW_ADMIN_ROLE_PROMOTION !== "true") {
        throw new Error(
          `❌ Sécurité critique : L'adresse e-mail "${primaryAdminEmail}" correspond à un utilisateur existant ayant le rôle "${existingAdmin.role}". Pour éviter toute élévation de privilèges accidentelle, la promotion vers le rôle ADMIN est bloquée. Définissez ALLOW_ADMIN_ROLE_PROMOTION="true" si cette promotion est intentionnelle.`
        );
      }
    }
    // Si le compte administrateur existe déjà et est valide, on ne force pas la saisie
    // d'un nouveau mot de passe initial : son mot de passe actuel sera rigoureusement préservé.
  } else {
    // Cas B : Premier administrateur (création initiale requise)
    // Exiger et valider immédiatement ADMIN_INITIAL_PASSWORD avant d'effectuer la moindre écriture
    if (!rawAdminPassword) {
      if (isProduction) {
        throw new Error(
          "❌ Sécurité critique : La variable d'environnement ADMIN_INITIAL_PASSWORD est obligatoire pour créer le compte administrateur initial en production. Le script a été interrompu avant toute écriture en base."
        );
      } else {
        throw new Error(
          "❌ Sécurité : Veuillez définir la variable ADMIN_INITIAL_PASSWORD dans votre fichier .env pour initialiser le compte administrateur. Aucune écriture n'a été effectuée en base."
        );
      }
    }

    if (isProduction && rawAdminPassword.length < 12) {
      throw new Error(
        "❌ Sécurité critique : En production, la variable ADMIN_INITIAL_PASSWORD doit comporter au moins 12 caractères. Le script a été interrompu avant toute écriture en base."
      );
    } else if (rawAdminPassword.length < 8) {
      throw new Error(
        "❌ Sécurité : La variable ADMIN_INITIAL_PASSWORD doit comporter au moins 8 caractères. Le script a été interrompu avant toute écriture en base."
      );
    }

    const forbiddenPasswords = [
      "AdminSynkro2026!",
      "EtudiantSynkro2026!",
      "passer123",
      "admin12345678",
      "password1234",
    ];

    if (isProduction && forbiddenPasswords.includes(rawAdminPassword)) {
      throw new Error(
        "❌ Sécurité critique : En production, ADMIN_INITIAL_PASSWORD ne peut pas être un mot de passe faible, par défaut ou de démonstration. Le script a été interrompu avant toute écriture en base."
      );
    }

    // Le mot de passe est valide : préparation du hachage
    primaryAdminHash = await hashPassword(rawAdminPassword);
  }

  // =========================================================================
  // PHASE D'ÉCRITURE — Tous les prérequis administrateur sont vérifiés et validés
  // =========================================================================

  // 1. Initialiser les 5 anciennes classes officielles (sans écraser les personnalisations existantes)
  const groupRecords = [];
  for (const g of DEFAULT_GROUPS) {
    const existingGroup = await prisma.group.findUnique({
      where: { slug: g.slug },
    });

    if (existingGroup) {
      // Préserver les données existantes (statut actif/inactif, ordre, personnalisations)
      groupRecords.push({ ...existingGroup, indicativeCount: g.indicativeCount });
    } else {
      const created = await prisma.group.create({
        data: {
          name: g.name,
          slug: g.slug,
          description: g.description,
          color: g.color,
          order: g.order,
          isActive: true,
        },
      });
      groupRecords.push({ ...created, indicativeCount: g.indicativeCount });
    }
  }
  console.log(`✔ ${groupRecords.length} anciennes classes configurées.`);

  // 2. Configurations applicatives par défaut (sans écraser les valeurs modifiées par l'administrateur)
  const defaultConfigs = [
    {
      key: "allow_student_name_edit",
      value: "false",
      description: "Autoriser les étudiants à modifier leur nom/prénom après validation",
      isPublic: true,
    },
    {
      key: "target_partners_per_week",
      value: "3",
      description: "Nombre cible de jumeaux par étudiant et par semaine",
      isPublic: true,
    },
    {
      key: "default_cycle_weeks",
      value: "6",
      description: "Durée standard d'un cycle de jumelage en semaines",
      isPublic: true,
    },
    {
      key: "retro_album_enabled",
      value: "true",
      description: "Activer la soumission de photos dans l'album rétrospectif /retro",
      isPublic: true,
    },
  ];

  for (const cfg of defaultConfigs) {
    const existingCfg = await prisma.appConfiguration.findUnique({
      where: { key: cfg.key },
    });

    if (existingCfg) {
      // Préserver la valeur métier existante si l'administrateur l'a modifiée
      await prisma.appConfiguration.update({
        where: { key: cfg.key },
        data: {
          description: cfg.description,
          isPublic: cfg.isPublic,
        },
      });
    } else {
      await prisma.appConfiguration.create({
        data: cfg,
      });
    }
  }

  // 3. Application du compte Administrateur Principal (validé préalablement)
  if (existingAdmin) {
    if (existingAdmin.role !== Role.ADMIN) {
      console.warn(
        `⚠️ ATTENTION : Promotion explicite du compte ${primaryAdminEmail} du rôle ${existingAdmin.role} vers ADMIN (ALLOW_ADMIN_ROLE_PROMOTION=true).`
      );
    }

    // Le compte existe déjà : préserver STRICTEMENT son mot de passe actuel et ses données personnelles
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
        emailVerified: existingAdmin.emailVerified ?? new Date(),
        statusReason: null,
      },
    });
    console.log(
      `✔ Compte administrateur existant confirmé (${primaryAdminEmail}) : rôle ADMIN et statut ACTIVE garantis sans modifier le mot de passe ni les données personnelles.`
    );
  } else {
    // Création initiale de l'administrateur principal
    await prisma.user.create({
      data: {
        email: primaryAdminEmail,
        emailNormalized: primaryAdminEmail,
        emailVerified: new Date(),
        firstName: "Faze",
        lastName: "Thiam",
        passwordHash: primaryAdminHash!,
        phone: null,
        phoneNormalized: null,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
        bio: "Administrateur principal de la plateforme Synkro.",
        interests: [
          "Architecture Logicielle",
          "Cybersécurité",
          "Intelligence Artificielle",
        ],
        image: "/avatars/avatar-vector.svg",
      },
    });

    console.log(
      `✔ Compte administrateur principal initialisé avec succès (${primaryAdminEmail}).`
    );
  }

  // 4. Règle absolue de sécurité en Production :
  // En production, nous ne créons JAMAIS de comptes de démonstration, de faux jumelages ou de mots de passe de test,
  // même si SEED_DEMO_DATA=true est accidentellement défini dans l'environnement.
  if (isProduction) {
    console.log(
      "🔒 Environnement de production détecté : seuls les groupes officiels, configurations et l'administrateur principal ont été initialisés."
    );
    console.log(
      "ℹ Règle absolue de sécurité : aucun compte de démonstration ni mot de passe public n'a été inséré."
    );
    console.log("✅ Initialisation production terminée avec succès !");
    return;
  }

  // 5. En développement uniquement : création facultative des données de test
  const shouldSeedDemo = process.env.SEED_DEMO_DATA !== "false";
  if (!shouldSeedDemo) {
    console.log("ℹ SEED_DEMO_DATA=false : génération des comptes de test ignorée.");
    console.log("✅ Initialisation terminée avec succès !");
    return;
  }

  console.log("🛠 Génération des comptes et données de test locaux (développement uniquement)...");

  const adminPasswordHash = await hashPassword("AdminSynkro2026!");
  const studentPasswordHash = await hashPassword("EtudiantSynkro2026!");

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@synkro.app" },
    update: {},
    create: {
      email: "admin@synkro.app",
      emailNormalized: "admin@synkro.app",
      emailVerified: new Date(),
      firstName: "Cheikh",
      lastName: "Responsable",
      passwordHash: adminPasswordHash,
      phone: "+221 77 100 00 01",
      phoneNormalized: "+221771000001",
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      groupId: groupRecords[0].id,
      bio: "Administrateur de la plateforme Synkro — Coordination des cycles de jumelage.",
      interests: ["Architecture Logicielle", "Cybersécurité", "Pédagogie"],
      image: "/avatars/avatar-vector.svg",
    },
  });

  await prisma.user.upsert({
    where: { email: "moderateur@synkro.app" },
    update: {},
    create: {
      email: "moderateur@synkro.app",
      emailNormalized: "moderateur@synkro.app",
      emailVerified: new Date(),
      firstName: "Aminata",
      lastName: "Modératrice",
      passwordHash: adminPasswordHash,
      phone: "+221 77 100 00 02",
      phoneNormalized: "+221771000002",
      role: Role.MODERATOR,
      status: AccountStatus.ACTIVE,
      groupId: groupRecords[1].id,
      bio: "Déléguée et modératrice de l'album rétrospectif de la promotion.",
      interests: ["Réseaux & Cisco", "Design UI/UX", "Cybersécurité"],
      image: "/avatars/avatar-nova.svg",
    },
  });

  // 4. Create the 68 active students across the 5 groups (23, 23, 8, 8, 6)
  const activeStudents: MatchingStudent[] = [];
  let globalIdx = 1;

  for (const grp of groupRecords) {
    for (let i = 1; i <= grp.indicativeCount; i++) {
      const firstName =
        SENEGAL_FIRST_NAMES[(globalIdx - 1) % SENEGAL_FIRST_NAMES.length];
      const lastName =
        SENEGAL_LAST_NAMES[
          (globalIdx * 3 + i) % SENEGAL_LAST_NAMES.length
        ];
      const email = normalizeEmail(`etudiant${globalIdx}.${grp.slug}@synkro.app`);
      const rawPhone = `77${String(2000000 + globalIdx).slice(0, 7)}`;

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          groupId: grp.id,
          status: AccountStatus.ACTIVE,
        },
        create: {
          email,
          emailNormalized: email,
          emailVerified: new Date(),
          firstName,
          lastName,
          passwordHash: studentPasswordHash,
          phone: rawPhone,
          phoneNormalized: normalizePhoneNumber(rawPhone),
          role: Role.STUDENT,
          status: AccountStatus.ACTIVE,
          groupId: grp.id,
          bio: `Étudiant(e) en ${grp.name}, passionné(e) par la tech et ravi(e) d'échanger avec les autres anciennes classes de la classe !`,
          interests: [
            TECH_INTERESTS[globalIdx % TECH_INTERESTS.length],
            TECH_INTERESTS[(globalIdx + 3) % TECH_INTERESTS.length],
            TECH_INTERESTS[(globalIdx + 7) % TECH_INTERESTS.length],
          ],
          image: AVATAR_PRESETS[globalIdx % AVATAR_PRESETS.length].url,
        },
      });

      activeStudents.push({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        groupId: grp.id,
        groupName: grp.name,
      });

      globalIdx++;
    }
  }

  // Create 2 pending accounts for admin validation workflow testing
  await prisma.user.upsert({
    where: { email: "attente.validation@synkro.app" },
    update: {},
    create: {
      email: "attente.validation@synkro.app",
      emailNormalized: "attente.validation@synkro.app",
      emailVerified: new Date(),
      firstName: "Oumar",
      lastName: "Diagne",
      passwordHash: studentPasswordHash,
      phone: "+221 78 300 11 22",
      phoneNormalized: "+221783001122",
      role: Role.STUDENT,
      status: AccountStatus.PENDING_APPROVAL,
      groupId: groupRecords[2].id,
      bio: "Nouvel inscrit en GLSI en attente d'approbation administrative.",
      interests: ["Développement Web", "Cloud & DevOps"],
      image: "/images/portraits/portrait-ousmane.jpg",
    },
  });

  console.log(`✔ ${activeStudents.length} étudiants actifs créés dans les 5 groupes.`);

  // 5. Create an active 6-week Matching Cycle with Week 1 PUBLISHED
  const existingCycle = await prisma.matchingCycle.findFirst({
    where: { status: CycleStatus.ACTIVE },
  });

  if (!existingCycle) {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 6 * 7 * 24 * 60 * 60 * 1000);

    const cycle = await prisma.matchingCycle.create({
      data: {
        name: "Cycle Semestre 1 — Anciennes Classes",
        description:
          "Cycle officiel de 6 semaines de jumelage entre DUT INFO, DUT TR, GLSI, SRT et Autres.",
        status: CycleStatus.ACTIVE,
        totalWeeks: 6,
        startDate,
        endDate,
        timezone: "Africa/Dakar",
      },
    });

    const week1Gen = generateWeeklyMatching({
      students: activeStudents,
      historicalPairs: [],
      weekNumber: 1,
      totalWeeksInCycle: 6,
      targetPartnersPerWeek: 3,
      seed: "synkro-seed-cycle1-week1",
    });

    const week1 = await prisma.matchingWeek.create({
      data: {
        cycleId: cycle.id,
        weekNumber: 1,
        status: WeekStatus.PUBLISHED,
        publishedAt: new Date(),
        startDate,
        endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        algorithmVersion: week1Gen.stats.algorithmVersion,
        generationSeed: week1Gen.stats.seed,
        generationStats: JSON.parse(JSON.stringify(week1Gen.stats)),
      },
    });

    for (const pair of week1Gen.pairs) {
      await prisma.match.create({
        data: {
          weekId: week1.id,
          studentAId: pair.studentAId,
          studentBId: pair.studentBId,
        },
      });
    }

    await prisma.adminAuditLog.create({
      data: {
        actorId: adminUser.id,
        action: "SEED_INITIAL_CYCLE",
        targetType: "MatchingCycle",
        targetId: cycle.id,
        details: {
          week1Pairs: week1Gen.pairs.length,
          activeStudents: activeStudents.length,
        },
      },
    });

    console.log(
      `✔ Cycle actif créé avec Semaine 1 publiée (${week1Gen.pairs.length} paires inter-groupes).`
    );
  }

  console.log("✅ Seed terminé avec succès !");
}

main()
  .catch((e) => {
    console.error("Erreur lors du seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
