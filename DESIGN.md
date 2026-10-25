---
version: 02
name: APC-Portal-design-system
description: |
  APC Portal speaks in the three colours hidden in the club's logo - flame red, wave blue and the gold swoosh - laid down as whole, flat fields of colour on a white page with deep navy ink. The logo itself is the motif: it is built from three separate pieces (red flame, gold swoosh, blue wave) that spell A, P and C, and the site assembles, splits and reuses those pieces. Type is rounded and heavy like the logo lettering (Baloo 2 for headings, Nunito for text) with JetBrains Mono for everything that reads like code: section labels written as `// comments`, chips, dates, paths. Buttons behave like keyboard keys. Motion is quick and springy but never required to read the page: sections rise into view, the home page snaps one screen at a time, and the footer is revealed like a curtain.

colors:
  red: "#C23B22"          # primary: main CTA, Join/Recruitment fields, highlights
  red-deep: "#9A2A16"     # keycap edge of red buttons, pressed state
  red-pale: "#F6DED6"     # tinted placeholder (news "Chia sẻ")
  blue: "#1568C9"         # secondary: Events field, links, focus ring, comment labels on white
  blue-deep: "#0F52A0"
  blue-pale: "#DCEAFB"    # tinted placeholder, hover on soft pills
  gold: "#F0A202"         # accent: News field, highlighted words on navy
  gold-deep: "#B87A00"    # gold text on white, keycap edge of light buttons
  gold-soft: "#FFD36B"    # comment labels and accents on navy/red
  gold-pale: "#FCEACA"
  ink: "#081F3D"          # all text on white, navy fields, rules
  paper: "#FFFFFF"        # page background, text on red/blue/navy
  soft: "#F3F6FA"         # quiet surface: info boxes, calendar cells, chips, filter pills
  muted: "#4B5B73"        # secondary text only (meta, captions, descriptions in cards)

typography:
  display:
    fontFamily: Baloo 2
    fontWeight: 800
    fontSize: "clamp(40px, min(6vw, 11vh), 96px)"
    lineHeight: 0.95
    letterSpacing: -0.035em
  heading-section:
    fontFamily: Baloo 2
    fontWeight: 800
    fontSize: "clamp(36px, 4.4vw, 64px)"
    lineHeight: 0.95
  heading-card:
    fontFamily: Baloo 2
    fontWeight: 700
    fontSize: 22px
    lineHeight: 1.15
  body:
    fontFamily: Nunito
    fontWeight: 400
    fontSize: 16-18px
    lineHeight: 1.6
  lede:
    fontFamily: Nunito
    fontSize: "clamp(17px, 1.4vw, 20px)"
    lineHeight: 1.6
  comment:
    fontFamily: JetBrains Mono
    fontWeight: 700
    fontSize: 16px
  chip:
    fontFamily: JetBrains Mono
    fontWeight: 700
    fontSize: 13px
  button:
    fontFamily: Nunito
    fontWeight: 800
    fontSize: 17px

rounded:
  chip: 6px      # rounded-md
  key: 12px      # rounded-xl: buttons, inputs, pagination keys
  photo: 20px    # rounded-[20px]: photos, placeholders, info boxes
  pill: 9999px   # filter pills, avatars

spacing:
  container: 1520px                       # max-w-container-max
  gutter: "16px mobile, 32px from md"     # px-4 md:px-8
  section-home: "clamp(40px, 8vh, 96px)"  # vertical padding, home (one screen per section)
  section-page: "clamp(40px, 7vh, 80px)"  # vertical padding, inner pages
  rhythm: "8px base; 24/32/48/64 between groups"

components:
  button-primary:   { background: "{colors.red}", text: "{colors.paper}", edge: "0 5px 0 {colors.red-deep}", rounded: "{rounded.key}", height: 48px }
  button-outline:   { background: "{colors.paper}", text: "{colors.ink}", edge: "inset 2px {colors.ink} + 0 5px 0 {colors.ink}", rounded: "{rounded.key}" }
  button-light:     { background: "{colors.paper}", text: "{colors.ink}", edge: "0 5px 0 {colors.gold-deep}", rounded: "{rounded.key}", use: "on red/blue/navy fields" }
  pill-filter:      { idle: "{colors.soft} / {colors.ink}", active: "{colors.ink} / {colors.paper}", rounded: "{rounded.pill}" }
  chip:             { typography: "{typography.chip}", rounded: "{rounded.chip}", variants: "ink on soft, paper on ink, status colours" }
  eyebrow:          { typography: "{typography.comment}", prefix: "// ", case: lowercase }
  page-hero:        { background: "one of ink | red | blue | gold field", title: "{typography.display}" }
  photo:            { rounded: "{rounded.photo}", overflow: hidden, hover: "image scales to 1.05 inside the frame" }
  row-list:         { rule: "2px {colors.ink} between rows", hover: "title turns red, arrow nudges right" }
  input:            { background: "{colors.paper}", border: "inset 2px {colors.ink}", focus: "inset 2px {colors.blue} + 4px blue halo", rounded: "{rounded.key}" }
