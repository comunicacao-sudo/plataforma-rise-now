import { defineConfig } from "drizzle-kit";

const OFFICIAL_SUPABASE_PROJECT_REF = "riakceytqrlvdcgcwfdx";
const databaseUrl = process.env.SUPABASE_DB_URL?.trim() ?? "";

function targetsOfficialSupabaseProject(url: URL): boolean {
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "postgres:" && protocol !== "postgresql:") return false;

  const hostname = url.hostname.toLowerCase();
  const username = decodeURIComponent(url.username).toLowerCase();
  const directHostname = `db.${OFFICIAL_SUPABASE_PROJECT_REF}.supabase.co`;
  const poolerUsername = `postgres.${OFFICIAL_SUPABASE_PROJECT_REF}`;

  return (
    (hostname === directHostname && username === "postgres") ||
    (hostname.endsWith(".pooler.supabase.com") && username === poolerUsername)
  );
}

if (databaseUrl) {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("SUPABASE_DB_URL must be a valid PostgreSQL connection URL.");
  }

  if (!targetsOfficialSupabaseProject(parsed)) {
    throw new Error(
      `SUPABASE_DB_URL must target the official project ${OFFICIAL_SUPABASE_PROJECT_REF}.`,
    );
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Local migration tooling may connect only to the official Supabase database.
    // Keep this server-side value out of Vite and out of the published frontend.
    url: databaseUrl,
  },
});

