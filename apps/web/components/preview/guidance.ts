import { type AccountId, fixture } from "./data";
import type { PreviewState } from "./state";

export type GuideAnchor =
  | "screen.heading"
  | "batch.submit"
  | "batch.start"
  | "batch.new"
  | "path.options"
  | "advisor.ask"
  | "acts.join"
  | "lesson.chapters"
  | "lessons.search"
  | "lessons.upload"
  | "analytics.inspect"
  | "analytics.tab"
  | "proposal.recommend"
  | "proposal.confirm"
  | "choice.agree"
  | "acts.approve";
export type Guide = {
  id: GuideAnchor;
  route: string;
  text: string;
  fallback?: { id: GuideAnchor; text: string };
};

/** Owned preview destinations only: guidance never submits, grants access or changes state. */
export function resolveGuide(
  accountId: AccountId,
  request: string,
  state: PreviewState,
): Guide | undefined {
  if (
    !/where|how (do|can|should) i|show me|find|which button|can.?t find|take me|how to/i.test(
      request,
    )
  )
    return;
  const role = fixture.accounts[accountId]?.role;
  const text = request.toLowerCase();
  const guide = (
    id: GuideAnchor,
    section: string,
    explanation: string,
    fallback?: Guide["fallback"],
  ): Guide => ({
    id,
    route: `/preview/${accountId}/${section}`,
    text: explanation,
    fallback,
  });
  const unavailable = (section: string, explanation: string) =>
    guide("screen.heading", section, explanation);
  if (role === "student") {
    if (/submit|hand in|batch|practice/.test(text)) {
      const batch = accountId === "sami" ? state.samiBatch : state.batch;
      if (batch === "none")
        return guide(
          "batch.start",
          "practice",
          "Start a practice batch here. You’ll answer all five problems before submitting the whole set.",
        );
      if (batch === "feedback")
        return guide(
          "batch.new",
          "practice",
          "This batch is already submitted. Review the feedback above, or prepare a new batch here.",
        );
      return guide(
        "batch.submit",
        "practice",
        "Submit the whole batch here once every problem has an answer or “I couldn’t solve this one”. The button stays disabled until all five are ready. Wrong answers are fine.",
        {
          id: "batch.start",
          text: "Start a practice batch here, then submit all five answers together.",
        },
      );
    }
    if (
      /propos|choose.*subject|pick.*subject|optional subject|change.*subject/.test(
        text,
      )
    )
      return guide(
        "path.options",
        "subjects",
        "Explore optional subjects here. Choose a subject to inspect its prerequisites and proposal status. Your advisor and family review choices before the school confirms them.",
      );
    if (/advisor|adviser|nassar/.test(text)) {
      if (accountId === "sami")
        return unavailable(
          "adviser",
          "Your advisor is still being matched. Their profile and question form will appear here after that connection is ready.",
        );
      return guide(
        "advisor.ask",
        "adviser",
        "Write your question for Dr. Nassar here. This preview saves the question locally; it does not send a message.",
      );
    }
    if (/join|club|activit/.test(text))
      return guide(
        "acts.join",
        "activities",
        "Open an activity’s join confirmation here. You can review who would see your name before joining.",
        {
          id: "screen.heading",
          text: "You have joined the available activities. This screen shows your memberships and other interests.",
        },
      );
    if (
      /chapter|jump|segment|part of.*lesson|lesson|search|rewatch|recording/.test(
        text,
      )
    ) {
      if (!state.school && !state.settings.recHome)
        return unavailable(
          "lessons",
          "Recordings are currently restricted to the school network in this preview. The availability screen explains the next step.",
        );
      if (/chapter|jump|segment|part of.*lesson/.test(text))
        return guide(
          "lesson.chapters",
          "lesson/L1",
          "Choose a chapter here to explore that part of the sample lesson. No video recording is attached yet.",
        );
      return guide(
        "lessons.search",
        "lessons",
        "Search your lesson library by topic or unit here, then open a recording’s chapter list.",
      );
    }
  }
  if (role === "teacher") {
    if (/upload|record|add.*(lesson|video)/.test(text))
      return guide(
        "lessons.upload",
        "upload",
        "Choose a recording here, then add its title and audience. This preview stores sample draft metadata only; private file uploads live in Your files.",
      );
    if (
      /evidence|inspect|misconcep|analytic|why.*(students|class)/.test(text)
    ) {
      if (!state.school)
        return unavailable(
          "analytics",
          "Teacher analytics stays on the school network. You can review this availability screen; guidance does not change your network setting.",
        );
      return guide(
        "analytics.inspect",
        "analytics",
        "Examine the sample student answers and interpretation here. You can review the evidence before planning a follow-up.",
        {
          id: "analytics.tab",
          text: "Open Misconceptions here to inspect sample student answers and review the interpretation before planning a follow-up.",
        },
      );
    }
  }
  if (role === "adviser" && /recommend|parent|approv|review.*propos/.test(text))
    return guide(
      "proposal.recommend",
      "proposals",
      "Write your review note, then recommend the subject to the parent here. The recommendation remains your decision.",
      {
        id: "screen.heading",
        text: "There are no proposals awaiting your recommendation. This screen shows the current review status.",
      },
    );
  if (
    role === "parent" &&
    /agree|approv|review|choice|propos|subject/.test(text)
  )
    return guide(
      "choice.agree",
      "choices",
      "After the advisor’s recommendation, add your thoughts and agree here. The school still confirms the timetable afterwards.",
      {
        id: "screen.heading",
        text: "The subject is not awaiting your agreement yet. Review the current status here; the advisor recommends before the family decides.",
      },
    );
  if (
    role === "staff" &&
    /subject|choice|propos/.test(text) &&
    !/activit/.test(text)
  )
    return guide(
      "proposal.confirm",
      "proposals",
      "After the advisor and family have reviewed the subject, add your review note and confirm the choice here. You can request changes with an explanation instead.",
      {
        id: "screen.heading",
        text: "No subject proposals are waiting for school confirmation. Review the current status here; the advisor and family decide before the school confirms.",
      },
    );
  if (role === "staff" && /approv|review|activit|propos/.test(text)) {
    if (!state.school)
      return unavailable(
        "access",
        "Staff activity review is a school-network workflow. Review access and availability here; guidance does not switch the network setting.",
      );
    return guide(
      "acts.approve",
      "activities",
      "Confirm the sponsor and location, then approve the sample activity here. You can request changes instead.",
      {
        id: "screen.heading",
        text: "There are no activities awaiting approval. This screen lists the current review status.",
      },
    );
  }
}
