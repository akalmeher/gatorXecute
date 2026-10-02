import type { CatchUp, CatchUpRequest, CatchUpResponse } from "@/features/ai/catch-up-types";

/**
 * Feature Owner: Shreya Rameshwar (client side of Divij's POST /api/catch-up).
 * Types come from Divij's contract in features/ai/catch-up-types.ts.
 */
export type { CatchUp, CatchUpAction, CatchUpCommitment, CatchUpRequest } from "@/features/ai/catch-up-types";

/** What the UI works with: success, or one of two failure kinds. */
export type CatchUpResult =
  | { ok: true; source: "gemini" | "demo"; model?: string; catchUp: CatchUp }
  | {
      ok: false;
      /** "unavailable" = service not reachable/configured. "failed" = try again may help. */
      kind: "unavailable" | "failed";
      message: string;
    };

export async function requestCatchUp(
  body: CatchUpRequest,
  signal?: AbortSignal
): Promise<CatchUpResult> {
  let res: Response;
  try {
    res = await fetch("/api/catch-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return {
      ok: false,
      kind: "unavailable",
      message: "Couldn't reach the catch-up service. Check your connection and try again.",
    };
  }

  let data: CatchUpResponse | null = null;
  try {
    data = (await res.json()) as CatchUpResponse;
  } catch {
    data = null;
  }

  if (!data) {
    return {
      ok: false,
      kind: res.status === 404 ? "unavailable" : "failed",
      message:
        res.status === 404
          ? "The catch-up service isn't available in this build yet."
          : "The catch-up service sent back something unexpected.",
    };
  }

  if (data.ok) return { ok: true, source: data.source, model: data.model, catchUp: data.catchUp };

  if (data.error === "missing_key") {
    return {
      ok: false,
      kind: "unavailable",
      message: "AI isn't set up on this server. Turn on demo mode to see a labeled sample instead.",
    };
  }
  return {
    ok: false,
    kind: "failed",
    message: data.message || "Couldn't generate the catch-up. Try again.",
  };
}