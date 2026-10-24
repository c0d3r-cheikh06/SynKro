# Synkro — Plateforme de Jumelage Inter-Groupes entre Étudiants

**Synkro** est une application web full-stack moderne conçue pour favoriser la cohésion au sein d'une promotion d'étudiants répartis dans **cinq groupes / filières** grâce à des **jumelages hebdomadaires automatisés sur un cycle de 6 semaines**.

Mascotte officielle : **Kora, le Hibou Informaticien**.

---

## 1. Objectif Fonctionnel & Groupes de la Promotion

La classe comprend 5 groupes (effectifs indicatifs, entièrement configurables par l'administrateur) :
- **DUT INFO** : ~23 étudiants
- **DUT TR** : ~23 étudiants
- **GLSI** : ~8 étudiants
- **SRT** : ~8 étudiants
- **Autres** : ~6 étudiants
- **Total indicatif** : **68 étudiants**

Chaque semaine pendant **6 semaines**, chaque étudiant actif reçoit **3 nouveaux jumeaux** issus obligatoirement d'autres groupes que le sien.

### Transparence Mathématique de l'Algorithme (`src/lib/matching/algorithm.ts`)
- **Interdiction stricte des jumelages intra-groupe** : $g(A) \neq g(B)$ est garanti à la construction du graphe et contrôlé par un validateur indépendant avant persistance.
- **Graphe global cohérent** : Les jumelages constituent un graphe non orienté $k$-facteur ($k = 3$) à l'échelle de la classe (`studentAId < studentBId`). Pour 68 étudiants, chaque semaine génère exactement $\frac{68 \times 3}{2} = 102$ paires inter-groupes, soit **612 binômes uniques sans aucune répétition** sur l'ensemble des 6 semaines.
- **Limites mathématiques explicites** : En 6 semaines à raison de 3 jumeaux/semaine, un étudiant rencontre au maximum $6 \times 3 = 18$ camarades distincts. Or un étudiant dispose de $45$ (pour `DUT INFO` / `DUT TR`) à $62$ (pour `Autres`) camarades hors de son groupe. Il est donc mathématiquement impossible de rencontrer 100 % des étudiants des autres groupes en 6 semaines : l'algorithme maximise la diversité inter-filières, évite les répétitions et calcule les taux de couverture théoriques exacts par groupe.
- **Détection des cas limites** :
  - Si l'effectif actif $N$ est impair ($3N$ impair), la somme des degrés d'un graphe non orienté étant toujours paire, au moins un étudiant aura 2 jumeaux au lieu de 3 ($\lfloor 3N/2 \rfloor$ paires).
  - Si un groupe dépasse 50 % de l'effectif total ($|G_{\max}| > N - |G_{\max}|$), le plafond de paires est borné par $3 \times (N - |G_{\max}|)$.

---

## 2. Stack Technique

- **Framework** : Next.js `16.4.2` (App Router, Turbopack, `cacheComponents: true`, `partialPrefetching: true`, convention `src/proxy.ts`)
- **UI** : React `19.3.0`, Tailwind CSS `4.3.3` (`@tailwindcss/turbopack`), `lucide-react`
- **Langage** : TypeScript `5.9.3` (mode `strict`)
- **Base de données & ORM** : PostgreSQL + Prisma `6.19.3` (`prisma/schema.prisma` + `prisma/migrations/0_init/migration.sql`)
- **Authentification** : NextAuth.js `5.0.0-beta.32` (Credentials + Google OAuth) + `bcryptjs` `3.0.3`
- **Validation & Traitement d'images** : Zod `4.6.7`, `sharp` (suppression automatique des métadonnées EXIF/GPS)

---

## 3. Installation & Lancement sous Windows (PowerShell)

### 3.1 Prérequis
- **Node.js** `v24.11.1` (ou `>= 20.9.0`)
- **PostgreSQL** `15+` ou `16+` (installé nativement sous Windows ou via Docker Desktop)

### 3.2 Configuration des variables d'environnement
Dans PowerShell, à la racine du projet `C:\Users\chkth\Documents\projet\classe\synkro` :

```powershell
Copy-Item .env.example .env
```

Générez un secret robuste d'au moins 32 octets pour `AUTH_SECRET` avec Node.js sous PowerShell :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Reportez cette valeur dans `.env` (`AUTH_SECRET="..."`).

---

## 4. Configuration de PostgreSQL

### Option A — Via Docker Desktop sous Windows
Si Docker Desktop est installé et démarré :

```powershell
docker run --name synkro-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=synkro -p 5432:5432 -d postgres:16-alpine
```

### Option B — Service PostgreSQL natif Windows
Créez une base de données nommée `synkro` et mettez à jour `DATABASE_URL` et `DIRECT_URL` dans `.env` :
```env
DATABASE_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/synkro?schema=public"
DIRECT_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/synkro?schema=public"
```

### Configuration Prisma (`DATABASE_URL` vs `DIRECT_URL`)
Le fichier `prisma/schema.prisma` configure explicitement :
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
* **`DATABASE_URL`** : Utilisée au runtime par l'application Next.js (`@prisma/client`). En production, elle pointe vers le pooler de connexions de votre hébergeur (mode transaction / PgBouncer).
* **`DIRECT_URL`** : Utilisée exclusivement par le moteur de migration Prisma (`npx prisma migrate deploy`). Elle cible la connexion directe sans pooler, indispensable pour poser des verrous exclusifs (*advisory locks*) lors des migrations DDL.
* **En développement local** : Ne disposant pas de pooler, `DATABASE_URL` et `DIRECT_URL` pointent vers la même base de données locale.

### Appliquer les migrations et les données initiales (Seed)
Une fois PostgreSQL démarré sur le port `5432` :

```powershell
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run admin:setup
```

> **Note — Mode autonome de secours** : Si PostgreSQL n'est pas encore démarré sur `localhost:5432`, Synkro bascule automatiquement et explicitement sur un store mémoire local pré-chargé avec les 68 étudiants, les 5 groupes et le cycle actif de 6 semaines afin de permettre la démonstration et le test immédiat de l'application sans erreur fatale.

---

## 5. Configuration Google OAuth et E-mails Transactionnels

### 5.1 Google OAuth (`AUTH_GOOGLE_ID` & `AUTH_GOOGLE_SECRET`)
1. Rendez-vous sur [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Créez un identifiant **Client OAuth 2.0** (Application Web).
3. Ajoutez l'URI de redirection autorisée :
   - En local : `http://localhost:3000/api/auth/callback/google`
   - En production : `https://votre-domaine.vercel.app/api/auth/callback/google`
4. Renseignez `AUTH_GOOGLE_ID` et `AUTH_GOOGLE_SECRET` dans `.env`.
5. **Règle de sécurité** : Se connecter avec Google OAuth vérifie l'adresse e-mail de l'étudiant mais place le compte en statut `PENDING_APPROVAL` jusqu'à ce qu'un administrateur confirme son appartenance à la classe.

### 5.2 E-mails Transactionnels (`EMAIL_PROVIDER`)
- **En développement (`EMAIL_PROVIDER="CONSOLE"`)** : Les e-mails transactionnels (vérification d'adresse, réinitialisation de mot de passe, approbation/rejet de compte, publication des jumeaux, rappels hebdomadaires) sont affichés dans le terminal serveur et enregistrés dans `EmailDeliveryAttempt`.
- **En production (`EMAIL_PROVIDER="RESEND"`)** :
  1. Créez une clé API sur [Resend](https://resend.com).
  2. Configurez `EMAIL_PROVIDER="RESEND"`, `RESEND_API_KEY="re_..."` et `EMAIL_FROM="Synkro <no-reply@votre-domaine.sn>"`.
  3. Synkro ne simule jamais un envoi réussi si `EMAIL_PROVIDER="RESEND"` est utilisé sans clé valide.

---

## 6. Lancement, Contrôles Qualité et Tests

```powershell
# Démarrer le serveur de développement
npm run dev

# Exécuter les tests unitaires automatisés (algorithme 6 semaines + sécurité/WhatsApp/EXIF)
npm test

# Initialiser ou configurer le compte administrateur sécurisé
npm run admin:setup

# Initialiser les anciennes classes et données de base
npm run db:seed

# Vérifier le typage TypeScript strict
npx tsc --noEmit

# Exécuter le linter ESLint
npm run lint

# Construire l'application pour la production
npm run build
npm run start
```

### Comptes de démonstration (développement local uniquement)

> [!IMPORTANT]
> **Environnement local uniquement** : Ces identifiants de test sont réservés au développement local. Ils sont **strictement exclus de la production et de toute base distante**. Le script `prisma/seed.ts` applique une politique de sécurité restrictive : les données de démonstration ne peuvent être générées **que si la base est explicitement identifiée comme un hôte local (localhost, 127.0.0.1, ::1)**, que `NODE_ENV` n'est pas `production` et que `SEED_DEMO_DATA="true"` est explicitement activé dans `.env`. Dès qu'une adresse est distante, inconnue ou que l'environnement est en production, aucune donnée de test n'est créée.

| Rôle | Adresse e-mail | Mot de passe | Statut |
| :--- | :--- | :--- | :--- |
| **Administrateur** | `admin@synkro.app` | `AdminSynkro2026!` | `ACTIVE` (DUT INFO) |
| **Étudiante Active** | `etudiant@synkro.app` | `EtudiantSynkro2026!` | `ACTIVE` (DUT INFO — 3 jumeaux) |
| **Modératrice** | `moderateur@synkro.app` | `AdminSynkro2026!` | `ACTIVE` (DUT TR) |
| **En attente d'approbation** | `oumar.diagne@synkro.app` | `EtudiantSynkro2026!` | `PENDING_APPROVAL` (GLSI) |

---

## 7. Préparation au Déploiement en Production (Vercel + PostgreSQL Hébergé)

### 7.1 Prérequis de production indispensables

1. **Base de données PostgreSQL hébergée** (ex: Neon Serverless Postgres, Supabase, Vercel Postgres) :
   - `DATABASE_URL` : Chaîne de connexion avec connection pooler (port pooler / mode transaction) pour les requêtes Next.js.
   - `DIRECT_URL` : Chaîne de connexion directe sans pooler (port 5432 standard), nécessaire pour exécuter les migrations DDL.
2. **Authentification & Sécurité** :
   - `AUTH_SECRET` : Clé secrète cryptographique générée aléatoirement (minimum 32 octets).
   - `ADMIN_EMAIL` : Votre adresse e-mail d'administrateur principal (ex: `fazethiam@gmail.com`).
   - `ADMIN_INITIAL_PASSWORD` : Mot de passe initial robuste (au moins 12 caractères en production, non trivial).
   - `NEXT_PUBLIC_APP_URL` : URL publique définitive (ex: `https://synkro.vercel.app`).
   - `SERVER_ACTIONS_ALLOWED_ORIGINS` : Domaine de production autorisé pour les Server Actions (ex: `synkro.vercel.app`).
3. **E-mails Transactionnels réels** :
   - `EMAIL_PROVIDER="RESEND"` avec une clé API valide `RESEND_API_KEY` et un domaine expéditeur vérifié (`EMAIL_FROM="Synkro <no-reply@votre-domaine.sn>"`).
4. **Stockage persistant des photos (/retro)** :
   - `BLOB_READ_WRITE_TOKEN` fourni par Vercel Blob pour la persistance des photos soumises par les étudiants.
5. **Tâche planifiée Cron** :
   - `CRON_SECRET` : Jeton secret pour sécuriser l'appel planifié automatique `/api/cron/weekly-reminder`.

### 7.2 Étapes de déploiement (Migrations séparées du Build)

Pour garantir la sécurité et la stabilité de la base de production, l'exécution des migrations de schéma est strictement séparée du build de l'application :

1. **Étape 1 — Appliquer les migrations de schéma sur la base hébergée** :
   Exécutez explicitement cette commande depuis votre machine ou votre pipeline CI/CD en pointant vers l'URL directe de production :
   ```powershell
   npx prisma migrate deploy
   ```
   *(Ne lancez pas cette commande au sein de la commande de build Next.js afin d'éviter tout blocage de déploiement ou modification non désirée lors des prévisualisations Vercel).*

2. **Étape 2 — Initialiser les classes officielles et l'administrateur** :
   Une fois les tables migrées, initialisez les 5 anciennes classes et le compte administrateur principal :
   ```powershell
   npm run db:seed
   npm run admin:setup
   ```
   *(En production, aucun compte de démonstration n'est créé).*

3. **Étape 3 — Compilation Next.js sur Vercel** :
   Dans le tableau de bord Vercel, la commande de build standard du projet est :
   ```bash
   npm run build
   ```
   Cette commande exécute uniquement `prisma generate && next build`, garantissant une compilation rapide, optimisée avec Turbopack et totalement indépendante de l'état de synchronisation DDL de la base.

4. **Étape 4 — Tâche planifiée automatique** :
   Le fichier `vercel.json` présent à la racine active automatiquement la tâche Cron Vercel vers `/api/cron/weekly-reminder` chaque lundi à 08h00 UTC, protégée par l'en-tête `Authorization: Bearer <CRON_SECRET>`.
