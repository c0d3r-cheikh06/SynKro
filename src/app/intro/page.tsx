import type { Metadata } from "next";
import { CinematicKoraIntro } from "@/components/CinematicKoraIntro";

export const metadata: Metadata = {
  title: "Bienvenue sur Synkro — Introduction",
  description:
    "Introduction animée de Synkro avec Kora, la chouette informaticienne et gardienne stellaire de la promotion.",
};

export default function IntroPage() {
  return <CinematicKoraIntro />;
}
