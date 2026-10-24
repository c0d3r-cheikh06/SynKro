"use client";

import Image from "next/image";
import { useState } from "react";
import { getPortraitUrlBySeed } from "@/lib/validation";

interface StudentAvatarProps {
  src?: string | null;
  firstName: string;
  lastName: string;
  seedKey?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  accentColor?: string | null;
  className?: string;
}

const SIZE_CLASSES: Record<
  NonNullable<StudentAvatarProps["size"]>,
  { box: string; px: number; text: string }
> = {
  xs: { box: "h-7 w-7 rounded-lg", px: 28, text: "text-[10px]" },
  sm: { box: "h-9 w-9 rounded-xl", px: 36, text: "text-xs" },
  md: { box: "h-12 w-12 rounded-2xl", px: 48, text: "text-sm" },
  lg: { box: "h-14 w-14 rounded-2xl", px: 56, text: "text-base" },
  xl: { box: "h-20 w-20 rounded-2xl", px: 80, text: "text-lg" },
};

/**
 * Resolves a student's avatar URL to a Synkro CS Character avatar if missing
 * or if pointing to a legacy preset, while strictly preserving any custom
 * uploaded personal photo (/uploads/..., data:..., etc.).
 */
export function resolveStudentAvatarUrl(
  src: string | null | undefined,
  seed: string
): string {
  if (
    !src ||
    src.startsWith("/avatars/owl-") ||
    src.startsWith("/avatars/gaming-") ||
    src.startsWith("/images/portraits/")
  ) {
    return getPortraitUrlBySeed(seed);
  }
  return src;
}

export function StudentAvatar({
  src,
  firstName,
  lastName,
  seedKey,
  size = "md",
  accentColor,
  className = "",
}: StudentAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const seed = seedKey || `${firstName}-${lastName}`;
  const resolvedSrc = resolveStudentAvatarUrl(src, seed);
  const imgError = failedSrc === resolvedSrc;
  const initials =
    `${firstName.trim()[0] || "S"}${lastName.trim()[0] || ""}`.toUpperCase();
  const dim = SIZE_CLASSES[size];

  return (
    <div
      className={`sk-avatar sk-avatar-hover ${dim.box} ${className}`}
      style={
        accentColor
          ? {
              boxShadow: `0 0 0 2px ${accentColor}33, 0 6px 16px -8px var(--shadow-color-strong)`,
            }
          : undefined
      }
    >
      {!imgError ? (
        <Image
          src={resolvedSrc}
          alt={`Portrait de ${firstName} ${lastName}`}
          width={dim.px}
          height={dim.px}
          onError={() => setFailedSrc(resolvedSrc)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className={`sk-avatar-monogram ${dim.text}`}
          style={{
            background: accentColor
              ? `linear-gradient(135deg, ${accentColor}, #173B67)`
              : "linear-gradient(135deg, #2563EB, #173B67)",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
