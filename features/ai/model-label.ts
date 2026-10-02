/**
 * Feature Owner: Divij Anand
 * Human label for the model that produced an answer, shown quietly in the UI.
 * Safe to import from client components.
 */
export function modelLabel(model: string | undefined, source: "gemini" | "demo" = "gemini"): string {
  if (source === "demo") return "Not AI";
  if (model && /gemma-4/i.test(model)) return "Gemma 4";
  if (model && /gemma/i.test(model)) return "Gemma";
  return "Gemini";
}