---

## 1. Idea

The APC logo hides three letters: the red **flame** is the A, the flame together with the **gold swoosh** is the P, and the blue **wave** is the C (Adaptive, Progressive, Creative). The whole site is built from that:

- **Colours come in fields, not dots.** A page header is a solid red, blue, gold or navy block from edge to edge; the home page alternates white and colour fields one screen at a time. There are no gradients, glows or tinted overlays.
- **The logo is a material.** `/assets/home/mark/mark-{red,gold,blue}.png` are the three pieces on the same 1652×2048 frame. Stacked in `.mark-stack` they form the logo; the home Values section assembles them on scroll, hovering A/P/C lights the matching pieces, and `.mark-stack.spread` splits them a little on hover (footer, About, Login). Use the pieces; do not redraw the logo.
- **It reads like code because it is a coding club.** Section labels are `// comments`, dates and tags are mono, paths look like a terminal (`apc@umt:~$ ls projects/`), breadcrumbs look like a directory path.

## 2. Colours

| Field | Text | Comment label | Accent words | Button |
|---|---|---|---|---|
| white `paper` | `ink` | `blue` (or `red`) | `red` | `primary` / `outline` |
| navy `ink` | `paper` | `gold-soft` | `gold` | `primary` or `light` |
| `red` | `paper` | `paper/85` | `gold-soft` | `light` |
| `blue` | `paper` | `paper/85` | `gold-soft` | `light` |
| `gold` | `ink` | `ink/75` | — | `outline` |
| `soft` | `ink` | `blue` | `red` | `primary` / `outline` |

Rules:
- Running text is `ink` (or `paper` on dark fields) at 16px or more. `muted` is only for secondary text: meta, captions, card descriptions.
- Never white text on gold; never gold text on white (use `gold-deep`).
- Red is the action colour: at most one red button per screen.
- The pale tints (`red-pale`, `blue-pale`, `gold-pale`) are only for placeholders in long grids, where many solid fields side by side would shout.
- Tokens live in two places that must match: CSS variables in `apps/web/src/index.css` and Tailwind colours in `apps/web/tailwind.config.cjs` (`apc-red`, `apc-blue`, `apc-gold`, `apc-*-deep|pale|soft`, `ink`, `paper`, `soft`, `muted`).

## 3. Typography

- **Baloo 2** (600-800) for every heading, big numbers (dates, step numbers, 404) and statements.
- **Nunito** (400-800) for text, buttons and nav.
- **JetBrains Mono** (500-700) for comment labels, chips, dates in meta lines, code and paths.
- No other families. Headings are tight (`leading-[0.95]`, negative tracking); body is `leading-relaxed`.
- **Headings fit in two lines** at every width. On detail pages, where titles are long, `PageHero` uses its `compact` size.
- Sizes are fluid with `clamp()`. On the home page, sizes also depend on height (`min(4.8vw, 8vh)`) so each section fits one screen.
- Labels are lowercase (`// lịch sắp tới`), never UPPERCASE with tracking.

## 4. Layout

- **Container**: `mx-auto w-full max-w-container-max` (1520px) with `px-4 md:px-8`. Split sections that bleed to the edge align their inner text with `lg:pl-[max(32px,calc((100vw-1520px)/2+32px))]`.
- **Home page**: every section has class `screen` (`min-height: 100svh` on desktop ≥1024×640) and uses vh-based clamps for padding and type so it fits exactly one screen. `html.snap-home` enables mandatory scroll snap (`home.css`); the `.snap-end` sentinel after the footer is the last snap point.
- **Inner pages**: `PageHero` field on top, then content sections with `py-[clamp(40px,7vh,80px)]`. Lists are either a 3-up grid of cards (`gap-x-8 gap-y-14`, 2-up from `sm`/`md`, 1-up on phones) or a ruled list of rows.
- **Split sections** (home Activities, Join, Projects, Login): two halves, one a colour field, one white, each with its own job (action vs. explanation, photo vs. list).
- Grid children that hold long text, code or truncated strings need `min-w-0`.

## 5. Shapes and depth

- Radius scale: chips 6px, keys/inputs 12px, photos and boxes 20px, pills full.
- **No hairline-bordered cards, no drop shadows.** Separation comes from colour fields, `soft` boxes and 2px `ink` rules (`border-t-2 border-ink` over lists and section heads).
- The only "shadow" is the solid keycap edge under buttons and pagination keys.

## 6. Components (`apps/web/src`)

