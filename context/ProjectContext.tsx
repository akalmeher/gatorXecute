"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { Project, Task, TaskStatus, AsyncUpdate, AvailabilityBlock } from "@/types";
import { INITIAL_DEMO_PROJECT } from "@/lib/mock-data";

interface ProjectContextValue {
  project: Project;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskOwner: (taskId: string, ownerId: string) => void;
  replaceTasks: (tasks: Task[]) => void;
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
