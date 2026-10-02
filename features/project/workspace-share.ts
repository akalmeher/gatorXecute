import type { Project } from "@/types";
import { fromBase64Url, toBase64Url } from "@/features/meet/meet-link";

/**
 * Feature Owner: Divij Anand
 * Workspace Sharing & Multi-Device Sync:
 * Allows one teammate to export the entire workspace (project details, members, tasks,
 * availability) into a URL fragment. When opened on another laptop, it hydrates the
 * exact workspace so all teammates have master control on their own machines.
 */

export function encodeWorkspace(project: Project): string {
  try {
    const payload = {
      v: 1,
      id: project.id,
      name: project.name,
      course: project.course,
      description: project.description,
      deadline: project.deadline,
      members: project.members,
      tasks: project.tasks,
      meetings: project.meetings,
      availability: project.availability,
    };
    return toBase64Url(JSON.stringify(payload));
  } catch {
    return "";
  }
}

export function decodeWorkspace(rawHash: string): Project | null {
  try {
    const cleaned = rawHash.replace(/^#/, "").replace(/^workspace=/, "");
    if (!cleaned) return null;
    const data = JSON.parse(fromBase64Url(cleaned)) as Record<string, unknown>;
    if (!data || data.v !== 1 || typeof data.name !== "string") return null;

    return {
      id: typeof data.id === "string" ? data.id : `proj-${Date.now()}`,
      name: data.name,
      course: typeof data.course === "string" ? data.course : "",
      description: typeof data.description === "string" ? data.description : "",
      deadline: typeof data.deadline === "string" ? data.deadline : "",
      members: Array.isArray(data.members) ? data.members : [],
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      meetings: Array.isArray(data.meetings) ? data.meetings : [],
      availability: Array.isArray(data.availability) ? data.availability : [],
      asyncUpdates: [],
    };
  } catch {
    return null;
  }
}
