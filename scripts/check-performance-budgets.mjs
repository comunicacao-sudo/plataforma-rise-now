import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const absolute = (path) => new URL(path, root);
const bundleMode = process.argv.includes("--bundle");

const assetBudgets = new Map([
  ["public/brand/rise-platform-fixed-background.avif", 200_000],
  ["public/brand/rise-platform-fixed-background-mobile.avif", 100_000],
  ["public/brand/mentee-home-continuous-dark.avif", 250_000],
  ["public/brand/mentee-home-continuous-dark-mobile.avif", 100_000],
  ["public/brand/mentee-home-continuous-light.avif", 250_000],
  ["public/brand/mentee-home-continuous-light-mobile.avif", 100_000],
  ["public/fonts/Montserrat-VariableFont_wght.woff2", 100_000],
  ["public/fonts/Montserrat-Italic-VariableFont_wght.woff2", 100_000],
]);

const errors = [];
for (const [path, maximum] of assetBudgets) {
  const file = absolute(path);
  if (!existsSync(file)) {
    errors.push(`${path} não existe.`);
    continue;
  }
  const size = statSync(file).size;
  if (size > maximum) errors.push(`${path} tem ${size} bytes; limite: ${maximum}.`);
}

const runtimeSources = ["src/styles.css", "src/routes/__root.tsx"]
  .map((path) => readFileSync(absolute(path), "utf8"))
  .join("\n");
for (const forbidden of [
  "rise-platform-fixed-background.png",
  "mentee-home-continuous-dark.png",
  "mentee-home-continuous-light.png",
  "Montserrat-VariableFont_wght.ttf",
  "Montserrat-Italic-VariableFont_wght.ttf",
]) {
  if (runtimeSources.includes(forbidden))
    errors.push(`Referência pesada voltou ao carregamento crítico: ${forbidden}.`);
}

if (bundleMode) {
  const assetsDirectory = absolute(".output/public/assets/");
  if (!existsSync(assetsDirectory)) {
    errors.push("O bundle de produção não foi encontrado em .output/public/assets.");
  } else {
    const assetsPath = fileURLToPath(assetsDirectory);
    const files = readdirSync(assetsPath).filter((name) => [".js", ".css"].includes(extname(name)));
    const totalGzip = files.reduce(
      (total, name) => total + gzipSync(readFileSync(join(assetsPath, name))).length,
      0,
    );
    const maximumBundleGzip = 900_000;
    if (totalGzip > maximumBundleGzip)
      errors.push(`JavaScript e CSS somam ${totalGzip} bytes gzip; limite: ${maximumBundleGzip}.`);
    else console.log(`Bundle JS/CSS: ${totalGzip} bytes gzip (limite ${maximumBundleGzip}).`);

    const publicEntry = files.find((name) => /^index-[\w-]+\.js$/.test(name));
    if (!publicEntry) {
      errors.push("O JavaScript de entrada pública não foi encontrado no bundle.");
    } else {
      const publicEntryGzip = gzipSync(readFileSync(join(assetsPath, publicEntry))).length;
      const maximumPublicEntryGzip = 120_000;
      if (publicEntryGzip > maximumPublicEntryGzip) {
        errors.push(
          `A entrada pública tem ${publicEntryGzip} bytes gzip; limite: ${maximumPublicEntryGzip}.`,
        );
      } else {
        console.log(
          `Entrada pública: ${publicEntryGzip} bytes gzip (limite ${maximumPublicEntryGzip}).`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error("Orçamento de desempenho excedido:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log("Orçamentos de desempenho verificados.");
