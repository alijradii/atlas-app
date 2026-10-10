"""Deterministic provider double for disposable browser tests, never imported by the app."""

from uuid import uuid4


class BrowserStudyProviders:
    def __init__(self):
        self.documents = {}

    def upload_transcript(self, text, filename):
        key = uuid4().hex
        self.documents[key] = text
        return key

    def receipt(self, source_id):
        return {"id": source_id, "source_id": source_id, "state": "ready"}

    def retrieve(self, question, source_ids):
        return [
            {
                "id": f"{key}:chunk-1",
                "source_id": key,
                "content": self.documents[key][:2000],
                "page": 1,
                "page_basis": "logical",
                "citation": i,
            }
            for i, key in enumerate(source_ids, 1)
            if key in self.documents
        ]

    def answer(self, question, history, passages):
        if not passages:
            return "No supporting passages were found in these transcripts."
        return "Here is the relevant lesson passage:\n\n" + passages[0]["content"] + " [1]"

    def answer_general(self, question, history):
        return (
            "Let's work through it together. Start with what you already know, "
            "then try one small step. What part would you like to understand?"
        )