| Piece | Where | Notes |
|---|---|---|
| `buttonClass(variant, extra)` / `<Button>` | `components/buttonClass.ts`, `Button.tsx` | Keycap button: lifts on hover, sinks on press. Variants `primary`, `outline`, `light`. Use `buttonClass` on `<Link>`/`<a>` that should look like a button; never wrap a `<Button>` in a `<Link>`. |
| `pillClass(active)` | `components/buttonClass.ts` | Filter pills; give the group `role="group"` and each pill `aria-pressed`. |
| `<Eyebrow>` | `components/Eyebrow.tsx` | `// comment` label as a `<p>`; colour via `className`, accepts `data-rv` and `style`. |
| `<PageHero>` | `components/PageHero.tsx` | Header field for inner pages: `tone` ink/red/blue/gold, `comment`, `title`, `lede`, `top` (breadcrumb), `aside` (actions), `compact` for long titles. |
| `<Breadcrumb>` | `components/Breadcrumb.tsx` | Mono path `trang chủ / sự kiện / …`, inherits colour from its field. |
| `<Pagination>` | `components/Pagination.tsx` | Keycap number keys; current page is a pressed navy key. |
| `<AsyncState>` | `components/AsyncState.tsx` | Loading (`đang tải` + caret), error (message + "Thử lại"), empty (big muted line), success. Every page uses it. |
| `<StatusScreen>` | `components/StatusScreen.tsx` | Full-page 404 / 403 / work-in-progress: big red code next to the explanation. |
| `EventCard`, `NewsCard`, `ProjectCard` | `components/` | Photo (or flat placeholder) in a `.photo` frame, mono label, Baloo title, muted meta. Whole card is one link. No border, no shadow. |
| `.photo` | `index.css` | Rounded frame; the image scales to 1.05 inside on hover. |
| `.mark-stack` (+ `.spread`) | `index.css` | The three logo pieces stacked; `spread` splits them on hover. |
| Ruled rows | recruitment list, About departments, home agenda | `border-b-2 border-ink` rows; the title is the link with `after:absolute after:inset-0` so the whole row is clickable. |

Forms: inputs are white with a 2px ink inset border; focus switches to a blue border plus a soft blue halo (the only focus signal in forms). Labels are lowercase mono. Global keyboard focus is a 3px blue outline (`index.css`).

## 7. Imagery

- Photos live in `/assets/home/photos/` (club life: workshop, training, tech talk, hackathon, award, contest, demo day, teamwork, hero). Events without a cover use the photo for their type (`eventPhoto()` in `lib/eventVisual.ts`); finished or cancelled events show it in greyscale.
- Real product screenshots for projects; a project without one shows a soft box with its folder as a shell line, not a fake screenshot.
- News without a cover shows a flat tinted block in its category colour with one Material Symbol.
- No gradient placeholders, no stock icons as decoration, no stickers.

## 8. Motion

- **Reveal**: `useReveal()` (in `RootLayout`) adds `.in` to each `main section` as it enters the viewport; children with `data-rv` (`data-rv="left"|"right"` for sideways) rise and fade in, staggered with `style={{ '--d': '90ms' }}`. Content is visible by default. It is hidden only once JS has added `rv-on` and the user has not asked for reduced motion.
- **Rise**: `.rise` for things visible on load (hero).
- **Home**: logo pieces assemble in Values, an auto-advancing accordion in Activities, a pointer-following photo on the events agenda, a timeline in Join, and snap scrolling between screens.
- **Footer curtain**: the content (`.site-body`, z-index 2) scrolls away to reveal the sticky full-screen navy footer underneath (desktop ≥1024×640).
- **Feedback**: buttons lift and sink, photos zoom inside their frame, row arrows nudge, titles turn red on hover.
- Animate with the individual `translate` / `scale` / `rotate` properties so motion never overwrites Tailwind `transform` utilities. Durations 150-700ms, easing `--ease-out`.
- `prefers-reduced-motion`: all animation and transition durations collapse, reveal is skipped, snap stays but scrolling is instant.

## 9. Do and don't

Do
- Start an inner page with `PageHero` and pick the field colour of that area (Events blue, News gold, Projects and About navy, Recruitment red).
- Write labels as `// lowercase comments` with `<Eyebrow>`.
- Use real photos and the logo pieces; keep every section's full content.
- Keep the four states (loading / empty / error / success) through `<AsyncState>`.

Don't
- Don't add bordered cards, drop shadows, gradients or glass effects.
- Don't put two red buttons side by side, or white text on gold.
- Don't interpolate class names (`text-${color}`); write literal classes in a map.
- Don't use `toLocaleString`; dates go through `formatDate` / `formatDateTime` (Vietnam time).

## 10. Responsive

| Width | Changes |
|---|---|
| < 768px | One column; split sections stack (colour half first); nav becomes a drawer; home sections grow to fit content (no snap). |
| 768-1023px | 2-up grids; split sections still stacked. |
| ≥ 1024px | 3-up grids, split sections side by side, one-screen home sections with snap, sticky curtain footer (when the window is at least 640px tall). |

## 11. Known gaps

- No dark theme yet; colours are defined for the light page only.
- Portal and admin layouts (A3) are not designed; `MenuPlaceholder` uses `PageHero` + ruled rows as a stopgap.
- Modal/dialog and toast styles are not defined.
