/** One in-memory draft across route navigation; never persisted or sent automatically. */
let pending: { accountId: string; text: string } | null = null;

export function saveStudyDraft(accountId: string, text: string) {
  pending = { accountId, text: text.slice(0, 2000) };
}

export function consumeStudyDraft(accountId: string): string {
  const draft = pending;
  pending = null;
  return draft?.accountId === accountId ? draft.text : "";
}
