"use client";
import { useState } from "react";
import {
  Access,
  Analytics,
  Progress,
  Proposals,
  Settings,
  StaffActivities,
  StudentDetail,
  Students,
} from "./adults";
import { Chat } from "./chat";
import type { AccountId } from "./data";
import { WorkspaceHome } from "./home";
import { Lesson, Lessons, Practice, UploadLesson } from "./learning";
import { WorkspaceShell } from "./shell";
import { Activities, Adviser, Subjects } from "./student";
export function Workspace({
  accountId,
  section,
  item,
  prompt,
}: {
  accountId: AccountId;
  section: string;
  item?: string;
  prompt?: string;
}) {
  const [chatRevision, setChatRevision] = useState(0);
  let content: React.ReactNode;
  switch (section) {
    case "subjects":
      content = <Subjects accountId={accountId} />;
      break;
    case "lessons":
      content = <Lessons accountId={accountId} />;
      break;
    case "lesson":
      content = <Lesson accountId={accountId} id={item || ""} />;
      break;
    case "practice":
      content = <Practice accountId={accountId} />;
      break;
    case "adviser":
      content = <Adviser accountId={accountId} />;
      break;
    case "activities":
      content =
        accountId === "hajj" ? (
          <StaffActivities />
        ) : (
          <Activities accountId={accountId} />
        );
      break;
    case "upload":
      content = <UploadLesson />;
      break;
    case "analytics":
      content = <Analytics />;
      break;
    case "students":
      content = <Students />;
      break;
    case "student":
      content = <StudentDetail id={item || ""} />;
      break;
    case "proposals":
    case "choices":
      content = <Proposals accountId={accountId} />;
      break;
    case "progress":
      content = <Progress />;
      break;
    case "access":
      content = <Access />;
      break;
    case "settings":
      content = <Settings />;
      break;
    case "study":
    case "chat":
      content = (
        <Chat
          key={`${accountId}-${prompt}-${chatRevision}`}
          accountId={accountId}
          study={section === "study"}
          prompt={prompt}
        />
      );
      break;
    default:
      content = <WorkspaceHome accountId={accountId} />;
  }
  return (
    <WorkspaceShell
      accountId={accountId}
      section={section}
      onNewChat={() => setChatRevision((revision) => revision + 1)}
    >
      {content}
    </WorkspaceShell>
  );
}
