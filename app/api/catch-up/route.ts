import { handleJsonPost } from "@/features/ai/gemini";
import { generateCatchUp } from "@/features/ai/catch-up";

// POST /api/catch-up: grounded missed-meeting summary, decisions and suggested action items.
export async function POST(request: Request) {
  return handleJsonPost(request, generateCatchUp);
}
