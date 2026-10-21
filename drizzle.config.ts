import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Variável server-side para tooling local de migrations; nunca deve ir para o frontend.
    url: process.env.SUPABASE_DB_URL ?? "",
  },
});
