import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmbientBackground } from "@/components/AmbientBackground";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Synkro — Plateforme de jumelage entre anciennes classes pour étudiants",
    template: "%s | Synkro",
  },
  description:
    "Faites connaissance avec toute votre promotion grâce aux jumelages hebdomadaires entre anciennes classes sur 6 semaines (DUT INFO, DUT TR, GLSI, SRT, Autres).",
};

/**
 * Pre-hydration theme initializer using CSSStyleSheet (adoptedStyleSheets)
 * so the browser paints the stored theme immediately with zero FOUC and
 * without mutating DOM attributes managed by React hydration.
 * Because all design tokens in globals.css use light-dark(), setting
 * `color-scheme: dark` flips the entire palette and theme icon colors
 * before the first paint.
 */
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("synkro-theme");var d=s==="dark"||(!s&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d&&typeof CSSStyleSheet!=="undefined"&&document.adoptedStyleSheets){var sh=new CSSStyleSheet();sh.replaceSync(":root{color-scheme:dark;}");document.adoptedStyleSheets=[...document.adoptedStyleSheets,sh];window.__synkroPreSheet=sh;}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] selection:bg-blue-500/20 selection:text-[var(--primary)]">
        <ThemeProvider>
          <AmbientBackground />
          <div className="relative z-10 flex min-h-full flex-1 flex-col">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
