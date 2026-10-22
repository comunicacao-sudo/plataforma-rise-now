import { defineConfig } from "drizzle-kit";

const OFFICIAL_PROJECT_REF = "riakceytqrlvdcgcwfdx";
const databaseUrl = process.env.SUPABASE_DB_URL?.trim();

if (!databaseUrl) {
  throw new Error("SUPABASE_DB_URL is required for database tooling.");
}

const parsedDatabaseUrl = new URL(databaseUrl);
const isOfficialDirect =
  parsedDatabaseUrl.hostname === `db.${OFFICIAL_PROJECT_REF}.supabase.co` &&
  decodeURIComponent(parsedDatabaseUrl.username) === "postgres";
const isOfficialPooler =
  parsedDatabaseUrl.hostname.endsWith(".pooler.supabase.com") &&
  decodeURIComponent(parsedDatabaseUrl.username) === `postgres.${OFFICIAL_PROJECT_REF}`;

if (!isOfficialDirect && !isOfficialPooler) {
  throw new Error(`SUPABASE_DB_URL must target the official project ${OFFICIAL_PROJECT_REF}.`);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: databaseUrl,
  },
});
