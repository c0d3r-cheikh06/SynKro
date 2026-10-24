"use client";

import { MessageSquare, Sparkles, Volume2 } from "lucide-react";
import React, { useState } from "react";

const KORA_QUOTES = [
  "Salut ! Je suis Kora, la chouette algorithmique de Synkro. Prêt(e) à rencontrer tes jumeaux ?",
  "Chaque semaine, 3 camarades d'autres anciennes classes soigneusement appariés pour toi !",
  "0 % de jumelage au sein de ta propre ancienne classe : c'est la garantie absolue de Synkro !",
  "Une paire validée par l'administrateur reste gravée dans le marbre stellaire.",
  "Un clic sur WhatsApp, une pause café sur le campus, et la magie opère !",
];

interface WelcomeOwlHeroProps {
  className?: string;
}

/**
 * Centrepiece Hero Mascot — Kora la chouette informaticienne & gardienne de Synkro.
 * Dotée d'animations vectorielles subtiles (clignement d'yeux, battement d'aile d'accueil,
 * inclinaison douce de la tête, anneau orbital) et d'une bulle de répliques interactive.
 * Conforme aux critères d'accessibilité WCAG AA et respecte prefers-reduced-motion.
 */
export function WelcomeOwlHero({ className = "" }: WelcomeOwlHeroProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isWaving, setIsWaving] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleNextQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % KORA_QUOTES.length);
    setIsWaving(true);
    setHasInteracted(true);
    setTimeout(() => setIsWaving(false), 1200);
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${className}`}
    >
      {/* Interactive Speech Bubble */}
      <div
        className="sk-card sk-animate-in relative mb-4 max-w-sm cursor-pointer border border-[var(--primary-subtle-border)] bg-[var(--surface-elevated)]/90 px-4 py-3 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-[1.02] hover:border-[var(--primary)]"
        onClick={handleNextQuote}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleNextQuote();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Cliquer pour changer le message de Kora la chouette"
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[var(--primary)]">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold tracking-wider text-[var(--primary)] uppercase">
                Kora • Guide Stellaire
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                <MessageSquare className="h-3 w-3" />
                <span>Clique-moi !</span>
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed font-medium text-[var(--foreground)]">
              &laquo;&nbsp;{KORA_QUOTES[quoteIndex]}&nbsp;&raquo;
            </p>
          </div>
        </div>

        {/* Bubble pointer triangle */}
        <div
          aria-hidden="true"
          className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-[var(--surface-elevated)]"
        />
      </div>

      {/* Owl Mascot Card & Graphic Framing */}
      <div
        className="group relative flex cursor-pointer items-center justify-center"
        onClick={handleNextQuote}
        onMouseEnter={() => setIsWaving(true)}
        onMouseLeave={() => setIsWaving(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleNextQuote();
          }
        }}
        aria-label="Kora la chouette informaticienne. Cliquez pour interagir."
      >
        {/* Soft Radial Backlight Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -m-8 rounded-full bg-gradient-to-tr from-sky-500/20 via-blue-600/15 to-violet-500/20 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        />

        {/* The SVG Owl Illustration (Large & Crisp) */}
        <svg
          viewBox="0 0 240 240"
          className="relative h-56 w-56 select-none sm:h-64 sm:w-64 md:h-72 md:w-72"
          fill="none"
          role="img"
          aria-label="Illustration animée de Kora la chouette informaticienne"
        >
          <defs>
            <linearGradient
              id="koraBgGrad"
              x1="0"
              y1="0"
              x2="240"
              y2="240"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#0B132B" />
              <stop offset="50%" stopColor="#1C2D5A" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </linearGradient>

            <linearGradient
              id="koraFeathers"
              x1="40"
              y1="40"
              x2="200"
              y2="200"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="45%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>

            <linearGradient
              id="koraVisor"
              x1="50"
              y1="80"
              x2="190"
              y2="130"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="50%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#C084FC" />
            </linearGradient>

            <linearGradient
              id="koraBelly"
              x1="120"
              y1="130"
              x2="120"
              y2="190"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>

            <filter id="koraGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Cosmic Card Rounded Frame */}
          <rect
            x="4"
            y="4"
            width="232"
            height="232"
            rx="56"
            fill="url(#koraBgGrad)"
            stroke="#38BDF8"
            strokeOpacity="0.35"
            strokeWidth="2"
          />

          {/* Ambient Orbital Rings & Constellations */}
          <ellipse
            cx="120"
            cy="124"
            rx="96"
            ry="34"
            transform="rotate(-15 120 124)"
            stroke="#38BDF8"
            strokeOpacity="0.3"
            strokeWidth="1.8"
            strokeDasharray="6 6"
          />
          <circle cx="36" cy="48" r="2.5" fill="#38BDF8" opacity="0.85" />
          <circle cx="204" cy="54" r="3" fill="#A78BFA" opacity="0.9" />
          <circle cx="202" cy="188" r="2" fill="#38BDF8" opacity="0.75" />
          <circle cx="42" cy="180" r="2.2" fill="#60A5FA" opacity="0.7" />

          {/* Floating constellation lines */}
          <line
            x1="36"
            y1="48"
            x2="56"
            y2="76"
            stroke="#38BDF8"
            strokeOpacity="0.25"
            strokeWidth="1"
          />
          <line
            x1="204"
            y1="54"
            x2="182"
            y2="82"
            stroke="#A78BFA"
            strokeOpacity="0.25"
            strokeWidth="1"
          />

          {/* Head & Body Group (Has subtle tilt animation) */}
          <g className="sk-owl-head origin-[120px_128px]">
            {/* Cyber Feather Tufts / Aigrettes */}
            <path d="M48 62L84 92L96 54Z" fill="#1D4ED8" />
            <path d="M54 64L80 86L88 58Z" fill="#38BDF8" opacity="0.7" />
            <path d="M192 62L156 92L144 54Z" fill="#1D4ED8" />
            <path d="M186 64L160 86L152 58Z" fill="#38BDF8" opacity="0.7" />

            {/* Owl Main Round Torso */}
            <circle cx="120" cy="128" r="76" fill="url(#koraFeathers)" />

            {/* Left Wing (Resting) */}
            <path
              d="M44 116C34 132 38 156 52 168C52 148 50 130 44 116Z"
              fill="#1E40AF"
            />

            {/* Right Wing (Greeting Wing Wave) */}
            <g
              className={`origin-[192px_120px] transition-transform duration-300 ${
                isWaving ? "sk-owl-wing-waving" : ""
              }`}
            >
              <path
                d="M196 112C216 88 220 64 206 52C194 68 190 92 192 124Z"
                fill="#2563EB"
                stroke="#38BDF8"
                strokeWidth="2"
              />
              {/* Soft feather glow on waving wing */}
              <circle cx="210" cy="62" r="3" fill="#38BDF8" filter="url(#koraGlow)" />
            </g>

            {/* Belly (Creamy Soft Light & Tech Chevron Plumage) */}
            <ellipse cx="120" cy="160" rx="44" ry="34" fill="url(#koraBelly)" />
            <path
              d="M104 148L112 156L120 148M120 148L128 156L136 148M112 162L120 170L128 162"
              stroke="#93C5FD"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Friendly Big Eyes with Blinking Animation */}
            <g className="sk-owl-eyes origin-[120px_106px]">
              {/* Eye White Sockets */}
              <circle cx="90" cy="106" r="27" fill="#FFFFFF" />
              <circle cx="150" cy="106" r="27" fill="#FFFFFF" />

              {/* Eye Sclera Rings */}
              <circle
                cx="90"
                cy="106"
                r="26"
                stroke="#E2E8F0"
                strokeWidth="1.5"
                fill="none"
              />
              <circle
                cx="150"
                cy="106"
                r="26"
                stroke="#E2E8F0"
                strokeWidth="1.5"
                fill="none"
              />

              {/* Irises (Deep Cosmic Slate with Cyan Glow) */}
              <circle cx="92" cy="106" r="15" fill="#0B132B" />
              <circle cx="148" cy="106" r="15" fill="#0B132B" />

              <circle cx="92" cy="106" r="9" fill="#0284C7" opacity="0.5" />
              <circle cx="148" cy="106" r="9" fill="#0284C7" opacity="0.5" />

              {/* Expressive Sparkle Highlights (Starlight reflections) */}
              <circle cx="97" cy="100" r="5" fill="#FFFFFF" />
              <circle cx="153" cy="100" r="5" fill="#FFFFFF" />
              <circle cx="87" cy="112" r="2.5" fill="#38BDF8" />
              <circle cx="143" cy="112" r="2.5" fill="#38BDF8" />

              {/* Smiling Cheek Blush */}
              <circle cx="68" cy="126" r="8" fill="#F472B6" opacity="0.35" />
              <circle cx="172" cy="126" r="8" fill="#F472B6" opacity="0.35" />
            </g>

            {/* Computer Scientist Holographic Glasses */}
            <rect
              x="56"
              y="76"
              width="62"
              height="54"
              rx="18"
              fill="#38BDF8"
              fillOpacity="0.09"
              stroke="url(#koraVisor)"
              strokeWidth="4"
            />
            <rect
              x="122"
              y="76"
              width="62"
              height="54"
              rx="18"
              fill="#38BDF8"
              fillOpacity="0.09"
              stroke="url(#koraVisor)"
              strokeWidth="4"
            />
            {/* Glasses Bridge */}
            <line
              x1="118"
              y1="100"
              x2="122"
              y2="100"
              stroke="#38BDF8"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Golden Friendly Beak (Warm smile) */}
            <polygon points="120,118 108,138 132,138" fill="#F59E0B" />
            <polygon points="120,121 112,136 128,136" fill="#FBBF24" />
          </g>

          {/* Mini Cosmic Laptop in front of Kora */}
          <g>
            <rect
              x="68"
              y="160"
              width="104"
              height="52"
              rx="13"
              fill="#070D19"
              stroke="#38BDF8"
              strokeWidth="2.5"
            />
            {/* Illuminated Laptop Screen */}
            <rect
              x="76"
              y="168"
              width="88"
              height="36"
              rx="8"
              fill="#0B1A3A"
              stroke="#1E3A8A"
              strokeWidth="1"
            />
            {/* Glowing Code Symbols on Laptop Screen */}
            <path
              d="M104 180L96 186L104 192M136 180L144 186L136 192M124 177L116 195"
              stroke="#38BDF8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#koraGlow)"
            />
          </g>
        </svg>

        {/* Small Bottom Indicator Badge */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary-subtle-border)] bg-[var(--surface)]/95 px-3 py-1 font-mono text-[11px] font-bold text-[var(--foreground)] shadow-xs backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Kora • En ligne</span>
          </span>
        </div>
      </div>
    </div>
  );
}
