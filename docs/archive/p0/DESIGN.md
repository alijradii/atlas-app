> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# Atlas design baseline and comparison protocol

Open `/catalogue` with `make catalogue`. It works without the API. Every example is synthetic and marked as a prototype. The six views cover installer plus administrator, managing staff, teacher, student and parent, with a younger-learner switch.

The current visual specification is [Atlas design system](../ATLAS-DESIGN.md). It replaces the editorial studio and field notebook explorations with neutral surfaces, system sans-serif typography, and restrained accents. Use Appearance to compare light and dark schemes, blue/graphite/green accents, and comfortable/compact spacing against the same task content.

The interactive comparison presents the same teacher-name field and invitation-review modal through owned Base UI components and React Aria. Test pointer, Tab/Shift+Tab, Enter, Escape, focus return, 390px width, Arabic/RTL and reduced motion. Timetable and complex date-grid comparison is still outstanding; P2 scheduling data contracts are not invented here.

Base UI remains the provisional application foundation: already integrated, unstyled, and wrapped by Atlas components. React Aria is isolated to the catalogue for comparison. Both need application-level accessibility testing; neither library confers WCAG compliance. Record participant names and findings before declaring selection signed off.

Owned catalogue: Button, Field, Notice, ReviewDialog; paper/ink/muted/line/accent/surface/focus tokens; spacing, density, motion and elevation variables. States include loading, empty, error and permission-restricted. The identity workflow uses native labelled controls and shared primitives. Later citations, rubrics, evidence and timetable components remain P3/P4/P7 work.

Identity UI uses English/Arabic translation keys and logical direction styles. Some operator-facing audit codes and API validation messages are English. System-font fallbacks require no remote font fetch; bundled Latin/Arabic fonts and full translation review remain outstanding. Browser automation covers selected accessibility rules, narrow layout and focus return. Manual screen-reader and native-language review remains required.

Primary references: [Base UI Dialog](https://base-ui.com/react/components/dialog), [React Aria Dialog](https://react-aria.adobe.com/Dialog), [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Library behavior is evaluated in this checkout; references do not substitute for local tests.
