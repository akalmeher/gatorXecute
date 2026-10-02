import { handleJsonPost } from "@/features/ai/gemini";
import { shareCheck } from "@/features/ai/share-check";

// POST /api/share-check: is this personal, what should teammates see, and should we offer support?
export async function POST(request: Request) {
  return handleJsonPost(request, shareCheck);
}
