import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { NewPasswordScreen } from "@/components/rise-platform";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha | RISE NOW" },
      { name: "description", content: "Crie uma nova senha para acessar a plataforma RISE NOW." },
      { property: "og:title", content: "Nova senha | RISE NOW" },
      { property: "og:description", content: "Redefinição de senha da plataforma RISE NOW." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  return <NewPasswordScreen recovery onDone={() => void navigate({ to: "/" })} />;
}
