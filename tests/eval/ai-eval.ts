/**
 * Model evaluation: runs the real AI services (prompts, schemas, validators)
 * against fixed scenarios on each model and reports validity, correctness and
 * latency. Used to decide which tasks run on Gemma 4 vs Gemini.
 *
 * Needs GEMINI_API_KEY in the environment (makes real API calls).
 *
 *   node --env-file=.env.local --no-warnings \
 *     --import ./tests/setup/register.mjs tests/eval/ai-eval.ts [runs]
 */
import { readFileSync } from "node:fs";
import { coordinate } from "@/features/ai/coordinate";
import { generateAvailability } from "@/features/ai/availability";
import { generateCatchUp } from "@/features/ai/catch-up";
import { generateMeetingBrief } from "@/features/ai/meeting-brief";
import { interpretProgressUpdate } from "@/features/plan/update-service";
import { generateReplan } from "@/features/plan/replan-service";
import { generatePlan } from "@/features/plan/plan-service";

// lib/mock-data.ts imports its types as values, which Node's type stripping
// can't elide, so load the seed data with its type annotations removed.
const seedSource = readFileSync("lib/mock-data.ts", "utf8")
  .replace(/^import .*$/m, "")
  .replace(/export const (\w+): [^=]+=/g, "export const $1 =");
const seed = await import(`data:text/javascript;base64,${Buffer.from(seedSource).toString("base64")}`);
const { SEEDED_ASYNC_UPDATES, SEEDED_MEETINGS, SEEDED_MEMBERS, SEEDED_TASKS } = seed as typeof import("@/lib/mock-data");

process.env.AI_DISABLE_CACHE = "1";
const MODELS = ["gemma-4-26b-a4b-it", "gemma-4-31b-it", "gemini-flash-latest"];
const RUNS = Number(process.argv[2] ?? 2);

type Result = { status: number; body: unknown };
type Check = (body: Record<string, unknown>) => boolean;
interface Scenario {
  route: string;
  name: string;
  run: () => Promise<Result>;
  correct: Check;
}

const members = SEEDED_MEMBERS.map(({ id, name, role }) => ({ id, name, role }));
const planMembers = SEEDED_MEMBERS.map(({ id, name, skills, wantsToLearn }) => ({ id, name, skills, wantsToLearn }));
const project = { id: "proj-csc-app", name: "CSC Group Web Application Project", deadline: "October 16, 2026", members: planMembers };
const r = (b: Record<string, unknown>) => b.result as Record<string, unknown>;
const intent = (text: string, expected: string): Scenario => ({
  route: "coordinate",
  name: `"${text.slice(0, 32)}…" → ${expected}`,
  run: () => coordinate({ text, knownPeople: members.map((m) => m.name) }),
  correct: (b) => r(b).intent === expected,
});

