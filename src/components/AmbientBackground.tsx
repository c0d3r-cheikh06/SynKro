"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

interface NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  isStar?: boolean;
}

type AmbientIntensity = "cosmic" | "discreet" | "calm" | "quiet" | "tech" | "retro";

function getIntensityForPath(pathname: string | null): AmbientIntensity {
  if (pathname === "/intro") return "quiet";
  if (!pathname || pathname === "/") return "cosmic";
  if (pathname.startsWith("/retro")) return "retro";
  if (pathname.startsWith("/admin")) return "tech";
  if (pathname.startsWith("/profile")) return "quiet";
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/complete-profile") ||
    pathname.startsWith("/account-status") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  ) {
    return "calm";
  }
  return "discreet";
}

/**
 * Synkro Cosmic Tech — Route-Adaptive Ambient Background
 * Adapts constellation density & halo intensity according to the active page:
 *  - "/"                    : "cosmic"   (rich constellation + stellar nodes)
 *  - "/dashboard", "/retro" : "discreet" (subtle background, content-first)
 *  - "/login", "/register"  : "calm"     (soothing orbital drift)
 *  - "/admin", "/profile"   : "quiet"    (neutral workspace for forms & tables)
 * Automatically reduces particle density on mobile viewports (< 640px) and
 * pauses when the tab is hidden or prefers-reduced-motion is enabled.
 */
export function AmbientBackground() {
  const pathname = usePathname();
  const intensity = getIntensityForPath(pathname);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (intensity === "quiet") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const isMobile = width < 640;

    const baseMax =
      intensity === "cosmic"
        ? isMobile
          ? 12
          : 26
        : intensity === "retro"
          ? isMobile
            ? 9
            : 18
          : intensity === "tech"
            ? isMobile
              ? 8
              : 16
            : intensity === "calm"
              ? isMobile
                ? 6
                : 12
              : isMobile
                ? 8
                : 16;

    const nodeCount = Math.min(
      baseMax,
      Math.max(6, Math.floor((width * height) / (isMobile ? 85000 : 64000)))
    );

    const nodes: NetworkNode[] = Array.from({ length: nodeCount }, (_, idx) => {
      const angle = (idx / nodeCount) * Math.PI * 2;
      const speed = intensity === "cosmic" ? 0.17 : 0.12;
      return {
        x: (idx * 197 + 43) % Math.max(width, 320),
        y: (idx * 311 + 71) % Math.max(height, 320),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: idx % 5 === 0 ? 2.3 : 1.45,
        isStar: idx % 5 === 0,
      };
    });

    const readParticleColor = (): string => {
      if (!probeRef.current) return "rgba(56, 189, 248, 0.45)";
      const computed = window.getComputedStyle(probeRef.current).color;
      return computed || "rgba(56, 189, 248, 0.45)";
    };

    let particleColor = readParticleColor();
    let frameCounter = 0;
    let rafId: number | null = null;

    const maxDist = intensity === "cosmic" ? (isMobile ? 120 : 165) : 135;
    const maxDistSq = maxDist * maxDist;
    const lineFactor = intensity === "cosmic" ? 0.2 : 0.12;
    const dotAlpha = intensity === "cosmic" ? 0.55 : 0.35;

    const drawFrame = (advance: boolean) => {
      frameCounter++;
      if (frameCounter % 30 === 0) {
        particleColor = readParticleColor();
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = particleColor;
      ctx.strokeStyle = particleColor;

      if (advance) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        ctx.globalAlpha = a.isStar ? Math.min(0.78, dotAlpha + 0.2) : dotAlpha;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < maxDistSq) {
            const dist = Math.sqrt(dSq);
            const alpha = (1 - dist / maxDist) * lineFactor;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = () => {
      if (document.visibilityState === "visible" && !motionQuery.matches) {
        drawFrame(true);
        rafId = window.requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };

    const startOrStop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      particleColor = readParticleColor();
      drawFrame(false);
      if (document.visibilityState === "visible" && !motionQuery.matches) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      drawFrame(false);
    };

    startOrStop();

    window.addEventListener("resize", handleResize, { passive: true });
    document.addEventListener("visibilitychange", startOrStop);
    motionQuery.addEventListener("change", startOrStop);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", startOrStop);
      motionQuery.removeEventListener("change", startOrStop);
    };
  }, [intensity]);

  return (
    <div
      className={`sk-ambient ${
        intensity === "quiet"
          ? "sk-ambient-quiet"
          : intensity === "discreet"
            ? "sk-ambient-discreet"
            : intensity === "retro"
              ? "sk-ambient-retro"
              : intensity === "tech"
                ? "sk-ambient-tech"
                : intensity === "calm"
                  ? "sk-ambient-calm"
                  : ""
      }`}
      aria-hidden="true"
    >
      <div className="sk-halo sk-halo-1" />
      <div className="sk-halo sk-halo-2" />
      <div className="sk-halo sk-halo-3" />
      <div className="sk-grid" />
      <span ref={probeRef} className="sk-particle-probe" />
      <canvas ref={canvasRef} className="sk-network-canvas" />
    </div>
  );
}
