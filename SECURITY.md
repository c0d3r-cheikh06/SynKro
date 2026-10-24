# Politique de Sécurité — Synkro (`SECURITY.md`)

Ce document décrit les mesures de sécurité architecturales, cryptographiques et applicatives mises en œuvre dans **Synkro**, ainsi que la procédure de signalement de vulnérabilités.

---

## 1. Authentification et Contrôle d'Accès

### 1.1 Hachage des mots de passe
- Aucun mot de passe n'est jamais stocké ou journalisé en clair.
- Les mots de passe sont hachés via `bcryptjs` avec un facteur de coût de **12 rounds** (`src/lib/crypto.ts`).
- Les règles de complexité (minimum 8 caractères, au moins une majuscule, une minuscule et un chiffre) sont validées côté serveur via Zod (`src/lib/validation.ts`).

### 1.2 Double validation obligatoire (E-mail + Approbation Administrateur)
- **Principe fondamental** : Un compte étudiant ne peut accéder aux fonctionnalités réservées aux membres actifs (`/dashboard`, `/retro`, confirmation de rencontres) que si **deux conditions cumulatives** sont réunies :
  1. `emailVerified != null` (vérification réelle par jeton cryptographique envoyé par e-mail).
  2. `status === AccountStatus.ACTIVE` (approbation manuelle par un administrateur de la promotion).
- **Google OAuth** : La connexion via Google OAuth (`src/lib/auth.ts`) confirme la propriété de l'adresse e-mail mais **ne constitue jamais une preuve d'appartenance à la classe**. Tout nouveau compte créé via Google OAuth est placé en statut `PENDING_APPROVAL` jusqu'à validation par un administrateur.

### 1.3 Jetons de vérification et de réinitialisation (`EmailVerificationToken`)
- Les jetons de vérification d'adresse e-mail et de réinitialisation de mot de passe sont générés avec `crypto.randomBytes(32)` (256 bits d'entropie).
- **Seul le condensat SHA-256 (`tokenHash`) est stocké en base de données** (`src/lib/crypto.ts`). Le jeton brut n'est transmis que dans le lien envoyé à l'utilisateur.
- Chaque jeton possède une date d'expiration stricte (24h pour la vérification d'e-mail, 1h pour la réinitialisation de mot de passe) et est invalidé dès sa première utilisation (`usedAt`).

### 1.4 Protection des routes et des Server Actions
- Chaque page serveur et chaque Server Action vérifie l'identité, le rôle (`STUDENT`, `MODERATOR`, `ADMIN`) et le statut du compte directement auprès de la couche de données (`requireAuthenticatedUser`, `requireActiveMember`, `requireAdminOrModerator`, `requireAdmin` dans `src/lib/auth.ts`).
- Le fichier `src/proxy.ts` (convention Proxy Next.js 16) applique des en-têtes de sécurité HTTP (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`).

---

## 2. Protection des Données Personnelles et de l'Album Rétrospectif (`/retro`)

### 2.1 Suppression des métadonnées EXIF / GPS
- Lors du téléversement d'une photo de profil ou d'une photo d'album rétrospectif (`src/lib/storage.ts`), le fichier est inspecté par ses **magic bytes** réels (`JPEG`, `PNG`, `WebP`) et limité à **5 Mo**.
- Les métadonnées sensibles **EXIF / GPS / IPTC** sont automatiquement supprimées via `sharp` (avec un nettoyeur binaire des segments JPEG `APP1`/`APP13` en repli) avant l'enregistrement sur Vercel Blob ou sur disque.

### 2.2 Consentement mutuel et droit au retrait
- Une photo soumise sur `/retro` est créée en statut `PENDING_MODERATION`.
- Si des étudiants de la classe sont identifiés (`PhotoParticipant`), chacun doit accorder explicitement son consentement (`ConsentStatus.GIVEN`).
- **Règle bloquante côté serveur** : Un modérateur ou administrateur ne peut pas approuver (`PhotoStatus.APPROVED`) une photo tant que tous les participants identifiés n'ont pas consenti (`src/app/actions/admin-actions.ts`).
- Tout participant identifié (ou l'auteur) peut révoquer son consentement ou retirer la photo à tout moment (`respondPhotoConsentAction`, `withdrawPhotoAction`), ce qui passe immédiatement la publication en `WITHDRAWN` et la retire de l'affichage public.

---

## 3. Journalisation d'Audit et Intégrité des Jumelages

- Toutes les opérations sensibles (approbation/rejet/suspension de compte, modification de groupe, génération d'aperçu de jumelage, publication de semaine, modération de photo, résolution de signalement, modification de configuration) sont enregistrées dans `AdminAuditLog` (`src/lib/audit.ts`).
- L'algorithme de jumelage (`src/lib/matching/algorithm.ts`) exécute un validateur indépendant (`validateMatchingResult`) avant toute sauvegarde en base et utilise une transaction Prisma atomique (`prisma.$transaction`) pour garantir l'absence de doublons et d'affectations incohérentes.

---

## 4. Gestion des Secrets

- Aucun secret ne doit être commité dans Git (`.env` et `.env*` sont ignorés dans `.gitignore`, seul `.env.example` est suivi).
- En production (Vercel), configurez `DATABASE_URL`, `AUTH_SECRET` (minimum 32 octets aléatoires), `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN` et `CRON_SECRET` dans les variables d'environnement chiffrées de la plateforme.
