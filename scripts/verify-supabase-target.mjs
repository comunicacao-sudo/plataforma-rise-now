import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const officialRef = "riakceytqrlvdcgcwfdx";
const oldRef = ["vfkv", "dkqj", "wnmh", "xhlf", "rqba"].join("");
const secretKey = /sb_secret_[A-Za-z0-9_-]{10,}/;
const forbiddenVariable = "SUPABASE_SERVICE_ROLE_KEY";
const failures = [];
const read = (path) => readFileSync(join(root, path), "utf8");
const requireMatch = (text, pattern, message) => {
  if (!pattern.test(text)) failures.push(message);
};

function textFiles(path) {
  if (!existsSync(path)) return [];
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...textFiles(child));
    else if (entry.isFile()) {
      const buffer = readFileSync(child);
      if (buffer.includes(0)) continue;
      try {
        files.push([
          child,
          new TextDecoder("utf-8", { fatal: true }).decode(buffer),
        ]);
      } catch {
        // Binary assets are not configuration or executable text.
      }
    }
  }
  return files;
}

function scan(files, bundle = false) {
  let officialFound = false;
  for (const [path, text] of files) {
    const name = relative(root, path).split("\\").join("/");
    if (text.includes(officialRef)) officialFound = true;
    if (text.includes(oldRef)) failures.push(`Old project reference in ${name}.`);
    if (secretKey.test(text)) failures.push(`Private key detected in ${name}.`);
    if (
      (bundle || name.startsWith("src/") || name === "vite.config.ts") &&
      text.includes(forbiddenVariable)
    ) {
      failures.push(`Privileged credential variable in ${name}.`);
    }
  }
  return officialFound;
}

try {
  const vite = read("vite.config.ts");
  if (!vite.includes(officialRef)) {
    failures.push("Vite must target the official project.");
  }
  requireMatch(
    vite,
    /\benvDefine\s*:\s*false\b/,
    "Vite envDefine must be false.",
  );
  requireMatch(
    vite,
    /\benvPrefix\s*:\s*["']RISE_PUBLIC_["']/,
    "Vite envPrefix must be RISE_PUBLIC_.",
  );
  requireMatch(
    read("supabase/config.toml"),
    new RegExp(`^\\s*project_id\\s*=\\s*["']${officialRef}["']\\s*$`, "m"),
    "The project configuration must target the official project.",
  );
  const drizzle = read("drizzle.config.ts");
  if (
    !drizzle.includes("SUPABASE_DB_URL") ||
    drizzle.includes("LOVABLE_DB_MIGRATION_URL")
  ) {
    failures.push("Drizzle must use only SUPABASE_DB_URL for its connection.");
  }
  requireMatch(
    read(".gitignore"),
    /^\.env\s*$/m,
    ".gitignore must exclude .env.",
  );

  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() ?? "";
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      const identity = [
        parsed.hostname,
        decodeURIComponent(parsed.username),
        parsed.pathname,
      ].join(" ");
      if (!identity.includes(officialRef)) {
        failures.push("SUPABASE_DB_URL targets an unofficial project.");
      }
    } catch {
      failures.push("SUPABASE_DB_URL is invalid.");
    }
  }

  const files = ["src", "supabase", "drizzle", "scripts"].flatMap((path) =>
    textFiles(join(root, path)),
  );
  for (const path of ["vite.config.ts", "drizzle.config.ts", "package.json"]) {
    files.push([join(root, path), read(path)]);
  }
  scan(files);
  if (process.argv.includes("--bundle")) {
    const bundlePath = join(root, ".output/public");
    if (!existsSync(bundlePath)) {
      failures.push("Published SPA bundle is missing.");
    } else if (!scan(textFiles(bundlePath), true)) {
      failures.push("Published SPA bundle lacks the official project reference.");
    }
  }
} catch {
  failures.push("Could not read the required configuration files.");
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`Supabase target verified: ${officialRef}.`);
}