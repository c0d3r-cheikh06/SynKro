import { AccountStatus, Role } from "@prisma/client";
import { normalizeEmail } from "./crypto";
import { normalizePhoneNumber } from "./phone";

export interface GuardUserShape {
  id: string;
  email: string;
  emailVerified: Date | null;
  phone: string | null;
  phoneNormalized: string | null;
  role: Role;
  status: AccountStatus;
  groupId?: string | null;
}

export type AccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      redirectTo:
        | "/login"
        | "/account-status"
        | "/complete-profile"
        | "/dashboard"
        | "/admin";
    };

/**
 * Determines whether an authenticated user must complete their WhatsApp phone number
 * before accessing `/dashboard` and student matching features.
 *
 * Rules (Partie 2.4):
 * - Pending / unverified / rejected / suspended accounts are handled by `/account-status`, not `/complete-profile`.
 * - Administrators are never blocked by the student phone completion step.
 * - Any ACTIVE non-admin user without a valid normalized phone must complete their phone first.
 */
export function needsPhoneCompletion(user: GuardUserShape | null): boolean {
  if (!user) return false;
  if (!user.emailVerified || user.status !== AccountStatus.ACTIVE) {
    return false;
  }
  if (user.role === Role.ADMIN) {
    return false;
  }
  const normalized = normalizePhoneNumber(user.phoneNormalized ?? user.phone);
  return !normalized;
}

/**
 * Computes the natural destination route for a signed-in user (e.g. after `/login` or from `/` CTA),
 * avoiding redirect loops across every account state.
 */
export function resolveUserPrimaryDestination(
  user: GuardUserShape | null
): "/login" | "/account-status" | "/complete-profile" | "/dashboard" | "/admin" {
  if (!user) return "/login";
  if (!user.emailVerified || user.status !== AccountStatus.ACTIVE) {
    return "/account-status";
  }
  if (user.role === Role.ADMIN) {
    return "/admin";
  }
  if (needsPhoneCompletion(user)) {
    return "/complete-profile";
  }
  return "/dashboard";
}

/**
 * Server-side access check for `/dashboard` and active member features.
 */
export function evaluateActiveMemberAccess(
  user: GuardUserShape | null
): AccessDecision {
  if (!user) {
    return { allowed: false, redirectTo: "/login" };
  }
  if (!user.emailVerified || user.status !== AccountStatus.ACTIVE) {
    return { allowed: false, redirectTo: "/account-status" };
  }
  if (needsPhoneCompletion(user)) {
    return { allowed: false, redirectTo: "/complete-profile" };
  }
  return { allowed: true };
}

/**
 * Server-side access check for `/complete-profile` (prevents redirect loops).
 */
export function evaluatePhoneOnboardingAccess(
  user: GuardUserShape | null
): AccessDecision {
  if (!user) {
    return { allowed: false, redirectTo: "/login" };
  }
  if (!user.emailVerified || user.status !== AccountStatus.ACTIVE) {
    return { allowed: false, redirectTo: "/account-status" };
  }
  if (user.role === Role.ADMIN) {
    return { allowed: false, redirectTo: "/admin" };
  }
  if (!needsPhoneCompletion(user)) {
    return { allowed: false, redirectTo: "/dashboard" };
  }
  return { allowed: true };
}

/**
 * Server-side access check for `/admin` (never blocked by student phone step).
 */
export function evaluateAdminAccess(
  user: GuardUserShape | null,
  allowModerator = false
): AccessDecision {
  if (!user) {
    return { allowed: false, redirectTo: "/login" };
  }
  if (!user.emailVerified || user.status !== AccountStatus.ACTIVE) {
    return { allowed: false, redirectTo: "/account-status" };
  }
  const hasRole =
    user.role === Role.ADMIN ||
    (allowModerator && user.role === Role.MODERATOR);
  if (!hasRole) {
    return {
      allowed: false,
      redirectTo: needsPhoneCompletion(user)
        ? "/complete-profile"
        : "/dashboard",
    };
  }
  return { allowed: true };
}

export interface GoogleIdentityPayload {
  email?: string | null;
  emailVerifiedByGoogle?: boolean | null;
  providerAccountId?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  fullName?: string | null;
  image?: string | null;
}

/**
 * Validates incoming Google OAuth identity claims and computes non-escalating status transitions.
 * Google verification NEVER bypasses Synkro administrative approval (`PENDING_APPROVAL`).
 */
export function validateGoogleIdentityClaims(
  payload: GoogleIdentityPayload
):
  | {
      ok: true;
      emailNormalized: string;
      providerAccountId: string;
      firstName: string;
      lastName: string;
    }
  | { ok: false; reason: string } {
  if (!payload.providerAccountId || !payload.providerAccountId.trim()) {
    return { ok: false, reason: "Identifiant Google manquant." };
  }
  if (!payload.email || !payload.email.trim()) {
    return { ok: false, reason: "Adresse e-mail Google manquante." };
  }
  // Explicitly reject if Google reports email_verified === false
  if (payload.emailVerifiedByGoogle === false) {
    return {
      ok: false,
      reason: "L'adresse e-mail du compte Google n'est pas vérifiée.",
    };
  }

  const emailNormalized = normalizeEmail(payload.email);
  const nameParts = (payload.fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName =
    payload.givenName?.trim() || nameParts[0] || "Étudiant";
  const lastName =
    payload.familyName?.trim() ||
    (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Synkro");

  return {
    ok: true,
    emailNormalized,
    providerAccountId: payload.providerAccountId.trim(),
    firstName,
    lastName,
  };
}

/**
 * Computes the next account status when an existing user signs in via Google.
 * Never promotes PENDING_APPROVAL, CORRECTION_REQUESTED, REJECTED, or SUSPENDED to ACTIVE.
 */
export function computeExistingUserStatusOnGoogleSignIn(
  currentStatus: AccountStatus
): AccountStatus {
  if (currentStatus === AccountStatus.PENDING_VERIFICATION) {
    return AccountStatus.PENDING_APPROVAL;
  }
  return currentStatus;
}
