// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const SUPABASE_PROJECT_ID = "riakceytqrlvdcgcwfdx";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FIGZKXPtP95H79oulodRbg_W5xKFp9v";

export default defineConfig({
  // Lovable manages its own VITE_* environment. Keep that environment from
  // silently reconnecting this frontend to a different Supabase project.
  envDefine: false,
  tanstackStart: {
    // The published Lovable artifact is a client-only SPA. All privileged work
    // runs in Supabase Edge Functions, never in Lovable's runtime.
    spa: { enabled: true },
  },
  vite: {
    // Prevent Vite's native VITE_* loader from re-injecting Lovable-managed
    // variables after the wrapper injection above has been disabled.
    envPrefix: "RISE_PUBLIC_",
    define: {
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(SUPABASE_PROJECT_ID),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_PUBLISHABLE_KEY),
    },
  },
});
