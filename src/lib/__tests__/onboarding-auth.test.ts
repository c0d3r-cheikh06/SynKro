import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountStatus, Role } from "@prisma/client";
import { hashPassword, verifyPassword } from "../crypto";
import {
  computeExistingUserStatusOnGoogleSignIn,
  evaluateActiveMemberAccess,
  evaluateAdminAccess,
  evaluatePhoneOnboardingAccess,
  GuardUserShape,
  needsPhoneCompletion,
  resolveUserPrimaryDestination,
  validateGoogleIdentityClaims,
} from "../auth-guards";
import {
  formatPhoneDisplay,
  normalizePhoneNumber,
  validateAndNormalizePhoneWithCountry,
} from "../phone";

function makeGuardUser(overrides: Partial<GuardUserShape> = {}): GuardUserShape {
  return {
    id: "user-test-1",
    email: "test@synkro.sn",
    emailVerified: new Date(),
    phone: null,
    phoneNormalized: null,
    role: Role.STUDENT,
    status: AccountStatus.ACTIVE,
    groupId: "dut-info",
    ...overrides,
  };
}

describe("Parcours d'authentification Google OAuth, Gardes d'accès & Numéro de téléphone", () => {
  it("1. Valide rigoureusement les numéros sénégalais (+221) avec indicatifs Orange, Free, Expresso et fixe", () => {
    // Valides Orange (77, 78)
    const orange1 = validateAndNormalizePhoneWithCountry("+221", "771234567");
    assert.equal(orange1.valid, true);
    assert.equal(orange1.e164, "+221771234567");

    const orange2 = validateAndNormalizePhoneWithCountry("+221", "78 987 65 43");
    assert.equal(orange2.valid, true);
    assert.equal(orange2.e164, "+221789876543");

    // Valides Free (76), Expresso (70), Promobile (75)
    assert.equal(
      validateAndNormalizePhoneWithCountry("+221", "76 543 21 09").valid,
      true
    );
    assert.equal(
      validateAndNormalizePhoneWithCountry("+221", "70 111 22 33").valid,
      true
    );
    assert.equal(
      validateAndNormalizePhoneWithCountry("+221", "75 999 88 77").valid,
      true
    );

    // Valides Fixe (33)
    assert.equal(
      validateAndNormalizePhoneWithCountry("+221", "33 821 00 11").valid,
      true
    );

    // Invalides: préfixe inexistant au Sénégal (ex: 79, 66)
    assert.equal(
      validateAndNormalizePhoneWithCountry("+221", "79 123 45 67").valid,
      false
    );
    assert.equal(
      validateAndNormalizePhoneWithCountry("+221", "66 123 45 67").valid,
      false
    );

    // Invalides: longueur incorrecte (8 chiffres ou 10 chiffres au lieu de 9)
    assert.equal(
      validateAndNormalizePhoneWithCountry("+221", "77 12 34 56").valid,
      false
    );
    assert.equal(
      validateAndNormalizePhoneWithCountry("+221", "77 12 34 56 78 90").valid,
      false
    );
  });

  it("2. Valide les numéros internationaux (France +33, Côte d'Ivoire +225, Mali +223)", () => {
    const fr = validateAndNormalizePhoneWithCountry("+33", "06 12 34 56 78");
    assert.equal(fr.valid, true);
    assert.equal(fr.e164, "+33612345678");

    const ci = validateAndNormalizePhoneWithCountry("+225", "07 12 34 56 78");
    assert.equal(ci.valid, true);
    assert.equal(ci.e164, "+2250712345678");

    const ml = validateAndNormalizePhoneWithCountry("+223", "76 12 34 56");
    assert.equal(ml.valid, true);
    assert.equal(ml.e164, "+22376123456");
  });

  it("3. Détecte précisément le besoin de finaliser le numéro WhatsApp (needsPhoneCompletion)", () => {
    // Étudiant actif sans téléphone => OUI
    assert.equal(
      needsPhoneCompletion({
        id: "stu-1",
        email: "stu1@synkro.sn",
        emailVerified: new Date(),
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        phone: null,
        phoneNormalized: null,
      }),
      true
    );

    // Étudiant actif avec téléphone vide ou espaces => OUI
    assert.equal(
      needsPhoneCompletion({
        id: "stu-2",
        email: "stu2@synkro.sn",
        emailVerified: new Date(),
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        phone: "   ",
        phoneNormalized: null,
      }),
      true
    );

    // Étudiant actif avec numéro valide => NON
    assert.equal(
      needsPhoneCompletion({
        id: "stu-3",
        email: "stu3@synkro.sn",
        emailVerified: new Date(),
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        phone: "+221771234567",
        phoneNormalized: "+221771234567",
      }),
      false
    );

    // Admin sans téléphone => NON (réservé aux étudiants actifs)
    assert.equal(
      needsPhoneCompletion({
        id: "admin-1",
        email: "admin@synkro.sn",
        emailVerified: new Date(),
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
        phone: null,
        phoneNormalized: null,
      }),
      false
    );

    // Étudiant en attente d'approbation => NON (doit d'abord être approuvé par l'admin)
    assert.equal(
      needsPhoneCompletion({
        id: "stu-4",
        email: "stu4@synkro.sn",
        emailVerified: new Date(),
        role: Role.STUDENT,
        status: AccountStatus.PENDING_APPROVAL,
        phone: null,
        phoneNormalized: null,
      }),
      false
    );
  });

  it("4. Résout la destination primaire (resolveUserPrimaryDestination) sans boucle de redirection", () => {
    assert.equal(resolveUserPrimaryDestination(null), "/login");

    // Étudiant en attente
    assert.equal(
      resolveUserPrimaryDestination(
        makeGuardUser({
          status: AccountStatus.PENDING_APPROVAL,
          role: Role.STUDENT,
        })
      ),
      "/account-status"
    );

    // Admin
    assert.equal(
      resolveUserPrimaryDestination(
        makeGuardUser({
          role: Role.ADMIN,
        })
      ),
      "/admin"
    );

    // Étudiant actif sans téléphone
    assert.equal(
      resolveUserPrimaryDestination(
        makeGuardUser({
          role: Role.STUDENT,
          phone: null,
          phoneNormalized: null,
        })
      ),
      "/complete-profile"
    );

    // Étudiant actif avec téléphone
    assert.equal(
      resolveUserPrimaryDestination(
        makeGuardUser({
          role: Role.STUDENT,
          phone: "+221771234567",
          phoneNormalized: "+221771234567",
        })
      ),
      "/dashboard"
    );
  });

  it("5. Évalue l'accès aux pages protégées et au onboarding téléphone (guards)", () => {
    // evaluateActiveMemberAccess: bloque l'accès à /dashboard si profil incomplet
    const studentNeedingPhone = makeGuardUser({
      role: Role.STUDENT,
      status: AccountStatus.ACTIVE,
      phone: null,
      phoneNormalized: null,
    });
    const activeEval = evaluateActiveMemberAccess(studentNeedingPhone);
    assert.equal(activeEval.allowed, false);
    assert.equal(activeEval.redirectTo, "/complete-profile");

    // evaluatePhoneOnboardingAccess: autorise l'étudiant actif sans téléphone
    const onboardingEval = evaluatePhoneOnboardingAccess(studentNeedingPhone);
    assert.equal(onboardingEval.allowed, true);

    // evaluatePhoneOnboardingAccess: redirige l'étudiant ayant déjà un téléphone vers /dashboard
    const completedStudent = makeGuardUser({
      role: Role.STUDENT,
      status: AccountStatus.ACTIVE,
      phone: "+221771234567",
      phoneNormalized: "+221771234567",
    });
    const alreadyCompletedEval = evaluatePhoneOnboardingAccess(completedStudent);
    assert.equal(alreadyCompletedEval.allowed, false);
    assert.equal(alreadyCompletedEval.redirectTo, "/dashboard");
  });

  it("6. Valide les claims Google OAuth et refuse les profils non vérifiés", () => {
    const validClaims = validateGoogleIdentityClaims({
      email: "etudiant.test@univ.sn",
      emailVerifiedByGoogle: true,
      providerAccountId: "google-123456789",
      fullName: "Mamadou Ba",
      image: "https://lh3.googleusercontent.com/a/photo123",
    });
    assert.equal(validClaims.ok, true);
    if (validClaims.ok) {
      assert.equal(validClaims.emailNormalized, "etudiant.test@univ.sn");
      assert.equal(validClaims.firstName, "Mamadou");
      assert.equal(validClaims.lastName, "Ba");
      assert.equal(validClaims.providerAccountId, "google-123456789");
    }

    const unverifiedClaims = validateGoogleIdentityClaims({
      email: "inconnu@fake.sn",
      emailVerifiedByGoogle: false,
      providerAccountId: "google-unverified",
    });
    assert.equal(unverifiedClaims.ok, false);
  });

  it("7. Préserve impérativement le statut PENDING_APPROVAL / SUSPENDED lors de la connexion Google", () => {
    // Un utilisateur PENDING_APPROVAL qui se reconnecte via Google ne doit JAMAIS être auto-promu
    assert.equal(
      computeExistingUserStatusOnGoogleSignIn(AccountStatus.PENDING_APPROVAL),
      AccountStatus.PENDING_APPROVAL
    );
    assert.equal(
      computeExistingUserStatusOnGoogleSignIn(AccountStatus.SUSPENDED),
      AccountStatus.SUSPENDED
    );
    assert.equal(
      computeExistingUserStatusOnGoogleSignIn(AccountStatus.REJECTED),
      AccountStatus.REJECTED
    );
    assert.equal(
      computeExistingUserStatusOnGoogleSignIn(AccountStatus.ACTIVE),
      AccountStatus.ACTIVE
    );
  });

  it("8. Authentifie le compte administrateur principal fazethiam@gmail.com et autorise l'accès /admin", async () => {
    const rawPass = process.env.ADMIN_INITIAL_PASSWORD || "passer123";
    const hash = await hashPassword(rawPass);
    assert.equal(await verifyPassword("passer123", hash), true);
    assert.equal(await verifyPassword("wrongPass", hash), false);

    const adminUser = makeGuardUser({
      email: "fazethiam@gmail.com",
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
    });
    const adminAccess = evaluateAdminAccess(adminUser);
    assert.equal(adminAccess.allowed, true);

    const studentUser = makeGuardUser({
      email: "etudiant@synkro.sn",
      role: Role.STUDENT,
      status: AccountStatus.ACTIVE,
      phone: "+221771234567",
      phoneNormalized: "+221771234567",
    });
    const studentAccess = evaluateAdminAccess(studentUser);
    assert.equal(studentAccess.allowed, false);
    assert.equal(studentAccess.redirectTo, "/dashboard");
  });
});
