import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin } from "vite";

/** Mesmo identificador no navegador e no arquivo público, sem depender do provedor de deploy. */
export function appSourceVersion(root: string) {
  const hash = createHash("sha256");
  const paths: string[] = [];
  function collect(path: string) {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && !entry.name.endsWith(".gen.ts")) paths.push(file);
    }
  }
  for (const directory of ["src", "public", "scripts"]) collect(join(root, directory));
  for (const file of ["package.json", "bun.lock", "vite.config.ts", "nitro.config.ts"])
    if (existsSync(join(root, file))) paths.push(join(root, file));
  for (const path of paths.sort()) {
    const name = relative(root, path).replaceAll("\\", "/");
    const bytes = readFileSync(path);
    const text =
      /\.(?:[cm]?[jt]sx?|css|json|lock|webmanifest|html|svg|mdx?|txt|ya?ml|toml|xml|csv)$/.test(
        name,
      ) || /\/_(?:headers|redirects)$/.test(name);
    hash
      .update(name)
      .update("\0")
      .update(text ? bytes.toString("utf8").replaceAll("\r\n", "\n") : bytes)
      .update("\0");
  }
  return hash.digest("hex");
}

export function appVersionPlugin(root: string): Plugin {
  const version = appSourceVersion(root);
  return {
    name: "rise-app-version",
    config: () => ({ define: { "import.meta.env.RISE_APP_VERSION": JSON.stringify(version) } }),
    generateBundle() {
      if (this.environment.name !== "client") return;
      this.emitFile({
        type: "asset",
        fileName: "app-version.json",
        source: JSON.stringify({ version }) + "\n",
      });
    },
  };
}
