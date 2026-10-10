/** Presentation only: API roles still authorize every underlying workflow. */
export function assistantRole(roles: readonly string[]) {
  if (roles.includes("student")) return "student";
  if (roles.includes("teacher")) return "teacher";
  if (roles.includes("advisor")) return "advisor";
  if (roles.includes("parent")) return "parent";
  return "student";
}
export function roleAssistant(roles: readonly string[]) {
  const role = assistantRole(roles);
  const options = {
    student: {
      title: "Study with agent",
      description: "Ask about your lessons or find your next step.",
      placeholder: "Ask about a lesson, a problem, or your workspace",
      suggestions: [
        "Upload a document or recording",
        "Review my transcripts",
        "Help me understand my lesson",
      ],
    },
    teacher: {
      title: "Teaching assistant",
      description:
        "Find your teaching tools, share lesson materials, and guide students with your own feedback.",
      placeholder: "Ask about sharing lessons, assignments, or your workspace",
      suggestions: [
        "How do I share a lesson with my students?",
        "Where can I review student submissions?",
        "How do I create an assignment?",
      ],
    },
    advisor: {
      title: "Advisor assistant",
      description:
        "Find your students, follow up on conversations, and navigate subject proposals.",
      placeholder: "Ask about your students, proposals, or advisor tools",
      suggestions: [
        "Where can I find my linked students?",
        "How do I review a subject proposal?",
        "How do I reply to a student?",
      ],
    },
    parent: {
      title: "Family assistant",
      description:
        "Stay involved in your child’s schoolwork and understand the choices waiting for your decision.",
      placeholder: "Ask about schoolwork, subject choices, or family tools",
      suggestions: [
        "Where can I see my child’s schoolwork?",
        "How do I review a subject choice?",
        "What can I do in my parent workspace?",
      ],
    },
  };
  return { role, ...options[role] };
}
