import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Gamepad2,
  GitBranch,
  MessageCircle,
  Network,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { OwlMascot } from "@/components/OwlMascot";
import { SynkroNavbar } from "@/components/SynkroNavbar";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserPrimaryDestination } from "@/lib/auth-guards";
import { getActiveGroups } from "@/lib/data-store";
import { AVATAR_PRESETS } from "@/lib/validation";

async function HomeDynamicContent() {
  const [{ user, dbConnected }, { groups }] = await Promise.all([
    getCurrentUser(),
    getActiveGroups(),
  ]);

  const activeGroups = groups.filter((g) => g.isActive);
  const heroAvatars = AVATAR_PRESETS.slice(0, 6);

  const primaryDest = user ? resolveUserPrimaryDestination(user) : "/login";
  let primaryDestLabel = "Voir mes jumelages";
  if (primaryDest === "/admin") {
    primaryDestLabel = "Tableau de bord Admin";
  } else if (primaryDest === "/complete-profile") {
    primaryDestLabel = "Finaliser mon profil";
  } else if (primaryDest === "/account-status") {
    primaryDestLabel = "Suivre ma demande";
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SynkroNavbar user={user} dbConnected={dbConnected} />

      <main className="flex-1">
        {/* ==================== COSMIC TECH HERO ==================== */}
        <section className="relative overflow-hidden border-b border-[var(--border)] py-10 sm:py-16 lg:py-20">
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              {/* Left Column: Clear Value Proposition & CTAs */}
              <div className="sk-animate-in lg:col-span-6">
                <div className="sk-eyebrow">
                  <span className="sk-eyebrow-dot">SYNKRO</span>
                  <Sparkles
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-[var(--primary)]"
                  />
                  <span>Constellation entre anciennes classes • Cycle de 6 semaines</span>
                </div>

                <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-5xl lg:leading-[1.15]">
                  Des connexions qui{" "}
                  <span className="sk-text-gradient">
                    rapprochent les anciennes classes
                  </span>
                  .
                </h1>

                <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg">
                  Découvre tes jumelages, rencontre d&apos;autres étudiants et
                  construis de nouvelles connexions pendant six semaines.
                </p>

                {/* Active Anciennes Classes Strip — Name & Color Badge Only (Zero Headcounts) */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {activeGroups.map((g) => (
                    <span key={g.id} className="sk-group-chip">
                      <span
                        className="sk-group-dot"
                        style={{ backgroundColor: g.color || "#2563EB" }}
                      />
                      <span>{g.name}</span>
                    </span>
                  ))}
                </div>

                {/* Primary & Secondary CTAs */}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {user ? (
                    <Link
                      href={primaryDest}
                      className="sk-btn sk-btn-primary min-h-12 px-6 py-3 text-base"
                    >
                      <span>{primaryDestLabel}</span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="sk-btn sk-btn-primary min-h-12 px-6 py-3 text-base"
                      >
                        <span>Se connecter</span>
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                      <Link
                        href="/register"
                        className="sk-btn sk-btn-secondary min-h-12 px-6 py-3 text-base"
                      >
                        <span>Créer mon compte</span>
                      </Link>
                    </>
                  )}
                  <a
                    href="#fonctionnement"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)]"
                  >
                    <span>Découvrir Synkro</span>
                  </a>
                </div>

                {/* Gaming Character Avatars Preview Strip */}
                <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-6">
                  <div className="flex -space-x-2.5">
                    {heroAvatars.map((p) => (
                      <div
                        key={p.id}
                        className="sk-avatar h-11 w-11 rounded-full ring-2 ring-[var(--background)]"
                      >
                        <Image
                          src={p.url}
                          alt={p.label}
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="text-xs">
                    <p className="flex items-center gap-1.5 font-bold text-[var(--foreground)]">
                      <Gamepad2
                        aria-hidden="true"
                        className="h-3.5 w-3.5 text-[var(--primary)]"
                      />
                      <span>10 avatars Gaming originaux + photo libre</span>
                    </p>
                    <p className="text-[var(--muted-foreground)]">
                      0 % de jumelage au sein de la même ancienne classe garanti par l&apos;algorithme
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Editorial Collaboration & Platform Highlights */}
              <div className="sk-animate-in sk-delay-1 relative lg:col-span-6">
                <div className="relative mx-auto max-w-xl lg:max-w-none space-y-4">
                  {/* Editorial Collaboration Snapshot */}
                  <div className="sk-photo sk-edge relative aspect-16/10 w-full overflow-hidden rounded-2xl shadow-lg border border-[var(--border)]">
                    <Image
                      src="/images/scenes/hero-collaboration.jpg"
                      alt="Étudiants sénégalais en informatique collaborant sur le campus"
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent"
                    />
                    <div className="absolute top-3.5 left-3.5">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                        <span className="sk-live-dot h-2 w-2 rounded-full bg-sky-400" />
                        <span>Rencontres entre anciennes classes hebdomadaires</span>
                      </span>
                    </div>
                    <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-3 text-white">
                      <div>
                        <p className="font-mono text-[10px] font-semibold tracking-wider text-sky-300 uppercase">
                          Promotion Informatique &amp; Réseaux
                        </p>
                        <p className="mt-0.5 text-sm font-bold sm:text-base">
                          Connecter des talents par-delà les anciennes classes
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg border border-white/20 bg-slate-900/60 px-2.5 py-1 font-mono text-[10px] font-bold text-sky-200">
                        Cycle 6 sem.
                      </span>
                    </div>
                  </div>

                  {/* Matching Platform Highlights Card */}
                  <div className="sk-card sk-edge p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)] border border-[var(--primary-subtle-border)]">
                          <GitBranch aria-hidden="true" className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--foreground)]">
                            Algorithme k-facteur équitable
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            3 jumeaux d&apos;autres anciennes classes chaque lundi • 0% de doublon
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--success-foreground)]">
                        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>Validation mutuelle</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 3 SIMPLE STEPS ==================== */}
        <section id="fonctionnement" className="py-14 sm:py-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl">
              <span className="sk-badge sk-badge-primary">Fonctionnement</span>
              <h2 className="mt-2.5 text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
                Trois étapes simples chaque semaine
              </h2>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                {
                  step: "01",
                  icon: Network,
                  title: "3 jumeaux d'autres anciennes classes",
                  desc: "L'algorithme t'assigne 3 étudiants issus des autres anciennes classes de la promotion, sans jamais répéter une paire.",
                },
                {
                  step: "02",
                  icon: MessageCircle,
                  title: "Contact WhatsApp en 1 clic",
                  desc: "Lance la discussion directement depuis ta carte de jumelage et organisez une pause café ou un échange sur le campus.",
                },
                {
                  step: "03",
                  icon: Camera,
                  title: "Confirmation & Album Rétro",
                  desc: "Validez mutuellement votre rencontre et partagez vos meilleurs souvenirs dans l'Album Rétro avec consentement.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="sk-card-interactive flex flex-col justify-between p-6"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--primary-subtle-border)] bg-[var(--primary-subtle)] text-[var(--primary)]">
                          <Icon aria-hidden="true" className="h-5 w-5" />
                        </div>
                        <span className="font-mono text-xs font-bold text-[var(--muted-foreground)]">
                          ÉTAPE {item.step}
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold text-[var(--foreground)]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-6 text-xs text-[var(--muted-foreground)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <OwlMascot size="sm" animated={false} />
            <span className="font-bold text-[var(--foreground)]">Synkro</span>
            <span>— Constellation étudiante entre anciennes classes</span>
          </div>
          <div className="flex flex-wrap justify-center gap-5 font-medium">
            <Link
              href="/intro"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--primary)]"
            >
              <Sparkles className="h-3 w-3 text-sky-400" />
              <span>Revoir l&apos;introduction</span>
            </Link>
            <Link
              href="/login"
              className="transition-colors hover:text-[var(--primary)]"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="transition-colors hover:text-[var(--primary)]"
            >
              Inscription
            </Link>
            <Link
              href="/retro"
              className="transition-colors hover:text-[var(--primary)]"
            >
              Album Rétro
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
          <OwlMascot size="md" mood="thinking" />
          <span>Chargement de Synkro…</span>
        </div>
      }
    >
      <HomeDynamicContent />
    </Suspense>
  );
}
