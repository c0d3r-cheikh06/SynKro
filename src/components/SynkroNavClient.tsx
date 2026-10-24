"use client";

import { AccountStatus, Role } from "@prisma/client";
import {
  Camera,
  Database,
  LayoutDashboard,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserCircle,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { OwlMascot } from "./OwlMascot";
import { StudentAvatar } from "./StudentAvatar";
import { ThemeToggle } from "./ThemeToggle";

export interface NavbarUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  image?: string | null;
  role: Role;
  status: AccountStatus;
  emailVerified: boolean;
  needsPhoneCompletion?: boolean;
  groupName: string | null;
  groupColor: string | null;
}

interface SynkroNavClientProps {
  user: NavbarUserSummary | null;
  dbConnected: boolean;
  signOutAction: () => Promise<void>;
}

export function SynkroNavClient({
  user,
  dbConnected,
  signOutAction,
}: SynkroNavClientProps) {
  const pathname = usePathname();
  const [diagOpen, setDiagOpen] = useState(false);

  const isAdminOrMod =
    user?.role === Role.ADMIN || user?.role === Role.MODERATOR;
  const isActive =
    Boolean(user?.emailVerified) && user?.status === AccountStatus.ACTIVE;

  const navItems = user
    ? [
        ...(isActive
          ? user.needsPhoneCompletion
            ? [
                {
                  href: "/complete-profile",
                  label: "Finaliser mon profil",
                  shortLabel: "Finaliser",
                  icon: Sparkles,
                },
              ]
            : [
                {
                  href: "/dashboard",
                  label: "Jumelages",
                  shortLabel: "Jumelages",
                  icon: LayoutDashboard,
                },
                {
                  href: "/retro",
                  label: "Album Rétro",
                  shortLabel: "Album",
                  icon: Camera,
                },
              ]
          : [
              {
                href: "/account-status",
                label: "Statut du compte",
                shortLabel: "Statut",
                icon: Sparkles,
              },
            ]),
        {
          href: "/profile",
          label: "Profil",
          shortLabel: "Profil",
          icon: UserCircle,
        },
      ]
    : [
        {
          href: "/retro",
          label: "Album Rétro",
          shortLabel: "Album",
          icon: Camera,
        },
      ];

  const isRouteActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-xl py-1 pr-2 transition-opacity hover:opacity-95"
          >
            <div className="overflow-hidden rounded-xl shadow-2xs ring-1 ring-[var(--border)] transition-transform duration-200 group-hover:scale-[1.03]">
              <OwlMascot size="sm" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-[var(--foreground)] sm:text-lg">
                  Synkro
                </span>
              </div>
              <span className="hidden text-[11px] font-medium leading-none text-[var(--muted-foreground)] sm:block">
                Constellation étudiante
              </span>
            </div>
          </Link>

          {/* Center Primary Navigation (Desktop) */}
          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-1 md:flex"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isRouteActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150 sm:text-sm ${
                    active
                      ? "bg-[var(--primary-subtle)] text-[var(--primary-subtle-foreground)] shadow-2xs ring-1 ring-[var(--primary-subtle-border)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`h-4 w-4 ${
                      active
                        ? "text-[var(--primary)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {isAdminOrMod && (
              <Link
                href="/admin"
                aria-current={isRouteActive("/admin") ? "page" : undefined}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-150 sm:text-sm ${
                  isRouteActive("/admin")
                    ? "bg-[var(--primary-solid)] text-white shadow-xs"
                    : "border border-[var(--primary-subtle-border)] bg-[var(--primary-subtle)] text-[var(--primary-subtle-foreground)] hover:border-[var(--primary)]"
                }`}
              >
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                <span>Admin</span>
              </Link>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Honest, discreet diagnostic indicator when PostgreSQL is offline */}
            {!dbConnected && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDiagOpen((v) => !v)}
                  title="Base PostgreSQL hors ligne — Mode secours en mémoire actif"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-2.5 text-[11px] font-semibold text-[var(--warning-foreground)] transition-opacity hover:opacity-90"
                >
                  <Database className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Mémoire secours</span>
                </button>
                {diagOpen && (
                  <div className="sk-card absolute right-0 mt-2 w-80 p-4 text-xs shadow-xl z-50">
                    <div className="flex items-center justify-between gap-2 pb-1.5">
                      <span className="font-bold text-[var(--warning-foreground)]">
                        PostgreSQL hors ligne (localhost:5432)
                      </span>
                      <button
                        type="button"
                        onClick={() => setDiagOpen(false)}
                        className="text-[11px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        Fermer
                      </button>
                    </div>
                    <p className="text-[var(--muted-foreground)] leading-relaxed">
                      Le serveur PostgreSQL n&apos;est pas joignable. Synkro fonctionne actuellement sur son <strong>store de secours en mémoire (RAM)</strong> : les inscriptions, modifications de profil et confirmations créées dans ce mode ne seront pas persistées sur disque après le redémarrage du serveur.
                    </p>
                  </div>
                )}
              </div>
            )}

            {user ? (
              <>
                {/* Compact user identity pill */}
                <Link
                  href="/profile"
                  className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] py-1 pr-2.5 pl-1.5 text-xs transition-colors hover:border-[var(--primary-subtle-border)]"
                >
                  <StudentAvatar
                    src={user.image}
                    firstName={user.firstName}
                    lastName={user.lastName}
                    seedKey={user.email}
                    size="xs"
                  />
                  <span className="hidden max-w-[110px] truncate font-semibold text-[var(--foreground)] sm:inline">
                    {user.firstName}
                  </span>
                  {user.groupName && (
                    <span className="hidden items-center gap-1 font-mono text-[10px] text-[var(--muted-foreground)] lg:inline-flex">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: user.groupColor || "#2563EB",
                        }}
                      />
                      {user.groupName}
                    </span>
                  )}
                </Link>

                <ThemeToggle />

                <form action={signOutAction}>
                  <button
                    type="submit"
                    title="Se déconnecter"
                    aria-label="Se déconnecter"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--muted-foreground)] transition-all duration-150 hover:border-[var(--danger-border)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-foreground)] active:scale-95 xl:w-auto xl:gap-1.5 xl:px-3"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    <span className="hidden xl:inline">Déconnexion</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/retro"
                  aria-current={isRouteActive("/retro") ? "page" : undefined}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] md:hidden"
                >
                  <Camera aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
                  <span className="sr-only sm:not-sr-only">Album</span>
                </Link>
                <ThemeToggle />
                <Link
                  href="/login"
                  aria-current={isRouteActive("/login") ? "page" : undefined}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)] sm:text-sm"
                >
                  <LogIn
                    aria-hidden="true"
                    className="h-4 w-4 text-[var(--primary)]"
                  />
                  <span>Connexion</span>
                </Link>
                <Link
                  href="/register"
                  aria-current={isRouteActive("/register") ? "page" : undefined}
                  className="hidden h-10 items-center gap-1.5 rounded-xl bg-[var(--primary-solid)] px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[var(--primary-solid-hover)] sm:inline-flex sm:text-sm"
                >
                  <UserPlus aria-hidden="true" className="h-4 w-4" />
                  <span>Inscription</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Thumb-friendly Mobile Bottom Navigation Bar (only when authenticated) */}
      {user && (
        <nav
          aria-label="Navigation principale mobile"
          className="sk-bottom-nav flex items-center justify-around md:hidden"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="sk-bottom-nav-item"
              >
                <Icon
                  aria-hidden="true"
                  className={`h-5 w-5 transition-transform ${
                    active ? "scale-105 text-[var(--primary)]" : ""
                  }`}
                />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}

          {isAdminOrMod && (
            <Link
              href="/admin"
              aria-current={isRouteActive("/admin") ? "page" : undefined}
              className="sk-bottom-nav-item"
            >
              <ShieldCheck
                aria-hidden="true"
                className={`h-5 w-5 transition-transform ${
                  isRouteActive("/admin") ? "scale-105 text-[var(--primary)]" : ""
                }`}
              />
              <span>Admin</span>
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
