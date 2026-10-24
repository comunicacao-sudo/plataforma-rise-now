import { createFileRoute } from "@tanstack/react-router";
import { AboutRisePage } from "@/components/rise-legal";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre a RISE Now" },
      { name: "description", content: "Informações públicas da plataforma RISE Now." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: AboutRisePage,
});
