import { handleJsonPost } from "@/features/ai/gemini";
import { generateReplan } from "@/features/plan/replan-service";

// POST /api/replan: propose a small, validated change to keep the plan on schedule.
export async function POST(request: Request) {
  return handleJsonPost(request, generateReplan);
}
