"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

type IntroPhase = "enter" | "awaken" | "welcome" | "finish";

interface StarNode {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phaseOffset: number;
  tier: 1 | 2 | 3;
  vx: number;
  vy: number;
  color: string;
}

interface ConstellationEdge {
  from: number;
  to: number;
  length: number;
  packetProgress: number;
}

/**
 * Introduction Cinématographique Spectaculaire de Synkro.
 * Mascotte officielle Kora, la chouette informaticienne, mise en scène avec une animation
 * de motion design haute fidélité (anticipation, réveil des yeux, inclinaison curieuse de la tête,
 * geste cinématique d'accueil de l'aile, respiration vivante et reflets holographiques).
 *
 * Arrière-plan stellaire multi-plans avec parallaxe douce, étoiles à diffraction,
 * réseau de constellations et flux de paquets de données.
 *
 * Conforme WCAG AA, responsive de 320px à 1440px, respect de prefers-reduced-motion.
 */
export function CinematicKoraIntro() {
  const router = useRouter();
  const [phase, setPhase] = useState<IntroPhase>("enter");
  const [isExiting, setIsExiting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasFinishedRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const completeIntroAndNavigate = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    try {
      document.cookie =
        "synkro_intro_seen=1; path=/; max-age=86400; SameSite=Lax";
      sessionStorage.setItem("synkro_intro_seen", "1");
    } catch {
      // Fallback
    }

    setIsExiting(true);
    setTimeout(() => {
      router.push("/?skipIntro=1");
    }, 450);
  };

  // Timeline des 4 phases de l'animation narrative (4,4s total)
  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) {
      const quickTimer = setTimeout(completeIntroAndNavigate, 1200);
      return () => clearTimeout(quickTimer);
    }

    const tAwaken = setTimeout(() => {
      setPhase("awaken");
    }, 1200);

    const tWelcome = setTimeout(() => {
      setPhase("welcome");
    }, 2400);

    const tFinish = setTimeout(() => {
      setPhase("finish");
    }, 4000);

    const tAutoExit = setTimeout(() => {
      completeIntroAndNavigate();
    }, 4800);

    return () => {
      clearTimeout(tAwaken);
      clearTimeout(tWelcome);
      clearTimeout(tFinish);
      clearTimeout(tAutoExit);
    };
  }, []);

  // Parallaxe douce au mouvement de la souris / du doigt
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const normX = (e.clientX / window.innerWidth - 0.5) * 2;
      const normY = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseRef.current.targetX = normX * 14;
      mouseRef.current.targetY = normY * 14;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  // Canvas stellaire immersif & constellations avec paquets de données
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const isMobile = width < 640;

    const starCount = isMobile ? 45 : 95;
    const stars: StarNode[] = Array.from({ length: starCount }, (_, i) => {
      const tier: 1 | 2 | 3 = i % 11 === 0 ? 3 : i % 4 === 0 ? 2 : 1;
      const r = tier === 3 ? 2.8 : tier === 2 ? 1.6 : 0.85;
      const color =
        tier === 3
          ? "rgba(167, 139, 250,"
          : tier === 2
            ? "rgba(56, 189, 248,"
            : "rgba(224, 242, 254,";
      return {
        x: (i * 137.5 + 53) % width,
        y: (i * 229.3 + 97) % height,
        r: r * (isMobile ? 0.8 : 1),
        baseAlpha: tier === 3 ? 0.75 : tier === 2 ? 0.45 : 0.25,
        twinkleSpeed: 0.012 + (i % 5) * 0.008,
        phaseOffset: (i * 0.6) % (Math.PI * 2),
        tier,
        vx: ((i % 3) - 1) * 0.05,
        vy: ((i % 5) - 2) * 0.04,
        color,
      };
    });

    // Établir les liens de constellations entre nœuds majeurs
    const edges: ConstellationEdge[] = [];
    const maxLinkDist = isMobile ? 120 : 170;
    const maxLinkDistSq = maxLinkDist * maxLinkDist;

    for (let i = 0; i < stars.length; i++) {
      if (stars[i].tier < 2) continue;
      for (let j = i + 1; j < stars.length; j++) {
        if (stars[j].tier < 2) continue;
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dSq = dx * dx + dy * dy;
        if (dSq < maxLinkDistSq) {
          edges.push({
            from: i,
            to: j,
            length: Math.sqrt(dSq),
            packetProgress: (i * 0.3) % 1,
          });
        }
      }
    }

    let rafId: number | null = null;
    let t = 0;

    const render = () => {
      t += 0.02;

      // Lerp mouse parallax
      const m = mouseRef.current;
      m.x += (m.targetX - m.x) * 0.08;
      m.y += (m.targetY - m.y) * 0.08;

      ctx.clearRect(0, 0, width, height);

      // 1. Dessiner les lignes de constellations & paquets de données
      for (let e = 0; e < edges.length; e++) {
        const edge = edges[e];
        const a = stars[edge.from];
        const b = stars[edge.to];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d < maxLinkDist) {
          const edgeAlpha = (1 - d / maxLinkDist) * 0.16;
          ctx.strokeStyle = `rgba(56, 189, 248, ${edgeAlpha})`;
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.moveTo(a.x + m.x * 0.5, a.y + m.y * 0.5);
          ctx.lineTo(b.x + m.x * 0.5, b.y + m.y * 0.5);
          ctx.stroke();

          // Petit paquet lumineux circulant le long du câble stellaire
          edge.packetProgress = (edge.packetProgress + 0.004) % 1;
          const px = a.x + dx * edge.packetProgress + m.x * 0.5;
          const py = a.y + dy * edge.packetProgress + m.y * 0.5;
          ctx.fillStyle = `rgba(167, 139, 250, ${edgeAlpha * 2.2})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Dessiner les étoiles & diffraction spikes sur les étoiles de Tier 3
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        const twinkle = Math.sin(t * s.twinkleSpeed * 100 + s.phaseOffset);
        const currentAlpha = Math.max(0.1, Math.min(1, s.baseAlpha + twinkle * 0.22));

        const drawX = s.x + m.x * (s.tier === 3 ? 1.2 : s.tier === 2 ? 0.7 : 0.3);
        const drawY = s.y + m.y * (s.tier === 3 ? 1.2 : s.tier === 2 ? 0.7 : 0.3);

        ctx.fillStyle = `${s.color} ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(drawX, drawY, s.r, 0, Math.PI * 2);
        ctx.fill();

        // Étoiles brillantes Tier 3 avec diffraction en croix subtile
        if (s.tier === 3 && currentAlpha > 0.6) {
          ctx.strokeStyle = `rgba(192, 132, 252, ${currentAlpha * 0.35})`;
          ctx.lineWidth = 0.75;
          const spikeLen = s.r * 3.8;
          ctx.beginPath();
          ctx.moveTo(drawX - spikeLen, drawY);
          ctx.lineTo(drawX + spikeLen, drawY);
          ctx.moveTo(drawX, drawY - spikeLen);
          ctx.lineTo(drawX + spikeLen, drawY);
          ctx.stroke();
        }
      }

      rafId = window.requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <main
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#030712] select-none transition-all duration-500 ease-out ${
        isExiting
          ? "scale-[1.03] opacity-0 pointer-events-none"
          : "scale-100 opacity-100"
      }`}
      aria-label="Introduction animée de Synkro avec Kora la chouette informaticienne"
    >
      {/* 1. Deep Space Atmospheric Nebula Halos */}
      <div
        aria-hidden="true"
        className="sk-intro-glow pointer-events-none absolute h-[76vmax] w-[76vmax] rounded-full bg-gradient-to-tr from-blue-700/22 via-sky-500/18 to-violet-600/16 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-[40vmax] w-[40vmax] rounded-full bg-sky-400/14 blur-2xl"
      />

      {/* 2. Starfield & Constellation Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      {/* 3. Accessible Skip Control ("Passer ›") */}
      <div className="absolute top-5 right-5 sm:top-8 sm:right-8 z-30">
        <button
          type="button"
          onClick={completeIntroAndNavigate}
          className="group inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur-md transition-all duration-200 hover:border-sky-400/60 hover:bg-slate-900/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          aria-label="Passer l'introduction et accéder directement à Synkro"
        >
          <span>Passer</span>
          <ChevronRight
            aria-hidden="true"
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </button>
      </div>

      {/* 4. Central Composition : Kora The Computer Science Owl Mascot */}
      <div className="relative z-20 flex flex-col items-center justify-center px-4">
        <div
          className={`relative flex items-center justify-center transition-transform duration-700 ${
            phase === "enter"
              ? "sk-intro-enter"
              : "sk-intro-float"
          }`}
        >
          {/* Backlight Glow Behind Kora */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-8 rounded-full bg-gradient-to-b from-sky-400/28 via-blue-600/22 to-transparent blur-2xl"
          />

          {/* High-Precision Segmented SVG Character Illustration (320x320) */}
          <svg
            viewBox="0 0 320 320"
            className="relative h-64 w-64 sm:h-76 sm:w-76 md:h-88 md:w-88 select-none drop-shadow-2xl"
            fill="none"
            role="img"
            aria-label="Kora, la chouette informaticienne de Synkro, qui vous accueille"
          >
            <defs>
              {/* Cosmic Card Rounded Gradient */}
              <linearGradient
                id="koraIntroBg"
                x1="0"
                y1="0"
                x2="320"
                y2="320"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#0B132B" />
                <stop offset="45%" stopColor="#15264E" />
                <stop offset="100%" stopColor="#1E3A8A" />
              </linearGradient>

              {/* Plumage Deep Radial Depth */}
              <radialGradient
                id="koraBodyPlumage"
                cx="50%"
                cy="42%"
                r="56%"
                fx="45%"
                fy="38%"
              >
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="35%" stopColor="#2563EB" />
                <stop offset="85%" stopColor="#1D4ED8" />
                <stop offset="100%" stopColor="#172554" />
              </radialGradient>

              {/* Holographic Glasses Visor */}
              <linearGradient
                id="koraIntroVisor"
                x1="70"
                y1="100"
                x2="250"
                y2="170"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="45%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#C084FC" />
              </linearGradient>

              {/* Fluffy Light Plumage Belly */}
              <linearGradient
                id="koraIntroBelly"
                x1="160"
                y1="165"
                x2="160"
                y2="250"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="60%" stopColor="#F1F5F9" />
                <stop offset="100%" stopColor="#CBD5E1" />
              </linearGradient>

              {/* Specular Feather Shading */}
              <linearGradient
                id="koraWingGrad"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="50%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1E40AF" />
              </linearGradient>

              <filter
                id="koraIntroGlowSoft"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* A. Outer Cosmic Frame with Neon Cyan Edge */}
            <rect
              x="8"
              y="8"
              width="304"
              height="304"
              rx="76"
              fill="url(#koraIntroBg)"
              stroke="#38BDF8"
              strokeOpacity="0.45"
              strokeWidth="2.8"
            />

            {/* B. Constellation Orbiting Ring with Celestial Ancienne Classe Anchors */}
            <g className="sk-intro-orbit">
              <ellipse
                cx="160"
                cy="160"
                rx="132"
                ry="46"
                stroke="#38BDF8"
                strokeOpacity="0.32"
                strokeWidth="1.8"
                strokeDasharray="6 7"
              />
              {/* Star Nodes along the Orbit */}
              <circle cx="48" cy="62" r="3.2" fill="#38BDF8" opacity="0.9" />
              <circle cx="272" cy="70" r="3.5" fill="#A78BFA" opacity="0.95" />
              <circle cx="268" cy="250" r="2.8" fill="#38BDF8" opacity="0.8" />
              <circle cx="56" cy="242" r="3" fill="#60A5FA" opacity="0.75" />

              {/* Glowing Mini Constellation Crosses */}
              <path
                d="M48 56V68M42 62H54"
                stroke="#38BDF8"
                strokeWidth="0.8"
                opacity="0.6"
              />
              <path
                d="M272 64V76M266 70H278"
                stroke="#A78BFA"
                strokeWidth="0.8"
                opacity="0.7"
              />
            </g>

            {/* C. Torso, Belly & Left Wing with Organic Breathing */}
            <g className="sk-intro-breathing">
              {/* Main Body */}
              <circle cx="160" cy="168" r="98" fill="url(#koraBodyPlumage)" />

              {/* Left Wing (Resting with Layered Feathers) */}
              <g>
                <path
                  d="M62 152C50 174 54 204 70 220C70 194 68 170 62 152Z"
                  fill="url(#koraWingGrad)"
                />
                <path
                  d="M54 162C46 178 50 198 62 210C62 192 60 176 54 162Z"
                  fill="#1E3A8A"
                  opacity="0.8"
                />
              </g>

              {/* Belly (Soft Cream White with Tech Chevrons) */}
              <ellipse
                cx="160"
                cy="208"
                rx="58"
                ry="44"
                fill="url(#koraIntroBelly)"
              />
              {/* Glowing Feather Chevrons (Evoking Data Packets) */}
              <path
                d="M138 194L149 204L160 194M160 194L171 204L182 194M149 212L160 222L171 212"
                stroke="#60A5FA"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* D. Right Wing (Segmented for Expressive Kinematic Greeting) */}
            <g
              className={
                phase === "welcome" || phase === "finish"
                  ? "sk-intro-wing-salute"
                  : ""
              }
            >
              {/* Primary Flight Feathers */}
              <path
                d="M260 148C286 116 290 84 274 68C258 88 252 120 254 162Z"
                fill="url(#koraWingGrad)"
                stroke="#38BDF8"
                strokeWidth="2.4"
              />
              {/* Secondary Feathers */}
              <path
                d="M252 144C270 118 274 94 262 82C250 98 246 122 248 156Z"
                fill="#38BDF8"
                opacity="0.35"
              />
              {/* Starlight Sparkle on Wing Tip */}
              <circle
                cx="278"
                cy="80"
                r="4"
                fill="#38BDF8"
                filter="url(#koraIntroGlowSoft)"
              />
            </g>

            {/* E. Head, Eyes, Glasses & Golden Beak with Curious Head Tilt */}
            <g
              className={
                phase === "awaken" || phase === "welcome" || phase === "finish"
                  ? "sk-intro-head-awaken"
                  : ""
              }
            >
              {/* Feather Aigrettes (Ear Tufts) with Cyber Highlights */}
              <path d="M68 84L116 124L130 72Z" fill="#1D4ED8" />
              <path d="M76 86L112 116L122 76Z" fill="#38BDF8" opacity="0.75" />
              <path d="M252 84L204 124L190 72Z" fill="#1D4ED8" />
              <path d="M244 86L208 116L198 76Z" fill="#38BDF8" opacity="0.75" />

              {/* Expressive Eyes Group */}
              <g
                className={
                  phase === "enter"
                    ? ""
                    : "sk-intro-eyes-awaken"
                }
              >
                {/* Sclera Rings */}
                <circle cx="122" cy="140" r="34" fill="#FFFFFF" />
                <circle cx="198" cy="140" r="34" fill="#FFFFFF" />

                <circle
                  cx="122"
                  cy="140"
                  r="33"
                  stroke="#E2E8F0"
                  strokeWidth="1.8"
                  fill="none"
                />
                <circle
                  cx="198"
                  cy="140"
                  r="33"
                  stroke="#E2E8F0"
                  strokeWidth="1.8"
                  fill="none"
                />

                {/* Irises with Cosmic Glow */}
                <circle cx="124" cy="140" r="19" fill="#070D1E" />
                <circle cx="196" cy="140" r="19" fill="#070D1E" />

                <circle cx="124" cy="140" r="11" fill="#0284C7" opacity="0.6" />
                <circle cx="196" cy="140" r="11" fill="#0284C7" opacity="0.6" />

                {/* Dual Constellation Catchlights in Pupils */}
                <circle cx="130" cy="133" r="6.5" fill="#FFFFFF" />
                <circle cx="202" cy="133" r="6.5" fill="#FFFFFF" />
                <circle cx="118" cy="148" r="3.2" fill="#38BDF8" />
                <circle cx="190" cy="148" r="3.2" fill="#38BDF8" />

                {/* Smiling Rosy Cheek Blush */}
                <circle cx="92" cy="166" r="10.5" fill="#F472B6" opacity="0.42" />
                <circle cx="228" cy="166" r="10.5" fill="#F472B6" opacity="0.42" />
              </g>

              {/* Cybernetic Holographic Glasses */}
              <g>
                {/* Left Lens Bezel */}
                <rect
                  x="78"
                  y="102"
                  width="80"
                  height="70"
                  rx="23"
                  fill="#38BDF8"
                  fillOpacity="0.1"
                  stroke="url(#koraIntroVisor)"
                  strokeWidth="5"
                />
                {/* Right Lens Bezel */}
                <rect
                  x="162"
                  y="102"
                  width="80"
                  height="70"
                  rx="23"
                  fill="#38BDF8"
                  fillOpacity="0.1"
                  stroke="url(#koraIntroVisor)"
                  strokeWidth="5"
                />
                {/* Bridge */}
                <line
                  x1="158"
                  y1="134"
                  x2="162"
                  y2="134"
                  stroke="#38BDF8"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                />

                {/* Shimmer Light Reflection Sweep Across Glasses */}
                <g className="sk-holo-sweep">
                  <path
                    d="M84 108L106 108L90 166L72 166Z"
                    fill="#FFFFFF"
                    opacity="0.32"
                  />
                  <path
                    d="M168 108L190 108L174 166L156 166Z"
                    fill="#FFFFFF"
                    opacity="0.32"
                  />
                </g>
              </g>

              {/* Golden Welcoming Beak with Smiling Amber Angles */}
              <polygon points="160,154 144,180 176,180" fill="#F59E0B" />
              <polygon points="160,158 149,178 171,178" fill="#FBBF24" />
            </g>

            {/* F. Mini Cosmic Tech Laptop & Floating Code Glyphs */}
            <g>
              <rect
                x="92"
                y="218"
                width="136"
                height="68"
                rx="16"
                fill="#050C1B"
                stroke="#38BDF8"
                strokeWidth="3"
              />
              {/* Illuminated Keyboard Base */}
              <rect
                x="102"
                y="228"
                width="116"
                height="48"
                rx="10"
                fill="#0B1A3A"
                stroke="#1E3A8A"
                strokeWidth="1.4"
              />

              {/* Glowing Code Symbols on Screen */}
              <path
                d="M138 244L128 252L138 260M182 244L192 252L182 260M166 240L154 264"
                stroke="#38BDF8"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#koraIntroGlowSoft)"
              />

              {/* Floating Holographic Glyphs Rising into Space */}
              <g className="sk-glyph-rise-1">
                <text
                  x="116"
                  y="220"
                  fill="#38BDF8"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  &lt;/&gt;
                </text>
              </g>
              <g className="sk-glyph-rise-2">
                <text
                  x="188"
                  y="222"
                  fill="#A78BFA"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  01
                </text>
              </g>
              <g className="sk-glyph-rise-3">
                <text
                  x="154"
                  y="216"
                  fill="#60A5FA"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  &#10022;
                </text>
              </g>
            </g>
          </svg>
        </div>

        {/* 5. Cinematic Welcome Typography (Appears in Phase C & D) */}
        <div
          className={`mt-7 text-center transition-all duration-700 ${
            phase === "welcome" || phase === "finish"
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/35 bg-sky-950/50 px-4 py-1.5 text-xs font-semibold text-sky-300 shadow-sm backdrop-blur-md">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono tracking-wider uppercase">
              Synkro • Gardienne Stellaire
            </span>
          </div>

          <h1 className="mt-3.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Salut, je suis{" "}
            <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
              Kora
            </span>
          </h1>

          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300 sm:text-base leading-relaxed">
            Prépare-toi à connecter ta promotion chaque semaine.
          </p>
        </div>
      </div>

      {/* 6. Timeline Progress Indicator */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 h-1 bg-slate-900/60"
        aria-hidden="true"
      >
        <div className="sk-intro-progress h-full w-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 shadow-sm" />
      </div>
    </main>
  );
}
