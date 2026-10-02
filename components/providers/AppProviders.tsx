"use client";

import React, { ReactNode } from "react";
import { ProjectProvider } from "@/context/ProjectContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return <ProjectProvider>{children}</ProjectProvider>;
}
