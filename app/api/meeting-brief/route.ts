import { handleJsonPost } from "@/features/ai/gemini";
import { generateMeetingBrief } from "@/features/ai/meeting-brief";

// POST /api/meeting-brief: timeboxed meeting agenda grounded in current tasks and updates.
export async function POST(request: Request) {
  return handleJsonPost(request, generateMeetingBrief);
}
