"""Read-only UI knowledge, never browser selectors or authorization supplied by the model."""

from dataclasses import asdict, dataclass

from pydantic import BaseModel, ConfigDict, Field


@dataclass(frozen=True)
class Feature:
    id: str
    title: str
    route: str
    anchor: str
    description: str
    steps: tuple[str, ...]
    roles: tuple[str, ...] = ()


FEATURES = (
    Feature(
        "home",
        "Your workspace",
        "/workspace",
        "home.overview",
        "Your home groups work that needs you, work to continue and items waiting on others.",
        (
            "Open Home in the sidebar.",
            "Choose a task card to continue the actual saved work.",
            "The assistant can be minimized into its side button without losing your draft.",
        ),
    ),
    Feature(
        "upload",
        "Upload a document or recording",
        "/files",
        "files.upload",
        "Upload private documents, audio or video from Files & recordings.",
        (
            "Use Drop your files here or choose from your device to pick a supported file.",
            "Documents/images support PDF, DOCX, TXT, PNG and JPEG up to 10 MiB. "
            "Audio/video support MP4, WebM, MP3, WAV and M4A up to 50 MiB.",
            "Images can be stored, but study sources must be documents or recordings.",
            "Wait for upload and security verification to finish.",
            "Choose Use for study on a verified supported file.",
            "Review the extracted transcript, correct it and approve it before indexing.",
            "A verified file is not yet a ready study source; extraction and approval come first.",
        ),
    ),
    Feature(
        "sources",
        "Choose your lesson sources",
        "/study",
        "study.sources",
        "Optionally select ready lessons for a conversation grounded in those sources.",
        (
            "Open Study with agent. You can ask immediately without choosing any sources.",
            "For cited answers about your materials, select one to eight ready lesson sources.",
            "Start a conversation and ask your question. Answers cite those selected sources.",
            "The general Atlas assistant cannot see lesson text; use the source-based Study mode.",
        ),
    ),
    Feature(
        "transcript",
        "Review your transcript",
        "/study",
        "study.transcript",
        "Review and approve extracted text before it becomes a searchable study source.",
        (
            "Find your imported lesson in Study with agent.",
            "Open a lesson marked Review, then correct its transcript.",
            "Approve the text and wait for indexing. It becomes selectable when Ready.",
            "If no lesson is awaiting review, upload a file or recording first.",
        ),
    ),
    Feature(
        "chat",
        "Start studying",
        "/study",
        "study.composer",
        "Talk immediately to start a saved study session; sources are optional.",
        (
            "Open Study with agent, enter a question and send it to start a saved study session.",
            "Without sources, Atlas tutors from general knowledge with no lesson citations.",
            "For answers grounded in your materials, select ready sources in a new conversation.",
            "Only source-backed answers have numbered citations to inspect.",
            "Stop cancels an active answer. Retry is a new explicit attempt.",
            "Switch to Ask Atlas for interface help; it cannot read lesson sources.",
        ),
    ),
    Feature(
        "lessons",
        "Find a lesson",
        "/workspace?section=lessons",
        "lessons.search",
        "Browse or search lessons that your account can access.",
        (
            "Open Lessons in the sidebar.",
            "Search by title or subject and choose a lesson.",
            "Only your own or explicitly shared/published lessons are available.",
        ),
        ("student", "teacher"),
    ),
    Feature(
        "work",
        "Your schoolwork",
        "/workspace?section=work",
        "schoolwork.assignments",
        "Complete assigned work or review submissions in your schoolwork screen.",
        (
            "Open Schoolwork from the sidebar.",
            "Students open an assignment, enter their work and submit it.",
            "Teachers create assignments for linked students and give feedback on submissions.",
            "Parents can see linked student work but cannot submit or grade it.",
        ),
        ("student", "teacher", "parent"),
    ),
    Feature(
        "advisor",
        "Ask your advisor",
        "/workspace?section=messages",
        "advisor.ask",
        "Send a private message to your linked advisor or student.",
        (
            "Open My advisor, or select a student from the advisor caseload.",
            "Choose the linked person, write your question and send it.",
            "Only linked participants can read the conversation. Sending needs your own click.",
        ),
        ("student", "advisor"),
    ),
    Feature(
        "plans",
        "Subject proposals",
        "/workspace?section=plans",
        "proposals.list",
        "Review subject choices with the linked student, advisor and parent.",
        (
            "Open Subjects & path or Subject proposals in the sidebar.",
            "Students create a proposal for linked adults.",
            "Advisors review it first; the linked parent decides after advisor review.",
            "Status changes only when the authorized person submits the decision.",
        ),
        ("student", "advisor", "parent"),
    ),
    Feature(
        "students",
        "Your students",
        "/workspace?section=students",
        "students.list",
        "Browse your linked students and open their advising workspace.",
        (
            "Open My students in the sidebar.",
            "Search the caseload and choose a student.",
            "View that student's available proposals and private advisor conversation.",
        ),
        ("advisor",),
    ),
    Feature(
        "security",
        "Account security",
        "/account",
        "account.security",
        "Manage your password and signed-in sessions.",
        (
            "Open your profile in the sidebar.",
            "Use the password form to change your password, or revoke other sessions.",
            "Never share a password or verification code in the assistant.",
        ),
    ),
)


def available_features(roles: list[str]) -> dict[str, Feature]:
    return {f.id: f for f in FEATURES if not f.roles or set(roles).intersection(f.roles)}


class ContextInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    features: list[str] = Field(default_factory=list, max_length=6)


def context_for(features: dict[str, Feature], requested: list[str], screen: str) -> dict:
    if any(key not in features for key in requested):
        raise ValueError("That UI feature is unavailable for this account")
    chosen = [features[key] for key in requested] if requested else list(features.values())
    return {
        "version": 1,
        "screen": screen,
        "features": [asdict(feature) for feature in chosen],
        "rules": [
            "These tools explain the interface; they cannot click, submit, upload or modify data.",
            "A highlight points to a feature; it does not complete that feature's action.",
            "This context contains no private lessons, transcripts, messages, grades or records.",
            "Every screen retains the assistant; minimize it when it covers your work.",
            "Account access follows your permissions anywhere; no school network is required.",
        ],
    }
