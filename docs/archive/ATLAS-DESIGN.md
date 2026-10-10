> Historical reference from before the October 10, 2026 reset. This does not describe the current application. See the root README.

# Atlas design system

Atlas brings learning, teaching, and school administration into a calm, coherent workspace. The visual direction takes inspiration from Apple's restrained interfaces: clear hierarchy, neutral surfaces, precise typography, generous space, and a small amount of purposeful color. Atlas retains its own identity and uses no Apple logos, proprietary fonts, or copied interface assets.

This is the frontend design specification for every existing route and component. It supersedes the earlier editorial studio and field notebook explorations. The product name is Atlas in navigation, page titles, footers, and documentation. Existing internal package identifiers and persisted authentication credentials remain compatible.

## Color palette

Colors live in `packages/ui/src/styles.css`. Components consume semantic tokens instead of independent color values.

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `--paper` | `#f5f5f7` | `#111113` | Application canvas |
| `--surface` | `#ffffff` | `#1c1c1e` | Cards, forms, dialogs |
| `--surface-raised` | `#fbfbfd` | `#2c2c2e` | Subtle nested surfaces |
| `--ink` | `#1d1d1f` | `#f5f5f7` | Primary text |
| `--muted` | `#626267` | `#b3b3ba` | Secondary text |
| `--line` | `#dedee3` | `#3e3e43` | Separators and panel borders |
| `--control-line` | `#85858d` | `#85858d` | Form boundaries |
| `--accent` | `#0066cc` | `#80baff` | Links and selected navigation |
| `--accent-solid` | `#0066cc` | `#005bb5` | Primary buttons with white labels |
| `--danger` | `#b42318` | `#ffb4ab` | Error text and borders |
| `--success` | `#237845` | `#8bd6a5` | Confirmed success |

Blue is the default accent. Graphite and green are available as curated alternatives with matching light and dark values. Error and success colors retain their meanings across accents. Selection uses both color and a visible shape, weight, or indicator; errors always include text.

## Customization

An Appearance dialog is available from every page header. Users can select System, Light, or Dark appearance; Blue, Graphite, or Green accent; and Comfortable or Compact density. Preferences are stored only in this browser under `atlas.appearance.v1`, persist across navigation and reloads, and fall back gracefully when storage is unavailable. System appearance follows the operating system. Reset restores System, Blue, and Comfortable.

Customization changes presentation only. It does not change school policy, permissions, or account settings. Density changes spacing while preserving a minimum 44 px control height. Curated palettes keep text and controls readable; arbitrary color entry is outside this design.

## Typography and layout

Use a locally available system sans-serif stack: `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, and sans-serif, with Tahoma as an Arabic fallback. No network font requests. Body text is 16 px with a 1.6 line height. Labels and supporting text are 13–14 px. Headings use semibold weight, modest negative letter spacing, and responsive sizes. Arabic retains natural letter spacing.

Use an 8 px spacing rhythm, 12 px control corners, 20 px panel corners, and 24 px large containers. Shadows are soft and reserved for raised surfaces. Desktop pages have a generous maximum width; reading and input areas remain narrower. Mobile layouts stack columns and wrap actions. Wide data tables scroll inside their own container. Use logical properties for right-to-left layouts.

## Component treatments

| Surface | Treatment |
| --- | --- |
| Brand and navigation | Atlas wordmark with a compact geometric A mark; quiet header separators; rounded active navigation with accent tint |
| Buttons | Solid accent primary action; neutral secondary actions; explicit hover, pressed, focus, disabled, and pending states |
| Inputs, selects, textareas | Shared control border, consistent padding and radius, visible labels, contextual hints, strong focus ring |
| Checkboxes and file inputs | Native keyboard behavior, accent selection, readable labels, aligned hit areas |
| Notices and validation | Tinted neutral or error panel, readable status text, appropriate live region |
| Dialogs | Dimmed backdrop, raised rounded panel, bounded height and internal scrolling; Escape dismissal and focus return |
| Cards and learning records | White or dark neutral panels with thin borders; restrained hover elevation on interactive cards only |
| Course covers and banners | Quiet accent tint, bold readable course title, subtle geometric decoration |
| Tabs and sidebars | Clear selected state; wrap or locally scroll on narrow screens; preserve navigation semantics |
| Tables, rosters, audit and session lists | Subtle separators, muted header surface, aligned content, tabular numbers where useful |
| Editors, uploads and receipts | Consistent panels and fields; distinguish drop areas with dashed borders; readable printed receipts |
| Empty, loading and restricted states | Plain explanation in the same panel language; retain retry or next actions when available |
| Catalogue and service status | Same Atlas shell and tokens as the application; catalogue previews remain explicitly synthetic |

## Coverage

Apply the system to setup, sign-in, activation, recovery, account and session management; the shared workspace; classroom course lists, announcements, materials, rosters and student work; administration; learning; assessment; guidance and rules; support; notebooks; AI; scheduling; projects; shared forms; the catalogue; and service status. Existing behavior and backend authorization remain authoritative.

## Accessibility and acceptance

Aim for WCAG AA text contrast in every curated palette. Keep keyboard focus visible, dialogs operable by keyboard, labels associated with controls, and state announcements available to assistive technology. Honor reduced motion and forced colors. Do not shrink touch targets in compact mode. Printed records use black text on white and omit navigation and controls.

Verify desktop and 390 px layouts, Arabic and RTL, keyboard navigation and dialog focus return, all appearance and accent combinations, preference persistence and reset, and unavailable storage. Run the existing end-to-end workflows and accessibility checks along with `make check`, `make build`, and `make audit`. Record actual results separately; this specification does not certify release readiness.
