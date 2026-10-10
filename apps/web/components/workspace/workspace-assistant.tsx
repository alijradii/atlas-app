"use client";

import { StudyAssistantMount } from "../assistant/provider";
import { roleAssistant } from "../assistant/role-context";
import { PageHeading } from "../pearl";
import { PearlChatEmpty } from "../pearl-chat";
import type { Workspace } from "./types";

/** Uses the root assistant and its existing conversation, never a second chat. */
export function WorkspaceAssistant({ data }: { data: Workspace }) {
  const role = roleAssistant(data.roles);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-10">
      <PageHeading title={role.title} description={role.description} />
      <PearlChatEmpty
        title="What would you like a hand with?"
        description="Ask how something works or where to find it. Atlas can point to the right control; you make the decisions."
      />
      <StudyAssistantMount />
      <p className="text-center text-xs text-muted-foreground">
        This assistant explains your workspace. It cannot read private school
        records or submit work for you.
      </p>
    </div>
  );
}
