import { AccountStatus, Role } from "@prisma/client";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  computeExistingUserStatusOnGoogleSignIn,
  evaluateActiveMemberAccess,
  evaluateAdminAccess,
  evaluatePhoneOnboardingAccess,
  needsPhoneCompletion,
  validateGoogleIdentityClaims,
} from "./auth-guards";
import { normalizeEmail, verifyPassword } from "./crypto";
import {
  findUserByEmail,
  findUserById,
  getFallbackStore,
  UserRecord,
} from "./data-store";
import { isDatabaseConnectionError, prisma } from "./prisma";
import { getPortraitUrlBySeed, loginSchema } from "./validation";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: Role;
      status: AccountStatus;
      isEmailVerified: boolean;
      needsPhoneCompletion: boolean;
      groupId: string | null;
      groupName: string | null;
      image?: string | null;
    } & DefaultSession["user"];
  }
}

const googleClientId =
  process.env.AUTH_GOOGLE_ID?.trim() ||
  process.env.GOOGLE_CLIENT_ID?.trim() ||
  "";
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET?.trim() ||
  process.env.GOOGLE_CLIENT_SECRET?.trim() ||
  "";

export const isGoogleOAuthConfigured = Boolean(
  googleClientId && googleClientSecret
);

const providers = [
  Credentials({
    name: "Identifiants Synkro",
    credentials: {
      email: { label: "E-mail", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }

      const emailNorm = normalizeEmail(parsed.data.email);
      const { user } = await findUserByEmail(emailNorm);

      if (!user || !user.passwordHash) {
        return null;
      }

      const validPassword = await verifyPassword(
        parsed.data.password,
        user.passwordHash
      );
      if (!validPassword) {
        return null;
      }

      // Record last login timestamp
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } catch (err) {
        if (isDatabaseConnectionError(err)) {
          if (process.env.NODE_ENV === "production") {
            console.error(
              "[Synkro Auth] Erreur de mise à jour lastLoginAt en production:",
              err instanceof Error ? err.name : "DBError"
            );
          } else {
            const store = getFallbackStore();
            const target = store.users.find((u) => u.id === user.id);
            if (target) target.lastLoginAt = new Date();
          }
        }
      }

      return {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        image: user.image,
      };
    },
  }),
  ...(isGoogleOAuthConfigured
    ? [
        Google({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const googleProfile = profile as {
          email_verified?: boolean;
          given_name?: string;
          family_name?: string;
          picture?: string;
        } | null;

        const claimCheck = validateGoogleIdentityClaims({
          email: user.email,
          emailVerifiedByGoogle: googleProfile?.email_verified ?? null,
          providerAccountId: account.providerAccountId,
          givenName: googleProfile?.given_name,
          familyName: googleProfile?.family_name,
          fullName: user.name,
          image: user.image ?? googleProfile?.picture ?? null,
        });

        if (!claimCheck.ok) {
          return false;
        }

        const { emailNormalized, providerAccountId, firstName, lastName } =
          claimCheck;
        const googleAvatar =
          user.image ??
          googleProfile?.picture ??
          getPortraitUrlBySeed(emailNormalized);
        const now = new Date();

        try {
          // 1. Secure identity linking: first look up an already linked Google Account by (provider, providerAccountId)
          const linkedAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId,
              },
            },
            include: { user: true },
          });

          const existingByEmail = linkedAccount?.user
            ? linkedAccount.user
            : await prisma.user.findFirst({
                where: {
                  OR: [
                    { emailNormalized },
                    { email: emailNormalized },
                  ],
                },
              });

          if (!existingByEmail) {
            // New student signing in via Google:
            // Email ownership is verified by Google, so emailVerified is set,
            // BUT class membership requires explicit admin approval -> PENDING_APPROVAL.
            const created = await prisma.$transaction(async (tx) => {
              const newUser = await tx.user.create({
                data: {
                  email: emailNormalized,
                  emailNormalized,
                  emailVerified: now,
                  firstName,
                  lastName,
                  image: googleAvatar,
                  role: Role.STUDENT,
                  status: AccountStatus.PENDING_APPROVAL,
                  lastLoginAt: now,
                },
              });

              await tx.account.upsert({
                where: {
                  provider_providerAccountId: {
                    provider: "google",
                    providerAccountId,
                  },
                },
                update: {
                  userId: newUser.id,
                  access_token: account.access_token ?? null,
                  refresh_token: account.refresh_token ?? null,
                  expires_at: account.expires_at ?? null,
                  token_type: account.token_type ?? null,
                  scope: account.scope ?? null,
                  id_token: account.id_token ?? null,
                },
                create: {
                  userId: newUser.id,
                  type: account.type || "oauth",
                  provider: "google",
                  providerAccountId,
                  access_token: account.access_token ?? null,
                  refresh_token: account.refresh_token ?? null,
                  expires_at: account.expires_at ?? null,
                  token_type: account.token_type ?? null,
                  scope: account.scope ?? null,
                  id_token: account.id_token ?? null,
                },
              });

              return newUser;
            });

            user.id = created.id;
          } else {
            // Returning Google user or existing verified-email Synkro account:
            // Never bypass PENDING_APPROVAL, REJECTED, or SUSPENDED!
            const nextStatus = computeExistingUserStatusOnGoogleSignIn(
              existingByEmail.status
            );

            await prisma.$transaction(async (tx) => {
              await tx.user.update({
                where: { id: existingByEmail.id },
                data: {
                  emailVerified: existingByEmail.emailVerified ?? now,
                  status: nextStatus,
                  lastLoginAt: now,
                  ...(existingByEmail.image ? {} : { image: googleAvatar }),
                },
              });

              await tx.account.upsert({
                where: {
                  provider_providerAccountId: {
                    provider: "google",
                    providerAccountId,
                  },
                },
                update: {
                  userId: existingByEmail.id,
                  access_token: account.access_token ?? null,
                  refresh_token: account.refresh_token ?? null,
                  expires_at: account.expires_at ?? null,
                  token_type: account.token_type ?? null,
                  scope: account.scope ?? null,
                  id_token: account.id_token ?? null,
                },
                create: {
                  userId: existingByEmail.id,
                  type: account.type || "oauth",
                  provider: "google",
                  providerAccountId,
                  access_token: account.access_token ?? null,
                  refresh_token: account.refresh_token ?? null,
                  expires_at: account.expires_at ?? null,
                  token_type: account.token_type ?? null,
                  scope: account.scope ?? null,
                  id_token: account.id_token ?? null,
                },
              });
            });

            user.id = existingByEmail.id;
          }
        } catch (err) {
          if (!isDatabaseConnectionError(err) || process.env.NODE_ENV === "production") {
            console.error(
              "[Synkro Auth] Erreur PostgreSQL lors de la connexion Google OAuth:",
              err instanceof Error ? err.name : "DBError"
            );
            return false;
          }

          // Offline memory fallback store (développement local uniquement)
          const store = getFallbackStore();
          const existing = store.users.find(
            (u) =>
              u.emailNormalized === emailNormalized ||
              u.email === emailNormalized
          );

          if (!existing) {
            const newId = `stu-google-${Date.now()}`;
            store.users.push({
              id: newId,
              email: emailNormalized,
              emailNormalized,
              emailVerified: now,
              phone: null,
              phoneNormalized: null,
              firstName,
              lastName,
              passwordHash: null,
              image: googleAvatar,
              bio: null,
              interests: [],
              role: Role.STUDENT,
              status: AccountStatus.PENDING_APPROVAL,
              statusReason: null,
              groupId: null,
              groupName: null,
              groupColor: null,
              notifyEmail: true,
              notifyMatchPublished: true,
              notifyWeeklyReminder: true,
              notifyEndOfCycle: true,
              createdAt: now,
              lastLoginAt: now,
            });
            user.id = newId;
          } else {
            user.id = existing.id;
            existing.emailVerified = existing.emailVerified ?? now;
            existing.status = computeExistingUserStatusOnGoogleSignIn(
              existing.status
            );
            existing.lastLoginAt = now;
            if (!existing.image) {
              existing.image = googleAvatar;
            }
          }
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (user?.email) {
        token.email = user.email;
      }

      let freshUser: UserRecord | null = null;
      if (token.sub) {
        const res = await findUserById(token.sub);
        freshUser = res.user;
      }

      // NextAuth v5 OAuth fix: for Google sign-in, `user.id` passed to `jwt()` may
      // still be Google's provider subject ID rather than Synkro's internal User.id.
      if (
        (!freshUser || account?.provider === "google") &&
        (user?.email || typeof token.email === "string")
      ) {
        const emailToLookup = normalizeEmail(
          user?.email || (token.email as string)
        );
        const byEmail = await findUserByEmail(emailToLookup);
        if (byEmail.user) {
          freshUser = byEmail.user;
          token.sub = freshUser.id;
        }
      }

      if (freshUser) {
        token.sub = freshUser.id;
        token.email = freshUser.email;
        token.firstName = freshUser.firstName;
        token.lastName = freshUser.lastName;
        token.role = freshUser.role;
        token.status = freshUser.status;
        token.emailVerified = Boolean(freshUser.emailVerified);
        token.needsPhoneCompletion = needsPhoneCompletion(freshUser);
        token.groupId = freshUser.groupId;
        token.groupName = freshUser.groupName;
        token.picture = freshUser.image;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.firstName = (token.firstName as string) ?? "Étudiant";
        session.user.lastName = (token.lastName as string) ?? "";
        session.user.role = (token.role as Role) ?? Role.STUDENT;
        session.user.status =
          (token.status as AccountStatus) ?? AccountStatus.PENDING_VERIFICATION;
        session.user.isEmailVerified = Boolean(token.emailVerified);
        session.user.needsPhoneCompletion = Boolean(
          token.needsPhoneCompletion
        );
        session.user.groupId = (token.groupId as string | null) ?? null;
        session.user.groupName = (token.groupName as string | null) ?? null;
        session.user.image = (token.picture as string | null) ?? null;
      }
      return session;
    },
  },
});

