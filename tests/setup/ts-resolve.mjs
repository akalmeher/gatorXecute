// Lets Node's built-in test runner load our TypeScript sources the way Next.js
// does: "@/x" resolves from the repo root, and extensionless relative imports
// find their .ts file. Dev-only; no dependencies.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXTENSIONS = [".ts", ".tsx", `${path.sep}index.ts`];

export async function resolve(specifier, context, nextResolve) {
  let base;
  if (specifier.startsWith("@/")) {
    base = path.join(root, specifier.slice(2));
  } else if (/^\.\.?\//.test(specifier) && !path.extname(specifier) && context.parentURL?.startsWith("file:")) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (base) {
    for (const ext of EXTENSIONS) {
      if (existsSync(base + ext)) return nextResolve(pathToFileURL(base + ext).href, context);
    }
  }
  return nextResolve(specifier, context);
}
