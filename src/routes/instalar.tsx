import { createFileRoute } from "@tanstack/react-router";
import { InstallRisePage } from "@/components/pwa-install-page";

export const Route = createFileRoute("/instalar")({
  head: () => ({
    meta: [
      { title: "Instalar aplicativo | RISE NOW" },
      {
        name: "description",
        content:
          "Instale a RISE NOW no Android, iPhone ou computador. Tutorial passo a passo para acessar sua mentoria pelo aplicativo.",
      },
      { property: "og:title", content: "Instale o aplicativo RISE NOW" },
      {
        property: "og:description",
        content:
          "Veja como instalar no Android, iPhone e computador, com o mesmo login da sua mentoria.",
      },
    ],
  }),
  component: InstallRisePage,
});
