import { generatePlan } from "@/features/plan/plan-service";

// POST /api/plan: generate an editable team plan with Gemini (or the labeled demo fallback).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "bad_request", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { status, body: responseBody } = await generatePlan(body);
  return Response.json(responseBody, { status });
}
