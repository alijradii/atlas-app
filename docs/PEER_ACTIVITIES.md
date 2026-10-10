# Peer interests and teacher-managed activities

Students explicitly share a topic with a teacher's current student group. This is
separate from their private study chats and separate from joining an activity
request. Shared topic matching normalizes case, Unicode presentation forms and
whitespace; it does not guess semantic equivalence between unrelated topics.

Students create an activity request for a currently linked teacher. Creating the
request records the student's interest in that request. Peers currently linked
to the same teacher can see the board, express interest once, and withdraw while
the request is pending. The database's composite primary keys prevent duplicate
opt-ins or votes. Students see counts, their own participation and the teacher's
name; participant account IDs are returned only to the organizing teacher.
Parents and advisors see requests in which their currently linked students
participate. No peer directory exposes unconsenting student names or private
conversations.

Teachers create and manage the actual calendar events. Accepting a request must
link an existing scheduled event owned by that teacher, including every current
interested student. Requests cannot publish events automatically. Declining may
include an explanation. Reviewed requests are immutable records; calendar changes
remain available to the teacher through the event workflow.

The teacher can ask Atlas to suggest an activity for a shared topic. Before any
model request, the API requires at least three distinct, active students currently
linked to that teacher who explicitly opted into that topic. Gemini receives only
the normalized topic and verified count, not student names, lessons, messages or
records. Its bounded JSON title and description become a pending suggestion,
with a server-owned evidence count. Suggestions never automatically enroll
students or create events. A pending AI suggestion for the same teacher/topic is
reused. The API records attempts before provider calls and limits them to three
per minute and twenty per day. Failed model calls create no substitute suggestions.
The session, teacher role and evidence are checked again after the provider call.

Visibility and live participation counts use active account roles and current
school relationships on every request. Revoking a relationship or disabling an
account excludes its evidence immediately; historical records remain stored for
the organizer. The evidence count on an AI request is the creation-time snapshot,
not a claim that those students enrolled or still share that interest today.

Implementation: `activities.py` contains relationship scopes and the aggregate-only
provider adapter; `activity_routes.py` owns authorization and transitions;
`activity_schemas.py` defines contracts. Migration `g0402036` adds interests,
requests and participants after the calendar tables. Teacher-row locks serialize
opt-ins, request joins/reviews and suggestion deduplication without holding a
transaction during the model call. PostgreSQL tests cover persistence, duplicate
votes, scoped visibility, account/relationship revocation, role denial, event
acceptance, the three-student threshold, in-flight evidence changes and failed-call
budgets. The provider transport test inspects the actual outbound payload and
rejects model-generated extra fields.
