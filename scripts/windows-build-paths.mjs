import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

// O adaptador de pré-renderização gera './C:/...' no Windows.
// Normaliza apenas esse caso; não modifica dependências ou o artefato publicado.
if (process.platform === "win32") {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (/^\.\/[A-Za-z]:\//.test(specifier)) {
        return nextResolve(pathToFileURL(specifier.slice(2)).href, context);
      }
      return nextResolve(specifier, context);
    },
  });
}
