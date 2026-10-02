import type { Task } from "@/types";
import type { PlanProjectInput } from "./plan-types";
import { addDays } from "./plan-validation";

/**
 * Feature Owner: Divij Anand
 * Deterministic demo plan used when Gemini is unavailable. Responses using it
 * are labeled source: "demo" so the UI never presents it as AI output.
 */

const DEMO_TEMPLATE: Omit<Task, "projectId" | "ownerId" | "suggestedOwnerId" | "dueDate" | "assignmentReason">[] = [
  {
    id: "t1",
    title: "Clarify requirements and scope",
    description: "Read the assignment brief together, list deliverables and grading criteria, and agree on what is in scope.",
    status: "todo",
    dependencies: [],
    estimatedMinutes: 60,
  },
  {
    id: "t2",
    title: "Research and design approach",
    description: "Sketch the overall design, pick tools, and split the work into components with clear interfaces.",
    status: "todo",
    dependencies: ["t1"],
    estimatedMinutes: 120,
  },
  {
    id: "t3",
    title: "Build core functionality",
    description: "Implement the main deliverable described in the assignment.",
    status: "todo",
    dependencies: ["t2"],
    estimatedMinutes: 240,
  },
  {
    id: "t4",
    title: "Build supporting features",
    description: "Implement the secondary pieces that complete the deliverable.",
    status: "todo",
    dependencies: ["t2"],
    estimatedMinutes: 180,
  },
  {
    id: "t5",
    title: "Test and integrate",
    description: "Combine everyone's work, test end to end, and fix issues found.",
    status: "todo",
    dependencies: ["t3", "t4"],
    estimatedMinutes: 120,
  },
  {
    id: "t6",
    title: "Prepare submission and presentation",
    description: "Write documentation, prepare slides or a demo, and submit before the deadline.",
    status: "todo",
    dependencies: ["t5"],
    estimatedMinutes: 90,
  },
];

// Fraction of the time between today and the deadline at which each task is due.
const DUE_FRACTIONS = [0.1, 0.25, 0.6, 0.6, 0.8, 0.9];
const FALLBACK_WINDOW_DAYS = 14;

function daysBetween(fromIsoDay: string, toIsoDay: string): number {
  return Math.round((Date.parse(toIsoDay) - Date.parse(fromIsoDay)) / 86_400_000);
}

export function buildDemoPlan(project: PlanProjectInput, today: string, deadlineIsoDay?: string): Task[] {
  const window =
    deadlineIsoDay && daysBetween(today, deadlineIsoDay) > 0
      ? daysBetween(today, deadlineIsoDay)
      : FALLBACK_WINDOW_DAYS;

  return DEMO_TEMPLATE.map((task, index) => {
    const owner = project.members[index % project.members.length];
    return {
      ...task,
      projectId: project.id,
      ownerId: owner.id,
      suggestedOwnerId: owner.id,
      dueDate: addDays(today, Math.max(0, Math.floor(window * DUE_FRACTIONS[index]))),
      assignmentReason: "Demo plan: owners rotated in team order, not chosen by Gemini.",
    };
  });
}
