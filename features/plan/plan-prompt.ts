import type { PlanProjectInput } from "./plan-types";

/**
 * Feature Owner: Divij Anand
 * Prompt and response schema for Gemini plan generation.
 */

export const PLAN_SYSTEM_INSTRUCTION = `You are a project-planning assistant for university student group projects.
You break an assignment into a practical task plan and suggest who could own each task.

Rules:
- Produce 5 to 10 concrete tasks that together complete the assignment. Each task should be a meaningful unit of work, not a trivial step.
- Every suggestedOwnerId must be one of the member ids provided. Spread work fairly so no member is overloaded or left out.
- Base ownership on each member's listed skills AND the things they want to learn. Pair stretch tasks with someone who wants to learn that area, ideally depending on work owned by someone experienced in it.
- assignmentReason: one short, neutral sentence explaining the fit, referring only to listed skills or learning goals. Never judge, rank, or compare members' ability, productivity, or effort.
- Use short ids "t1", "t2", ... in order. dependencies may only reference ids of other tasks in this plan, and a task may only depend on tasks listed before it.
- estimatedMinutes: a realistic whole number between 15 and 2400.
- dueDate: YYYY-MM-DD, on or after today, on or before the project deadline, and never before the due date of any task it depends on. Leave a buffer before the deadline for review and submission.
- These are suggestions the team will review and edit. Do not invent facts about the members beyond what is given.`;

export function buildPlanPrompt(
  project: PlanProjectInput,
  today: string,
  deadlineIsoDay: string | undefined,
  previousIssues: string[] = []
): string {
  const members = project.members.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
    skills: member.skills,
    wantsToLearn: member.wantsToLearn,
  }));

  const lines = [
    `Today: ${today}`,
    `Project deadline: ${deadlineIsoDay ?? project.deadline}`,
    `Course: ${project.course || "(not provided)"}`,
    `Project name: ${project.name}`,
    `Assignment description:\n${project.description}`,
    `Team members (JSON):\n${JSON.stringify(members, null, 2)}`,
  ];

  if (previousIssues.length > 0) {
    lines.push(
      `Your previous plan was rejected by validation. Fix every issue below and return a complete new plan:\n- ${previousIssues.join("\n- ")}`
    );
  }

  lines.push("Return the plan as JSON matching the response schema.");
  return lines.join("\n\n");
}

export const PLAN_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          title: { type: "STRING" },
          description: { type: "STRING" },
          suggestedOwnerId: { type: "STRING" },
          dependencies: { type: "ARRAY", items: { type: "STRING" } },
          estimatedMinutes: { type: "INTEGER" },
          dueDate: { type: "STRING" },
          assignmentReason: { type: "STRING" },
        },
        required: [
          "id",
          "title",
          "description",
          "suggestedOwnerId",
          "dependencies",
          "estimatedMinutes",
          "dueDate",
          "assignmentReason",
        ],
        propertyOrdering: [
          "id",
          "title",
          "description",
          "suggestedOwnerId",
          "dependencies",
          "estimatedMinutes",
          "dueDate",
          "assignmentReason",
        ],
      },
    },
  },
  required: ["tasks"],
};
