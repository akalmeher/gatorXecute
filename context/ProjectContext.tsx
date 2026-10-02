"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Project, Task, TaskStatus, AsyncUpdate, AvailabilityBlock, Member } from "@/types";
import { INITIAL_DEMO_PROJECT } from "@/lib/mock-data";
import { decodeWorkspace } from "@/features/project/workspace-share";

interface ProjectContextValue {
  project: Project;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskOwner: (taskId: string, ownerId: string) => void;
  replaceTasks: (tasks: Task[]) => void;
  addTask: (task: Omit<Task, "id" | "projectId"> & { id?: string; projectId?: string }) => void;
  deleteTask: (taskId: string) => void;
  updateProjectDetails: (details: Partial<Pick<Project, "name" | "course" | "deadline" | "description">>) => void;
  /** Use a formed team (Divij: features/team). Work owned by people who left becomes unowned. */
  replaceMembers: (members: Member[]) => void;
  /** A formed team starts its own project: fresh steps, meetings and updates; the deadline is kept until the plan sets one. */
  startProject: (details: { name: string; course?: string; members: Member[] }) => void;
  loadProject: (project: Project) => void;
  addMember: (member: Member) => void;
  updateMemberAvailability: (memberId: string, blocks: AvailabilityBlock[]) => void;
  addAsyncUpdate: (update: Omit<AsyncUpdate, "id" | "createdAt">) => void;
  getMemberById: (id?: string) => Project["members"][number] | undefined;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project>(INITIAL_DEMO_PROJECT);

  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId ? { ...task, status } : task
      ),
    }));
  };

  const updateTaskOwner = (taskId: string, ownerId: string) => {
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId ? { ...task, ownerId } : task
      ),
    }));
  };

  const replaceTasks = (newTasks: Task[]) => {
    setProject((prev) => ({
      ...prev,
      tasks: newTasks,
    }));
  };

  const addTask = (newTask: Omit<Task, "id" | "projectId"> & { id?: string; projectId?: string }) => {
    const task: Task = {
      ...newTask,
      id: newTask.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: newTask.projectId || project.id,
      dependencies: newTask.dependencies || [],
      status: newTask.status || "todo",
      estimatedMinutes: newTask.estimatedMinutes || 60,
    };
    setProject((prev) => ({
      ...prev,
      tasks: [...prev.tasks, task],
    }));
  };

  const deleteTask = (taskId: string) => {
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  };

  const updateProjectDetails = (details: Partial<Pick<Project, "name" | "course" | "deadline" | "description">>) => {
    setProject((prev) => ({
      ...prev,
      ...details,
    }));
  };

  const replaceMembers = (members: Member[]) => {
    setProject((prev) => {
      const ids = new Set(members.map((m) => m.id));
      return {
        ...prev,
        members,
        tasks: prev.tasks.map((task) =>
          task.ownerId && !ids.has(task.ownerId) ? { ...task, ownerId: undefined } : task
        ),
        availability: prev.availability.filter((block) => ids.has(block.memberId)),
        meetings: prev.meetings.map((meeting) => ({
          ...meeting,
          attendeeIds: meeting.attendeeIds.filter((id) => ids.has(id)),
        })),
      };
    });
  };

  const startProject = ({ name, course, members }: { name: string; course?: string; members: Member[] }) => {
    setProject((prev) => ({
      ...prev,
      id: `proj-${Date.now()}`,
      name,
      course: course ?? "",
      description: course ? `${name} for ${course}` : name,
      members,
      tasks: [],
      availability: [],
      meetings: [],
      asyncUpdates: [],
    }));
  };

  // Support multi-device workspace sync via #workspace=... in URL
  useEffect(() => {
    const handleSync = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (hash.includes("workspace=")) {
        const decoded = decodeWorkspace(hash);
        if (decoded) {
          setProject(decoded);
        }
      }
    };
    handleSync();
    window.addEventListener("hashchange", handleSync);
    return () => window.removeEventListener("hashchange", handleSync);
  }, []);

  const loadProject = (newProject: Project) => {
    setProject(newProject);
  };

  const addMember = (newMember: Member) => {
    setProject((prev) => {
      if (prev.members.some((m) => m.id === newMember.id)) {
        return {
          ...prev,
          members: prev.members.map((m) => (m.id === newMember.id ? newMember : m)),
        };
      }
      return {
        ...prev,
        members: [...prev.members, newMember],
      };
    });
  };

  const addAsyncUpdate = (update: Omit<AsyncUpdate, "id" | "createdAt">) => {
    const newUpdate: AsyncUpdate = {
      ...update,
      id: `upd-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setProject((prev) => ({
      ...prev,
      asyncUpdates: [newUpdate, ...prev.asyncUpdates],
    }));
  };

  const updateMemberAvailability = (
    memberId: string,
    blocks: AvailabilityBlock[]
  ) => {
    setProject((prev) => ({
      ...prev,

      availability: [
        ...prev.availability.filter(
          (block) => block.memberId !== memberId
        ),

        ...blocks,
      ],
    }));
  };

  const getMemberById = (id?: string) => {
    if (!id) return undefined;
    return project.members.find((m) => m.id === id);
  };

  return (
    <ProjectContext.Provider
      value={{
        project,
        updateTaskStatus,
        updateTaskOwner,
        replaceTasks,
        addTask,
        deleteTask,
        updateProjectDetails,
        replaceMembers,
        startProject,
        loadProject,
        addMember,
        addAsyncUpdate,
        updateMemberAvailability,
        getMemberById,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
