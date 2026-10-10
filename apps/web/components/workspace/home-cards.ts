import type { HomeCard, HomeGroup } from "../pearl-home-types";
import type { Lesson, Workspace } from "./types";

/** Cards describe only records returned by the authenticated API. */
export function workspaceHomeCards(
  data: Workspace,
  lessons: Lesson[],
): HomeCard[] {
  const own = data.account_id;
  const studentRole = !data.roles.length || data.roles.includes("student");
  const name = (id: string) =>
    id === own
      ? "You"
      : (data.people.find((person) => person.account_id === id)?.name ??
        "Your school contact");
  const cards: HomeCard[] = data.assignments.map((item) => {
    const student = item.student_id === own;
    const teacher = item.teacher_id === own;
    const needs =
      (student && ["assigned", "returned"].includes(item.state)) ||
      (teacher && item.state === "submitted");
    const group: HomeGroup =
      item.state === "reviewed" ? "done" : needs ? "needs" : "waiting";
    const status = {
      assigned: student ? "Your turn" : "With student",
      returned: student ? "Changes requested" : "With student",
      submitted: teacher ? "Your review" : "With teacher",
      reviewed: "Feedback ready",
    }[item.state];
    return {
      id: `assignment-${item.id}`,
      kind: "practice",
      label: "Assignment",
      title: item.title,
      sub: student
        ? `From ${name(item.teacher_id)}`
        : `For ${name(item.student_id)}`,
      group,
      status,
      action: needs
        ? teacher
          ? "Review work"
          : "Continue assignment"
        : item.state === "reviewed"
          ? "Read feedback"
          : "View assignment",
      href: "/workspace?section=work",
    };
  });
  for (const item of data.proposals) {
    const reviewing =
      (item.state === "pending_advisor" && item.advisor_id === own) ||
      (item.state === "pending_parent" && item.parent_id === own);
    const revising =
      item.state === "revision_requested" && item.student_id === own;
    const closed = ["approved", "declined"].includes(item.state);
    cards.push({
      id: `proposal-${item.id}`,
      kind: "proposal",
      label: "Learning proposal",
      title: item.title,
      sub: {
        pending_advisor: "Waiting for the advisor’s review",
        pending_parent: "Waiting for the parent’s decision",
        revision_requested: "Changes requested by the advisor",
        approved: "Approved by the required reviewers",
        declined: "Read the decision and next steps",
      }[item.state],
      group: closed ? "done" : reviewing || revising ? "needs" : "waiting",
      status: closed
        ? item.state === "approved"
          ? "Approved"
          : "Declined"
        : reviewing
          ? "Your review"
          : revising
            ? "Your revision"
            : "Waiting",
      action: reviewing
        ? "Review proposal"
        : revising
          ? "Revise proposal"
          : "View proposal",
      href: "/workspace?section=plans",
    });
  }
  for (const lesson of lessons) {
    const review = lesson.owned && lesson.state === "review";
    const failed = lesson.owned && lesson.state === "failed";
    cards.push({
      id: `lesson-${lesson.id}`,
      kind: lesson.source_kind === "recording" ? "lesson" : "cards",
      label:
        lesson.source_kind === "recording"
          ? "Session"
          : studentRole
            ? "Study material"
            : "Lesson material",
      title: lesson.title,
      sub: lesson.subject,
      group: review || failed ? "needs" : "continue",
      status: {
        queued: "Queued",
        extracting: "Preparing transcript",
        review: "Review transcript",
        indexing: "Preparing for study",
        ready: studentRole ? "Ready to study" : "Material ready",
        failed: "Preparation failed",
      }[lesson.state],
      action: review
        ? "Review and approve"
        : failed
          ? "Check preparation"
          : lesson.state === "ready"
            ? studentRole
              ? "Study this material"
              : "Review material"
            : "View progress",
      href: `/study?lesson=${encodeURIComponent(lesson.id)}`,
    });
  }
  // Teachers also see their sharing records; students already have the lesson above.
  for (const publication of data.publications) {
    if (
      publication.teacher_id !== own &&
      lessons.some((lesson) => lesson.id === publication.lesson_id)
    )
      continue;
    cards.push({
      id: `publication-${publication.id}`,
      kind: "lesson",
      label: "Shared lesson",
      title: publication.title,
      sub:
        publication.teacher_id === own
          ? `Shared with ${name(publication.student_id)}`
          : `From ${name(publication.teacher_id)}`,
      group: "continue",
      status: "Shared",
      action:
        publication.teacher_id === own
          ? "Manage sharing"
          : "Open study library",
      href:
        publication.teacher_id === own
          ? "/workspace?section=lessons"
          : "/study",
    });
  }
  // Messages have no read receipt. Never invent an unread/reply-needed state.
  const conversations = new Map<string, (typeof data.messages)[number]>();
  for (const message of data.messages) {
    const key = `${message.student_id}:${message.advisor_id}`;
    if (
      !conversations.has(key) ||
      (conversations.get(key)?.created ?? 0) < message.created
    )
      conversations.set(key, message);
  }
  for (const [key, message] of conversations) {
    const peer =
      message.advisor_id === own ? message.student_id : message.advisor_id;
    const peerName = name(peer);
    cards.push({
      id: `conversation-${key}`,
      kind: "advisor",
      label: "Advisor conversation",
      title: peerName,
      initials: peerName
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join(""),
      sub:
        message.sender_id === own
          ? "Your latest message is saved"
          : `Latest message from ${name(message.sender_id)}`,
      group: "continue",
      status: "Conversation",
      action: "Open conversation",
      href: `/workspace?section=messages&student=${encodeURIComponent(message.student_id)}`,
    });
  }
  return cards;
}
