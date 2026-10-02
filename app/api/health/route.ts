import { checkGeminiHealth } from "@/features/ai/gemini";

// GET /api/health: pre-demo check that Gemini is configured and reachable (never exposes the key).
export async function GET() {
  const health = await checkGeminiHealth();
  return Response.json(health, {
    status: health.status === "ready" || health.status === "offline_mode" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
