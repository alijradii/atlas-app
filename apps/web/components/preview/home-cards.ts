import { type AccountId, duration, fixture } from "./data";
import type { PreviewState, Proposal } from "./state";
import type { TaskKind } from "./task-art";

export type HomeGroup = "needs" | "continue" | "waiting" | "done";

export type HomeCard = {
  group: HomeGroup;
  status: string;
  id: string;
  kind: TaskKind;
  label: string;
  title: string;
  sub: string;
  action: string;
  href: string;
  initials?: string;
  progress?: number;
  locked?: boolean;
};
const labels: Record<TaskKind, string> = {
  cards: "Study cards",
  practice: "Practice",
  lesson: "Lesson",
  advisor: "Human advisor",
  proposal: "Subject proposal",
  evidence: "Class evidence",
  upload: "Lesson upload",
  people: "Students",
  activity: "Activity review",
  access: "Access",
  settings: "Settings",
  followup: "Follow-ups",
  interests: "Interests",
};
export function proposalSummary(status?: Proposal["status"]) {
  switch (status) {
    case "adviser":
      return "Waiting for Dr. Nassar’s review";
    case "parent":
      return "Waiting for Karim’s review";
    case "school":
      return "Waiting for the school to confirm";
    case "changes":
      return "Changes requested · review the note";
    case "agreed":
      return "Confirmed by the school";
    default:
      return "Explore whether this subject fits your plans";
  }
}
function buildHomeCards(accountId: AccountId, state: PreviewState): HomeCard[] {
  const base = `/preview/${accountId}/`;
  const card = (
    id: string,
    kind: TaskKind,
    title: string,
    sub: string,
    action: string,
    href: string,
    extra: Partial<HomeCard> = {},
  ): HomeCard => ({
    group: "continue",
    status: "Available",
    id,
    kind,
    label: labels[kind],
    title,
    sub,
    action,
    href: base + href,
    ...extra,
  });
  const cs = state.proposals.find((p) => p.subject === "cs");
  const proposal = (href: string) =>
    card(
      "proposal-cs",
      "proposal",
      cs || accountId === "lina" ? "Computer Science" : "Subject proposals",
      cs ? proposalSummary(cs.status) : "No Computer Science proposal yet",
      !cs
        ? accountId === "lina"
          ? "Explore subject"
          : "Browse proposals"
        : (accountId === "nassar" && cs?.status === "adviser") ||
            (accountId === "karim" && cs?.status === "parent") ||
            (accountId === "hajj" && cs?.status === "school")
          ? "Review proposal"
          : "View proposal",
      href,
    );
  if (accountId === "lina" || accountId === "sami") {
    const fresh = accountId === "sami";
    const batch = fresh ? state.samiBatch : state.batch;
    const answers = fresh ? state.samiAnswers : state.answers;
    const stuck = fresh ? state.samiStuck : state.stuck;
    const ready = answers.filter((a, i) => a.trim() || stuck[i]).length;
    const practice = card(
      "practice",
      "practice",
      batch === "feedback" ? "Your feedback is ready" : "Newton’s second law",
      batch === "active"
        ? `${ready} of 5 ready · finish on your own`
        : batch === "feedback"
          ? "See what went well and what to revisit"
          : "Five problems to try on your own",
      batch === "active"
        ? "Continue practice"
        : batch === "feedback"
          ? "Review feedback"
          : "Start practice",
      "practice",
      {
        progress: batch === "feedback" ? 1 : batch === "active" ? ready / 5 : 0,
      },
    );
    if (fresh)
      return [
        card(
          "first-lesson",
          "lesson",
          "Your first lesson",
          "Recordings from your teachers",
          "Browse lessons",
          "lessons",
        ),
        practice,
        card(
          "interests",
          "interests",
          "What interests you?",
          state.samiInterests.length
            ? state.samiInterests.join(" · ")
            : "Explore activities and tell us what you enjoy",
          "Explore interests",
          "activities",
        ),
        card(
          "advisor",
          "advisor",
          "Meet your advisor",
          "The school is finding your match",
          "View matching status",
          "adviser",
        ),
      ];
    const reply = state.questions.find((q) => q.reply);
    const lesson = fixture.lessons.find((item) => item.id === "L1");
    if (!lesson) throw new Error("Missing home lesson fixture L1");
    const position = fixture.students.lina.watch.L1;
    return [
      practice,
      card(
        "lesson-L1",
        "lesson",
        "Newton’s second law",
        `Stopped at ${duration(position)} of ${duration(lesson.dur)}`,
        "Resume lesson",
        "lesson/L1",
        { progress: position / lesson.dur },
      ),
      card(
        "advisor",
        "advisor",
        "Dr. Maya Nassar",
        reply
          ? "Replied to your question"
          : "Your human advisor for subject choices",
        reply ? "Read reply" : "Ask your advisor",
        "adviser",
        { initials: "MN" },
      ),
      proposal("subjects"),
    ];
  }
  if (accountId === "daher") {
    return [
      card(
        "class-evidence",
        "evidence",
        "Mass and weight",
        "Inspect example answers and teaching follow-ups",
        "Inspect evidence",
        "analytics",
      ),
      card(
        "lesson-L1",
        "lesson",
        "Newton’s second law",
        "Review the recording outline and chapters",
        "Open lesson",
        "lesson/L1",
      ),
      card(
        "upload",
        "upload",
        "Share a lesson",
        "Choose a recording and who it’s for",
        "Upload a session",
        "upload",
      ),
      card(
        "class-progress",
        "evidence",
        "Independent and assisted work",
        "Compare the evidence before drawing conclusions",
        "View class progress",
        "analytics",
      ),
    ];
  }
  if (accountId === "nassar")
    return [
      proposal("proposals"),
      card(
        "student-question",
        "people",
        "Lina Haddad",
        state.questions.some((q) => !q.reply)
          ? "A question is waiting for your reply"
          : "Review your recent guidance together",
        "Open Lina’s workspace",
        "student/lina",
      ),
      card(
        "students",
        "people",
        "Your students",
        `${fixture.caseload.length} students with individual plans`,
        "View students",
        "students",
      ),
      card(
        "followups",
        "followup",
        "Your follow-ups",
        "Review the next steps agreed with your students",
        "Review next steps",
        "students",
      ),
    ];
  if (accountId === "karim")
    return [
      proposal("choices"),
      card(
        "guidance",
        "advisor",
        "Dr. Maya Nassar",
        "Human guidance shared with your family",
        "Read guidance",
        "home#guidance",
        { initials: "MN" },
      ),
      card(
        "interests",
        "interests",
        "Lina’s interests",
        state.interests.join(" · "),
        "View interests",
        "home#interests",
      ),
      {
        ...card(
          "progress",
          "evidence",
          "Lina’s progress",
          "Independent and assisted work, side by side",
          "View progress",
          "progress",
        ),
        label: "Learning progress",
      },
    ];
  const pending = [
    ...fixture.activities,
    ...state.activityDrafts.map((draft, i) => ({
      ...draft,
      id: `draft-${i}`,
      status: "proposed",
    })),
  ].filter(
    (a) => (state.activityReviews[a.id] || a.status) === "proposed",
  ).length;
  return [
    card(
      "activities",
      "activity",
      "Student activities",
      pending
        ? `${pending} proposals waiting for your review`
        : "All activity proposals reviewed",
      "Review activities",
      "activities",
    ),
    proposal("proposals"),
    card(
      "access",
      "access",
      "Access & availability",
      "Who can access each workspace",
      "Review access",
      "access",
    ),
    card(
      "settings",
      "settings",
      "School settings",
      "Manage the preview’s school preferences",
      "Open settings",
      "settings",
    ),
  ];
}