/**
 * Resolves the currently signed-in user directly from the database / store.
 */
export async function getCurrentUser(): Promise<{
  user: UserRecord | null;
  dbConnected: boolean;
}> {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return { user: null, dbConnected: true };
  }
  return findUserById(session.user.id);
}

/**
 * Ensures a user is logged in (any account status). Redirects to /login if not.
 */
export async function requireAuthenticatedUser(): Promise<{
  user: UserRecord;
  dbConnected: boolean;
}> {
  const { user, dbConnected } = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return { user, dbConnected };
}

/**
 * Ensures the user has verified their email, been approved (`status === ACTIVE`),
 * AND (for non-admin members) completed their WhatsApp phone number.
 * Server-side redirects:
 * - Unauthenticated -> `/login`
 * - Pending / rejected / suspended -> `/account-status`
 * - Active student without phone -> `/complete-profile`
 */
export async function requireActiveMember(): Promise<{
  user: UserRecord;
  dbConnected: boolean;
}> {
  const { user, dbConnected } = await getCurrentUser();
  const decision = evaluateActiveMemberAccess(user);
  if (!decision.allowed) {
    redirect(decision.redirectTo);
  }
  return { user: user as UserRecord, dbConnected };
}

/**
 * Ensures the user belongs on `/complete-profile` (authenticated, ACTIVE, non-admin, phone missing),
 * redirecting cleanly otherwise to avoid redirect loops.
 */
