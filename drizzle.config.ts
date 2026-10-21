import { defineConfig } from "drizzle-kit";

const OFFICIAL_SUPABASE_PROJECT_REF = "riakceytqrlvdcgcwfdx";
const databaseUrl = process.env.SUPABASE_DB_URL?.trim() ?? "";

if (databaseUrl) {
  let identity: string;
  try {
    const parsed = new URL(databaseUrl);
    identity = [
      parsed.hostname,
      decodeURIComponent(parsed.username),
      parsed.pathname,
    ].join(" ");
  } catch {
    throw new Error("SUPABASE_DB_URL must be a valid database URL.");
  }
  if (!identity.includes(OFFICIAL_SUPABASE_PROJECT_REF)) {
    throw new Error("SUPABASE_DB_URL must identify the official project.");
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Variável server-side para tooling local de migrations; nunca deve ir para o frontend.
    url: databaseUrl,
  },
});
