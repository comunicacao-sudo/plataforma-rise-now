import { createFileRoute } from "@tanstack/react-router";

import { RiseEntry } from "@/components/rise-entry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RISE NOW | Mentoria" },
      { name: "description", content: "Ambiente privado da mentoria executiva RISE NOW." },
      { property: "og:title", content: "RISE NOW | Mentoria" },
      { property: "og:description", content: "Ambiente privado da mentoria executiva RISE NOW." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <RiseEntry />;
}
