import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Origines de développement (utilisées EXCLUSIVEMENT lorsque NODE_ENV !== "production").
 * En production, cette fonction renvoie un tableau vide et ALLOWED_DEV_ORIGINS est ignoré.
 */
const getDevOrigins = (): string[] => {
  if (!isDev) return [];

  const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return [
    "localhost:3000",
    "127.0.0.1:3000",
    "*.devtunnels.ms",
    "*.euw.devtunnels.ms",
    "*.usw2.devtunnels.ms",
    ...extraDevOrigins,
  ];
};

/**
 * Origines de production pour les Server Actions :
 * En production, seuls les domaines explicitement configurés sont autorisés.
 * Les tunnels de développement ne sont JAMAIS injectés ici.
 */
const getProductionServerActionOrigins = (): string[] => {
  const origins = new Set<string>();

  // A. Liste explicite de domaines approuvés (séparés par des virgules)
  const explicitOrigins = (
    process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ||
    process.env.ALLOWED_ORIGINS ||
    ""
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  for (const origin of explicitOrigins) {
    try {
      const host = origin.includes("://") ? new URL(origin).host : origin;
      origins.add(host);
    } catch {
      origins.add(origin);
    }
  }

  // B. Dérivation automatique du domaine de production depuis les URLs de l'application
  for (const urlEnv of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
  ]) {
    if (urlEnv && urlEnv.startsWith("http")) {
      try {
        const parsed = new URL(urlEnv);
        if (
          !parsed.hostname.includes("localhost") &&
          parsed.hostname !== "127.0.0.1"
        ) {
          origins.add(parsed.host);
        }
      } catch {
        // Ignorer une URL invalide
      }
    }
  }

  return Array.from(origins);
};

const serverActionAllowedOrigins = isDev
  ? getDevOrigins()
  : getProductionServerActionOrigins();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  allowedDevOrigins: isDev ? getDevOrigins() : [],
  experimental: {
    serverActions: {
      allowedOrigins: serverActionAllowedOrigins,
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
