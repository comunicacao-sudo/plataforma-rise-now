import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const OFFICIAL_PROJECT_REF = "riakceytqrlvdcgcwfdx";
const FORBIDDEN_PROJECT_REF = ["vfkv", "dkqj", "wnmh", "xhlf", "rqba"].join("");
const ROOT = process.cwd();
const CHECK_BUNDLE = process.argv.includes("--bundle");
const failures = [];

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
]);

async function read(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function targetsOfficialSupabaseProject(url) {
  const protocol = url.protocol.toLowerCase();
  if (protocol !== "postgres:" && protocol !== "postgresql:") return false;

  const hostname = url.hostname.toLowerCase();
  const username = decodeURIComponent(url.username).toLowerCase();
  const directHostname = `db.${OFFICIAL_PROJECT_REF}.supabase.co`;
  const poolerUsername = `postgres.${OFFICIAL_PROJECT_REF}`;

  return (
    (hostname === directHostname && username === "postgres") ||
    (hostname.endsWith(".pooler.supabase.com") && username === poolerUsername)
  );
}

async function collectTextFiles(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!existsSync(absolutePath)) return [];
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...(await collectTextFiles(child)));
    else if (textExtensions.has(path.extname(entry.name))) files.push(child);
  }
  return files;
}

const [viteConfig, supabaseConfig, drizzleConfig, gitignore] = await Promise.all([
  read("vite.config.ts"),
  read("supabase/config.toml"),
  read("drizzle.config.ts"),
  read(".gitignore"),
]);

requireCondition(
  viteConfig.includes(`const SUPABASE_PROJECT_ID = "${OFFICIAL_PROJECT_REF}"`),
  "vite.config.ts must pin the official Supabase project.",
);
requireCondition(
  viteConfig.includes("envDefine: false"),
  "Lovable VITE_* injection must stay disabled.",
);
requireCondition(
  viteConfig.includes('envPrefix: "RISE_PUBLIC_"'),
  "Native Vite VITE_* loading must stay disabled.",
);
requireCondition(
  new RegExp(`project_id\\s*=\\s*"${OFFICIAL_PROJECT_REF}"`).test(supabaseConfig),
  "supabase/config.toml must target the official project.",
);
requireCondition(
  drizzleConfig.includes("SUPABASE_DB_URL") && !drizzleConfig.includes("LOVABLE_DB_MIGRATION_URL"),
  "Migration tooling must use only the guarded SUPABASE_DB_URL.",
);
requireCondition(
  gitignore.split(/\r?\n/).includes(".env"),
  ".env must remain ignored because Lovable materializes it automatically.",
);

if (existsSync(path.join(ROOT, ".git"))) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", ".env"], {
      cwd: ROOT,
      stdio: "ignore",
    });
    failures.push(".env is still tracked by Git and must be removed from the repository.");
  } catch {
    // Expected: generated environment files may exist locally, but must stay untracked.
  }
}

const databaseUrl = process.env.SUPABASE_DB_URL?.trim();
if (databaseUrl) {
  let officialDatabaseTarget = false;
  try {
    const parsed = new URL(databaseUrl);
    officialDatabaseTarget = targetsOfficialSupabaseProject(parsed);
  } catch {
    failures.push("SUPABASE_DB_URL is not a valid URL.");
  }
  requireCondition(officialDatabaseTarget, `SUPABASE_DB_URL must target ${OFFICIAL_PROJECT_REF}.`);
}

const sourceFiles = [
  "vite.config.ts",
  "drizzle.config.ts",
  "package.json",
  ...(await collectTextFiles("src")),
  ...(await collectTextFiles("supabase")),
  ...(await collectTextFiles("drizzle")),
  ...(await collectTextFiles("scripts")),
];

for (const relativePath of sourceFiles) {
  const content = await read(relativePath);
  if (content.includes(FORBIDDEN_PROJECT_REF)) {
    failures.push(`${relativePath} references the retired Supabase project.`);
  }
  if (
    (relativePath === "vite.config.ts" ||
      (relativePath.startsWith(`src${path.sep}`) &&
        // Platform-generated server-only file; never bundled for the browser (checked below via --bundle).
        !relativePath.endsWith(`client.server.ts`))) &&
    content.includes("SUPABASE_SERVICE_ROLE_KEY")
  ) {
    failures.push(`${relativePath} exposes an administrative Supabase variable to the app.`);
  }
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(content)) {
    failures.push(`${relativePath} contains a Supabase secret key.`);
  }
}

if (CHECK_BUNDLE) {
  const bundleRoot = [path.join(".output", "public"), path.join("dist", "client")].find((p) =>
    existsSync(path.join(ROOT, p)),
  ) ?? path.join("dist", "client");
  requireCondition(
    existsSync(path.join(ROOT, bundleRoot)),
    "Production bundle (dist/client or .output/public) is missing.",
  );
  const bundleFiles = await collectTextFiles(bundleRoot);
  let officialReferenceCount = 0;
  for (const relativePath of bundleFiles) {
    const content = await read(relativePath);
    if (content.includes(OFFICIAL_PROJECT_REF)) officialReferenceCount += 1;
    if (content.includes(FORBIDDEN_PROJECT_REF)) {
      failures.push(`${relativePath} contains the retired Supabase project.`);
    }
    if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      failures.push(`${relativePath} contains an administrative Supabase variable.`);
    }
    if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(content)) {
      failures.push(`${relativePath} contains a Supabase secret key.`);
    }
  }
  requireCondition(
    officialReferenceCount > 0,
    "Production bundle does not contain the official Supabase project reference.",
  );
}

if (failures.length) {
  console.error("Supabase target verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Supabase target verified: ${OFFICIAL_PROJECT_REF}${CHECK_BUNDLE ? " (including bundle)" : ""}.`,
);

