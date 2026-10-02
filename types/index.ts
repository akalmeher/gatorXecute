export type TaskStatus = "todo" | "in-progress" | "blocked" | "done";

export interface Member {
  id: string;
  name: string;
  role?: string;
  skills: string[];
  wantsToLearn: string[];
  initials: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  ownerId?: string;
  suggestedOwnerId?: string;
  status: TaskStatus;
  dependencies: string[];
  estimatedMinutes?: number;
  dueDate?: string;
  assignmentReason?: string;
}

export interface AvailabilityBlock {
  id: string;
  memberId: string;
  dayOfWeek: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  startTime: string; // e.g. "13:00" (24h)
  endTime: string;   // e.g. "15:00"
  isAvailable: boolean;
}

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  scheduledTime: string; // ISO string or human string for demo
  durationMinutes: number;
  attendeeIds: string[];
  agendaItems: string[];
  summary?: string;
  catchUpNotes?: string;
}

export interface AsyncUpdate {
  id: string;
  projectId: string;
  memberId: string;
  meetingId?: string;
  type: "cant_attend" | "blocker" | "progress";
  content: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  course: string;
  description: string;
  deadline: string;
  members: Member[];
  tasks: Task[];
  availability: AvailabilityBlock[];
  meetings: Meeting[];
  asyncUpdates: AsyncUpdate[];
}
