import { handleJsonPost } from "@/features/ai/gemini";
import { interpretProgressUpdate } from "@/features/plan/update-service";

// POST /api/progress-update: "finished the research btw" -> proposed status changes to confirm.
export async function POST(request: Request) {
  return handleJsonPost(request, interpretProgressUpdate);
}
