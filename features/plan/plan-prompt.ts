import type { PlanAssignment, PlanProjectInput } from "./plan-types";

/**
 * Feature Owner: Divij Anand
 * Prompt and response schema for Gemini plan generation.
 */

export const PLAN_SYSTEM_INSTRUCTION = `You are a project-planning assistant for university student group projects in any major.
You read the assignment, say what you found, break it into a practical plan, and suggest who could take each step.

Understanding (fill "understanding" first):
- If an assignment file or pasted assignment is provided, it is the main source of truth for what must be delivered. Otherwise use the project description.
- kind: presentation, paper, creative (film, music, art, design), study, lab, software, or other.
- summary: one plain sentence about what the team is making.
- deliverables: the things that must be handed in or presented, only as stated or clearly implied. Do not invent requirements. Empty if unclear.
- milestones: checkpoints the assignment names (drafts, check-ins, rehearsals), with date YYYY-MM-DD only if stated, else "".
- finalDeadline: YYYY-MM-DD if the assignment states a due date (resolve the year from today if missing), else "".

Plan rules:
- Shape the steps to the kind of work, using its natural stages: a film goes idea, pre-production, shoot, edit, submit; a paper goes question, research, outline, draft, review, submit; a presentation goes research, slides, rehearse, present; a study group works through topics before the exam; software goes design, build, integrate, test, demo.
- Cover every deliverable you found.
- Produce 5 to 10 concrete steps that together complete the assignment. Each step should be a meaningful unit of work, not a trivial action.
- Titles are short, plain, and action-first ("Research historical context", "Draft opening slides"). No jargon such as ticket, epic, sprint, backlog, or dependency.
- Every suggestedOwnerId must be one of the member ids provided. Spread work fairly so no member is overloaded or left out.
- Choose owners from each member's listed skills AND what they want to learn. Never infer ability from major, role title, or background.
- practices: if the step lets its owner practice something from THEIR OWN wantsToLearn list, copy that exact item here; otherwise use an empty string. Give every member who has learning goals at least one step that practices one of them, and pair it with work owned by someone experienced in that area.
- assignmentReason: one short, neutral sentence explaining the fit, referring only to listed skills or learning goals. Never judge, rank, or compare members' ability, productivity, or effort.
- Use short ids "t1", "t2", ... in order. dependencies may only reference ids of other steps in this plan, and a step may only depend on steps listed before it.
- estimatedMinutes: a realistic whole number between 15 and 2400.
- dueDate: YYYY-MM-DD, on or after today, on or before the project deadline (and on or before finalDeadline if that is earlier), and never before the due date of any step it depends on. Leave a buffer before the deadline for review and submission.
- These are suggestions the team will review and edit. Do not invent facts about the members beyond what is given.`;

export function buildPlanPrompt(
  project: PlanProjectInput,
  today: string,
  deadlineIsoDay: string | undefined,
  previousIssues: string[] = [],
  assignment?: PlanAssignment
): string {
  const members = project.members.map((member) => ({
    id: member.id,
    name: member.name,
    skills: member.skills,
    wantsToLearn: member.wantsToLearn,
  }));

  const lines = [
    `Today: ${today}`,
    `Project deadline: ${deadlineIsoDay ?? project.deadline}`,
    `Course: ${project.course || "(not provided)"}`,
    `Project name: ${project.name}`,
    `Project description:\n${project.description}`,
    `Team members (JSON):\n${JSON.stringify(members, null, 2)}`,
  ];
  if (assignment?.file) lines.push(`The assignment is attached as a file: ${assignment.file.name}`);
  if (assignment?.text) lines.push(`Assignment (pasted by the student):\n${assignment.text}`);
  if (!assignment) lines.push("No assignment was attached; work from the project description.");

  if (previousIssues.length > 0) {
    lines.push(
      `Your previous plan was rejected by validation. Fix every issue below and return a complete new plan:\n- ${previousIssues.join("\n- ")}`
    );
  }

  lines.push("Return the plan as JSON matching the response schema.");
  return lines.join("\n\n");
}

const TASK_FIELDS = [
  "id",
  "title",
  "description",
  "suggestedOwnerId",
  "practices",
  "dependencies",
  "estimatedMinutes",
  "dueDate",
  "assignmentReason",
];

const UNDERSTANDING_FIELDS = ["kind", "summary", "deliverables", "milestones", "finalDeadline"];

export const PLAN_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    understanding: {
      type: "OBJECT",
      properties: {
        kind: { type: "STRING", enum: ["presentation", "paper", "creative", "study", "lab", "software", "other"] },
        summary: { type: "STRING" },
        deliverables: { type: "ARRAY", items: { type: "STRING" } },
        milestones: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { title: { type: "STRING" }, date: { type: "STRING" } },
            required: ["title", "date"],
          },
        },
        finalDeadline: { type: "STRING" },
      },
      required: UNDERSTANDING_FIELDS,
      propertyOrdering: UNDERSTANDING_FIELDS,
    },
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          title: { type: "STRING" },
          description: { type: "STRING" },
          suggestedOwnerId: { type: "STRING" },
          practices: { type: "STRING" },
          dependencies: { type: "ARRAY", items: { type: "STRING" } },
          estimatedMinutes: { type: "INTEGER" },
          dueDate: { type: "STRING" },
          assignmentReason: { type: "STRING" },
        },
        required: TASK_FIELDS,
        propertyOrdering: TASK_FIELDS,
      },
    },
  },
  required: ["understanding", "tasks"],
  propertyOrdering: ["understanding", "tasks"],
};
