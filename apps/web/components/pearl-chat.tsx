"use client";

import type { ReactNode } from "react";
import { PearlObject } from "./pearl";
import { CopyText, RichMessage } from "./preview/rich-message";

/** The established chat presentation, shared by examples and authenticated study. */
export function PearlChatLayout({
  children,
  tools,
  className = "",
  toolsHidden = false,
}: {
  children: ReactNode;
  tools: ReactNode;
  className?: string;
  toolsHidden?: boolean;
}) {
  return (
    <div className={`atlas-chat-layout ${className}`}>
      <div className="atlas-chat-conversation">{children}</div>
      <aside
        id="study-tools"
        data-collapsed={toolsHidden}
        aria-hidden={toolsHidden}
        inert={toolsHidden}
        className="atlas-chat-sidebar space-y-6"
        aria-label="Study tools"
      >
        {tools}
      </aside>
    </div>
  );
}

export function PearlChatEmpty({
  title = "What would you like to work through?",
  description = "Try a concept from your lesson. We’ll take it one step at a time.",
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="py-10 text-center">
      <PearlObject className="w-20" />
      <h2 className="mt-5 text-2xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  );
}

export function PearlChatMessage({
  role,
  text,
  children,
  className = "",
}: {
  role: "user" | "assistant";
  text: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`atlas-message atlas-message-${role} ${className}`}>
      <div className="atlas-message-label">
        <span>{role === "user" ? "You" : "Atlas"}</span>
        {role === "assistant" && <CopyText text={text} label="Copy response" />}
      </div>
      {role === "user" ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
      ) : (
        <RichMessage text={text} />
      )}
      {children}
    </div>
  );
}
