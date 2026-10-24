import React from "react";

export type OwlMood = "default" | "welcome" | "empty" | "thinking" | "success";

interface OwlMascotProps {
  size?: "sm" | "md" | "lg" | "xl";
  mood?: OwlMood;
  animated?: boolean;
  className?: string;
  label?: string;
}

const SIZE_MAP = {
  sm: 36,
  md: 48,
  lg: 72,
  xl: 112,
};

/**
 * Mascotte officielle de Synkro : Kora, la Chouette Informaticienne & Gardienne Stellaire.
 * Design vectoriel Cosmic Tech avec animations subtiles (clignement d'yeux, inclinaison douce,
 * halo orbital) respectant automatiquement prefers-reduced-motion.
 */
export function OwlMascot({
  size = "md",
  mood = "default",
  animated = true,
  className = "",
  label = "Mascotte Synkro — Kora la chouette informaticienne",
}: OwlMascotProps) {
  const px = SIZE_MAP[size];
  const animClass = animated ? "sk-owl-mascot" : "";

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label={label}
      className={`shrink-0 select-none ${animClass} ${className}`}
    >
      <defs>
        <linearGradient id="skOwlBg" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#070D19" />
          <stop offset="55%" stopColor="#132647" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="skOwlPlumage" x1="25" y1="25" x2="95" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="60%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="skOwlVisor" x1="26" y1="38" x2="94" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      {/* Fond cosmique arrondi */}
      <rect width="120" height="120" rx="28" fill="url(#skOwlBg)" />
      <rect
        x="2"
        y="2"
        width="116"
        height="116"
        rx="26"
        stroke="#38BDF8"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />

      {/* Constellation / Anneau orbital subtil */}
      <ellipse
        cx="60"
        cy="62"
        rx="49"
        ry="18"
        transform="rotate(-16 60 62)"
        stroke="#38BDF8"
        strokeOpacity="0.25"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />
      <circle cx="18" cy="24" r="1.6" fill="#38BDF8" opacity="0.8" />
      <circle cx="102" cy="28" r="2" fill="#A78BFA" opacity="0.85" />
      <circle cx="98" cy="96" r="1.5" fill="#38BDF8" opacity="0.65" />

      {/* Groupe tête + corps avec inclinaison douce */}
      <g className={animated ? "sk-owl-head" : ""}>
        {/* Aigrettes cyber-chouette */}
        <path d="M24 31L42 46L48 27Z" fill="#1D4ED8" />
        <path d="M27 32L40 43L44 29Z" fill="#38BDF8" opacity="0.65" />
        <path d="M96 31L78 46L72 27Z" fill="#1D4ED8" />
        <path d="M93 32L80 43L76 29Z" fill="#38BDF8" opacity="0.65" />

        {/* Corps principal */}
        <circle cx="60" cy="64" r="38" fill="url(#skOwlPlumage)" />

        {/* Ailes latérales (avec variante welcome) */}
        {mood === "welcome" ? (
          <>
            <path d="M22 62C14 54 14 42 22 38C26 46 26 56 24 68Z" fill="#1E40AF" />
            <path d="M98 56C108 44 110 32 103 26C97 34 95 46 96 62Z" fill="#2563EB" stroke="#38BDF8" strokeWidth="1.5" />
          </>
        ) : (
          <>
            <path d="M22 58C17 66 19 78 26 84C26 74 25 65 22 58Z" fill="#1E40AF" />
            <path d="M98 58C103 66 101 78 94 84C94 74 95 65 98 58Z" fill="#1E40AF" />
          </>
        )}

        {/* Ventre lumineux */}
        <ellipse cx="60" cy="80" rx="22" ry="17" fill="#EFF6FF" />
        {/* Motifs plumes géométriques sur le ventre */}
        <path
          d="M52 74L56 78L60 74M60 74L64 78L68 74"
          stroke="#93C5FD"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Grands yeux expressifs avec clignement */}
        <g className={animated ? "sk-owl-eyes" : ""}>
          <circle cx="45" cy="53" r="13.5" fill="#FFFFFF" />
          <circle cx="75" cy="53" r="13.5" fill="#FFFFFF" />

          {/* Iris & pupilles selon l'humeur */}
          <circle cx="46" cy="53" r="7.5" fill="#0F172A" />
          <circle cx="74" cy="53" r="7.5" fill="#0F172A" />
          <circle cx="46" cy="53" r="4.2" fill="#0284C7" opacity="0.45" />
          <circle cx="74" cy="53" r="4.2" fill="#0284C7" opacity="0.45" />

          {/* Reflets d'étoiles dans les yeux */}
          <circle cx="48.5" cy="50" r="2.6" fill="#FFFFFF" />
          <circle cx="76.5" cy="50" r="2.6" fill="#FFFFFF" />
          <circle cx="43.5" cy="56" r="1.2" fill="#38BDF8" />
          <circle cx="71.5" cy="56" r="1.2" fill="#38BDF8" />
        </g>

        {/* Lunettes holographiques d'informaticien */}
        <rect
          x="28"
          y="38"
          width="31"
          height="27"
          rx="9"
          fill="#38BDF8"
          fillOpacity="0.08"
          stroke="url(#skOwlVisor)"
          strokeWidth="3"
        />
        <rect
          x="61"
          y="38"
          width="31"
          height="27"
          rx="9"
          fill="#38BDF8"
          fillOpacity="0.08"
          stroke="url(#skOwlVisor)"
          strokeWidth="3"
        />
        <line
          x1="59"
          y1="50"
          x2="61"
          y2="50"
          stroke="#38BDF8"
          strokeWidth="3"
        />

        {/* Bec doré */}
        <polygon points="60,59 54,69 66,69" fill="#F59E0B" />
      </g>

      {/* Mini ordinateur portable Cosmic Tech devant la chouette */}
      <rect
        x="34"
        y="80"
        width="52"
        height="26"
        rx="6.5"
        fill="#091326"
        stroke="#38BDF8"
        strokeWidth="2"
      />
      {/* Symbole </> ou icône d'état sur le capot du laptop */}
      {mood === "success" ? (
        <path
          d="M52 93L57.5 98L69 87"
          stroke="#34D399"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : mood === "thinking" ? (
        <g>
          <circle cx="52" cy="93" r="2.2" fill="#38BDF8" />
          <circle cx="60" cy="93" r="2.2" fill="#60A5FA" />
          <circle cx="68" cy="93" r="2.2" fill="#A78BFA" />
        </g>
      ) : (
        <path
          d="M52 88.5L48 92.5L52 96.5M68 88.5L72 92.5L68 96.5M62 87L58 98"
          stroke="#38BDF8"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
