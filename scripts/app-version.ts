import type { Plugin } from "vite";

/** A entrada já recebe o hash do build e referencia os demais módulos e estilos da aplicação. */
export function appVersionFromEntries(entries: string[]) {
  const matches = entries.filter((name) => /^assets\/index-[\w-]+\.js$/.test(name));
  if (matches.length !== 1)
    throw new Error("A entrada da RISE não foi identificada para o aviso de atualização.");
  return "/" + matches[0];
}

export function appVersionPlugin(): Plugin {
  return {
    name: "rise-app-version",
    generateBundle(_options, bundle) {
      if (this.environment.name !== "client") return;
      const entries = Object.values(bundle)
        .filter((file) => file.type === "chunk" && file.isEntry)
        .map((file) => file.fileName);
      this.emitFile({
        type: "asset",
        fileName: "app-version.json",
        source: JSON.stringify({ version: appVersionFromEntries(entries) }) + "\n",
      });
    },
  };
}