const SCENARIOS: Scenario[] = [
  intent("find an hour for me and Maya this week for our cinema presentation", "meet"),
  intent("CSC 648 group web app due October 16", "project"),
  intent("finished the backend, now waiting on Ammar's UI", "update"),
  intent("we're behind and the presentation is Friday", "help"),
  {
    route: "availability",
    name: "free after 4 except Wed, no Fri evenings",
    run: () => generateAvailability({ memberId: "me", text: "I'm free after 4 except Wednesdays, and don't schedule me Friday evenings" }),
    correct: (b) => {
      // Days follow Oscar's grid (now Mon–Sun), so weekends appear as "not free".
      const lines = r(b).readBack as string[];
      return lines.includes("Mon, Tue, Thu: 4 PM–9 PM") && lines.includes("Fri: 4 PM–5 PM") && lines.some((l) => l.startsWith("Wed") && l.endsWith("not free"));
    },
  },
  {
    route: "availability",
    name: "class schedule (R = Thursday)",
    run: () => generateAvailability({ memberId: "me", text: "BIO 230 MWF 10:00-10:50\nCINE 211 TR 2:00-3:15 PM" }),
    correct: (b) => (r(b).readBack as string[]).some((l) => l.includes("Tue, Thu") && l.includes("3:30 PM–9 PM")),
  },
  {
    route: "progress-update",
    name: "finished the API routes → done",
    run: () => interpretProgressUpdate({ project: { id: project.id, name: project.name, members }, tasks: SEEDED_TASKS, text: "finished the API routes btw", authorId: "mem-divij" }),
    correct: (b) => JSON.stringify((b.interpretation as { changes: unknown[] }).changes.map((c) => [(c as { taskId: string }).taskId, (c as { status: string }).status])) === JSON.stringify([["task-3", "done"]]),
  },
  {
    route: "progress-update",
    name: "almost done → in progress, not done",
    run: () => interpretProgressUpdate({ project: { id: project.id, name: project.name, members }, tasks: SEEDED_TASKS, text: "almost done with the catch-up screens", authorId: "mem-shreya" }),
    correct: (b) => (b.interpretation as { changes: { taskId: string; status: string }[] }).changes.every((c) => c.status !== "done") &&
      (b.interpretation as { changes: { taskId: string; status: string }[] }).changes.some((c) => c.taskId === "task-5" && c.status === "in-progress"),
  },
  {
    route: "catch-up",
    name: "with notes: 2 real decisions",
    run: () => generateCatchUp({
      meeting: SEEDED_MEETINGS[0], asyncUpdates: SEEDED_ASYNC_UPDATES, tasks: SEEDED_TASKS, members, absentMemberId: "mem-shreya",
      notes: "Ammar confirmed the shared Task type is final. Team agreed API routes return { ok, error } envelopes. Divij will finish the session API by Tuesday. Open question: who owns the demo deck?",
    }),
    correct: (b) => {
      const c = b.catchUp as { decided: string[]; openQuestions: string[] };
      return c.decided.length === 2 && c.openQuestions.some((q) => /deck/i.test(q));
    },
  },
  {
    route: "meeting-brief",
    name: "seed: something worth discussing",
    run: () => generateMeetingBrief({ project: { name: project.name, deadline: project.deadline }, meeting: { title: "Sprint 2 Sync", durationMinutes: 30, attendeeIds: [] }, tasks: SEEDED_TASKS, asyncUpdates: SEEDED_ASYNC_UPDATES, members }),
    correct: (b) => (b.brief as { meetingNeeded: boolean }).meetingNeeded === true,
  },
  {
    route: "replan",
    name: "Oscar has the flu → reassign",
    run: () => generateReplan({
      project, tasks: SEEDED_TASKS.map((t) => (t.id === "task-4" ? { ...t, status: "blocked" as const } : t.id === "task-6" ? { ...t, ownerId: "mem-divij" } : t)),
      notes: [{ from: "Oscar Garcia", text: "I'm stuck, I have the flu and will be out until Thursday" }],
    }),
    correct: (b) => (b.suggestion as { changes: { taskId: string }[] }).changes.some((c) => c.taskId === "task-4"),
  },
  {
    route: "plan",
    name: "assignment PDF → deadline Oct 13",
    run: () => generatePlan({
      project: { ...project, course: "CINE 211", description: "Group presentation.", members: planMembers.slice(0, 3) },
      assignment: { file: { name: "CINE211.pdf", mimeType: "application/pdf", data: readFileSync("tests/eval/fixtures/CINE211_Group_Presentation.pdf").toString("base64") } },
    }),
    correct: (b) => (b.understanding as { finalDeadline?: string })?.finalDeadline === "2026-10-13" && (b.tasks as { dueDate: string }[]).every((t) => t.dueDate <= "2026-10-13"),
  },
];

interface Tally { ok: number; correct: number; ms: number[] }

async function evaluate(model: string) {
  process.env.AI_FORCE_MODEL = model;
  const tallies = new Map<string, Tally>();
  for (const scenario of SCENARIOS) {
    for (let i = 0; i < RUNS; i++) {
      const started = Date.now();
      let ok = false;
      let correct = false;
      try {
        const { body } = await scenario.run();
        const b = body as Record<string, unknown>;
        ok = b.ok === true;
        correct = ok && scenario.correct(b);
      } catch {
        // counted as a failure
      }
      const t = tallies.get(scenario.route) ?? { ok: 0, correct: 0, ms: [] };
      t.ok += ok ? 1 : 0;
      t.correct += correct ? 1 : 0;
      t.ms.push(Date.now() - started);
      tallies.set(scenario.route, t);
      console.error(`${model.padEnd(20)} ${scenario.route.padEnd(15)} ${ok ? (correct ? "✓" : "~") : "✗"} ${Date.now() - started}ms  ${scenario.name}`);
    }
  }
  return tallies;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
// Models are evaluated one after another (AI_FORCE_MODEL is process-wide).
const results = new Map<string, Map<string, Tally>>();
for (const model of MODELS) results.set(model, await evaluate(model));

const routes = [...new Set(SCENARIOS.map((s) => s.route))];
console.log(`\n| Route | ${MODELS.join(" | ")} |`);
console.log(`|---|${MODELS.map(() => "---").join("|")}|`);
for (const route of routes) {
  const cells = MODELS.map((m) => {
    const t = results.get(m)!.get(route)!;
    return `${t.correct}/${t.ms.length} correct · ${(median(t.ms) / 1000).toFixed(1)}s`;
  });
  console.log(`| ${route} | ${cells.join(" | ")} |`);
}
console.log(`\n${RUNS} run(s) per scenario. "correct" = valid output that also matches the expected answer.`);
