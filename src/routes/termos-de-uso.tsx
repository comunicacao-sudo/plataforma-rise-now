import { createFileRoute } from "@tanstack/react-router";
import { TermsOfUsePage } from "@/components/rise-legal";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | RISE Now" },
      { name: "description", content: "Informações públicas da plataforma RISE Now." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: TermsOfUsePage,
});