/** Priority is derived from the current actor and workflow, never card position. */
export function homeCards(
  accountId: AccountId,
  state: PreviewState,
): HomeCard[] {
  const cs = state.proposals.find((proposal) => proposal.subject === "cs");
  return buildHomeCards(accountId, state).map((card): HomeCard => {
    if (card.id === "practice") {
      const batch = accountId === "sami" ? state.samiBatch : state.batch;
      return {
        ...card,
        group: batch === "feedback" ? "done" : "needs",
        status:
          batch === "feedback"
            ? "Submitted"
            : batch === "active"
              ? "Your turn"
              : "Ready to start",
      };
    }
    if (card.id === "proposal-cs") {
      const mine =
        (accountId === "lina" && cs?.status === "changes") ||
        (accountId === "nassar" && cs?.status === "adviser") ||
        (accountId === "karim" && cs?.status === "parent") ||
        (accountId === "hajj" && cs?.status === "school");
      return {
        ...card,
        group: !cs
          ? "continue"
          : cs.status === "agreed"
            ? "done"
            : mine
              ? "needs"
              : "waiting",
        status: !cs
          ? "Not proposed"
          : cs.status === "agreed"
            ? "Confirmed"
            : mine
              ? "Your review"
              : "Waiting",
      };
    }
    if (card.id === "advisor") {
      const matched = accountId !== "sami";
      const reply =
        matched && state.questions.some((question) => question.reply);
      return {
        ...card,
        group: !matched ? "waiting" : reply ? "needs" : "continue",
        status: !matched
          ? "Being matched"
          : reply
            ? "Reply available"
            : "Human guidance",
      };
    }
    if (card.id === "student-question") {
      const unanswered = state.questions.some((question) => !question.reply);
      return {
        ...card,
        group: unanswered ? "needs" : "continue",
        status: unanswered ? "Needs a reply" : "Guidance up to date",
      };
    }
    if (card.id === "activities") {
      const pending = [
        ...fixture.activities,
        ...state.activityDrafts.map((draft, i) => ({
          ...draft,
          id: `draft-${i}`,
          status: "proposed",
        })),
      ].some(
        (activity) =>
          (state.activityReviews[activity.id] || activity.status) ===
          "proposed",
      );
      return {
        ...card,
        group: pending ? "needs" : "done",
        status: pending ? "Your review" : "Reviewed",
      };
    }
    if (card.kind === "lesson")
      return {
        ...card,
        status: !state.video
          ? "Playback unavailable"
          : card.progress
            ? `${Math.round(card.progress * 100)}% watched`
            : "Ready to open",
      };
    return card;
  });
}
