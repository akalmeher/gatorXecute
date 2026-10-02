import { handleJsonPost } from "@/features/ai/gemini";
import { coordinate } from "@/features/ai/coordinate";

// POST /api/coordinate: "What needs coordinating?" -> which workflow to open.
export async function POST(request: Request) {
  return handleJsonPost(request, coordinate);
}
