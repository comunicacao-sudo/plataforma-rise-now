import ts from "typescript";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve("supabase/functions");
const files = readdirSync(directory, { recursive: true })
  .filter((name) => name.endsWith("index.ts"))
  .map((name) => resolve(directory, name));
const options = {
  noEmit: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
};
const host = ts.createCompilerHost(options),
  originalRead = host.readFile;
host.readFile = (path) => {
  const value = originalRead(path);
  return path.replaceAll("\\", "/").includes("/supabase/functions/")
    ? value?.replace(/\/\/\s*@ts-nocheck/g, "")
    : value;
};
const program = ts.createProgram(files, options, host);
const errors = [
  ...program.getSyntacticDiagnostics(),
  ...ts
    .getPreEmitDiagnostics(program)
    .filter(
      (error) =>
        [2304, 18004].includes(error.code) &&
        !/Cannot find name '(Deno|EdgeRuntime)'/.test(
          ts.flattenDiagnosticMessageText(error.messageText, " "),
        ),
    ),
];
if (errors.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: (path) => path,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => "\n",
    }),
  );
  process.exit(1);
}
console.log("Identificadores das Edge Functions verificados.");
