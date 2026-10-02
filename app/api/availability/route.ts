import { handleJsonPost } from "@/features/ai/gemini";
import { generateAvailability } from "@/features/ai/availability";

// POST /api/availability: "I'm free after 4 except Wednesdays" -> availability blocks.
export async function POST(request: Request) {
  return handleJsonPost(request, generateAvailability);
}
