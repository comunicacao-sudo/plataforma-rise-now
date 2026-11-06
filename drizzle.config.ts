import { defineConfig } from "drizzle-kit";
const databaseUrl = process.env.SUPABASE_DB_URL?.trim();
if (!databaseUrl)
  throw new Error("Defina SUPABASE_DB_URL do projeto oficial para executar migrações.");
const target = new URL(databaseUrl);
if (
  !["postgres:", "postgresql:"].includes(target.protocol) ||
  !(
    (target.hostname === "db.riakceytqrlvdcgcwfdx.supabase.co" &&
      decodeURIComponent(target.username) === "postgres") ||
    (target.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(target.username) === "postgres.riakceytqrlvdcgcwfdx")
  )
)
  throw new Error("Migração bloqueada: o endereço não é do Supabase oficial da RISE.");
export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: { url: databaseUrl },
});
