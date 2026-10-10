"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

type Preferences = {
  navigationCollapsed: boolean;
  setNavigationCollapsed: (collapsed: boolean) => void;
};
const WorkspacePreferences = createContext<Preferences | null>(null);

/** Keep presentation choices above route-owned frames, including Study. */
export function WorkspacePreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  return (
    <WorkspacePreferences.Provider
      value={{ navigationCollapsed, setNavigationCollapsed }}
    >
      {children}
    </WorkspacePreferences.Provider>
  );
}

export function useWorkspacePreferences() {
  const context = useContext(WorkspacePreferences);
  if (!context) throw new Error("Workspace preferences provider is missing");
  return context;
}
