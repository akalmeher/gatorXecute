import { handleJsonPost } from "@/features/ai/gemini";
import { generatePlan } from "@/features/plan/plan-service";

// POST /api/plan: generate an editable team plan with Gemini (or the labeled demo fallback).
export async function POST(request: Request) {
  return handleJsonPost(request, generatePlan);
}