export async function requirePhoneOnboardingUser(): Promise<{
  user: UserRecord;
  dbConnected: boolean;
}> {
  const { user, dbConnected } = await getCurrentUser();
  const decision = evaluatePhoneOnboardingAccess(user);
  if (!decision.allowed) {
    redirect(decision.redirectTo);
  }
  return { user: user as UserRecord, dbConnected };
}

/**
 * Ensures the user is an active ADMIN or MODERATOR.
 * Admins are never blocked by the student phone onboarding step.
 */
export async function requireAdminOrModerator(): Promise<{
  user: UserRecord;
  dbConnected: boolean;
}> {
  const { user, dbConnected } = await getCurrentUser();
  const decision = evaluateAdminAccess(user, true);
  if (!decision.allowed) {
    redirect(decision.redirectTo);
  }
  return { user: user as UserRecord, dbConnected };
}

/**
 * Ensures the user is an active ADMIN.
 * Admins are never blocked by the student phone onboarding step.
 */
export async function requireAdmin(): Promise<{
  user: UserRecord;
  dbConnected: boolean;
}> {
  const { user, dbConnected } = await getCurrentUser();
  const decision = evaluateAdminAccess(user, false);
  if (!decision.allowed) {
    redirect(decision.redirectTo);
  }
  return { user: user as UserRecord, dbConnected };
}
