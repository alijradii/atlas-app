"use client";

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@school2036/ui";
import { Menu } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import "./preview/workspace.css";

export const pearlNavLinkClass =
  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-surface/60 aria-[current=page]:bg-surface aria-[current=page]:text-foreground aria-[current=page]:shadow-pearl";

/** One Pearl workspace frame for example data and authenticated workflows. */
export function PearlFrame({
  section,
  navigation,
  headerActions,
  composer,
  overlays,
  children,
}: {
  section: string;
  navigation: (closeMenu: () => void) => ReactNode;
  headerActions?: ReactNode;
  composer?: ReactNode;
  overlays?: ReactNode;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const nav = navigation(() => setMenu(false));

  return (
    <div className="atlas-workspace min-h-screen" data-section={section}>
      <aside
        className="pearl-panel fixed inset-y-0 left-0 z-20 hidden w-64 flex-col overflow-y-auto border-r p-3 lg:flex"
        aria-label="Main navigation"
      >
        {nav}
      </aside>
      <div className="lg:ml-64">
        <header className="flex min-h-20 flex-wrap items-center gap-3 px-5 py-4 sm:px-8">
          <Sheet open={menu} onOpenChange={setMenu}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="pearl-panel flex w-72 flex-col px-3"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Workspace navigation</SheetTitle>
                <SheetDescription>
                  Explore the Atlas role pages.
                </SheetDescription>
              </SheetHeader>
              {nav}
            </SheetContent>
          </Sheet>
          <span className="mr-auto" />
          {headerActions}
          <ThemeToggle />
        </header>
        <main id="main-content" className="atlas-workspace-main">
          {children}
        </main>
        {composer && <div className="atlas-composer-wrap">{composer}</div>}
      </div>
      {overlays}
    </div>
  );
}
