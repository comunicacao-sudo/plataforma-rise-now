import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicyPage } from "@/components/rise-legal";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({ meta: [
    { title: "Política de Privacidade | RISE Now" },
    { name: "description", content: "Informações públicas da plataforma RISE Now." },
    { name: "robots", content: "index,follow" },
  ] }),
  component: PrivacyPolicyPage,
});
