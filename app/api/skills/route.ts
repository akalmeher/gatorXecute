import { handleJsonPost } from "@/features/ai/gemini";
import { readSkills } from "@/features/ai/skills";

// POST /api/skills: "what can you do?" in the student's words → skill tags for their profile.
export async function POST(request: Request) {
  return handleJsonPost(request, readSkills);
}
