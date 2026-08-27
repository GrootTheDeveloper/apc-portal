---
version: 01
name: APC-Portal-design-system
description: |
  The design system for APC Portal (Applied Programming Club) is built around a tri-tone color palette taken directly from the club's logo - orange-red, blue, and gold - then refined to maintain brand identity while ensuring contrast and a warm feel on both light and dark backgrounds. These three colors are not just aesthetic choices but also reflect the club's Adaptive - Progressive - Creative spirit: orange-red as the primary color representing Adaptive, guiding all important CTAs; blue representing Progressive, used for secondary actions and focus states to create a sense of stability and reliability; and gold embodying Creative, appearing selectively as an accent rather than being overused. Accompanying the color palette is the font pair Geist and Geist Mono - chosen for their minimalism, readability, and user-friendliness for most web users - helping the visual hierarchy rely primarily on size and font weight rather than color. The entire interface pursues a consistent soft rounded corner style, without square corners, and minimizes shadows - reserving them only for elements that truly need to stand out like input fields on focus, floating cards, or modals.

colors:
  primary: "#C23B22"
  primary-hover: "#A62F1A"
  primary-active: "#841F11"
  primary-pale: "#F6DED6"
  on-primary: "#FFFFFF"
  secondary: "#1568C9"
  secondary-hover: "#0F52A0"
  secondary-active: "#0B3E7A"
  secondary-pale: "#DCEAFB"
  on-secondary: "#FFFFFF"
  accent: "#F0A202"
  accent-hover: "#CC8700"
  accent-active: "#A66C00"
  accent-pale: "#FCEACA"
  on-accent: "#20160A"
  canvas: "#FAF8F5"
  surface-soft: "#F1ECE5"
  card: "#FFFFFF"
  ink: "#201A16"
  mute: "#6B5F55"
  hairline: "#E7DFD5"
  hairline-strong: "#CBBFAF"
  success: "#0E9F6E"
  error: "#B42318"
  warning: "#D97706"
  neutral: "#667085"

colors-dark:
  primary: "#E0603F"
  primary-hover: "#EB8468"
  primary-active: "#F5A88F"
  secondary: "#4A9EFF"
  secondary-hover: "#74B4FF"
  secondary-active: "#9ECAFF"
  accent: "#F5B93D"
  accent-hover: "#F7C866"
  accent-active: "#FAD78F"
  canvas: "#0F0F10"
  surface-soft: "#18181A"
  card: "#212123"
  ink: "#EDEDED"
  mute: "#A1A1A6"
  hairline: "#2A2A2D"
  hairline-strong: "#3D3D40"
  success: "#34D399"
  error: "#F87171"
  warning: "#FBBF24"

typography:
  display:
    fontFamily: Geist
    fontSize: 2.6rem
    fontWeight: 800
    lineHeight: 1.05
  heading-lg:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.15
  heading-md:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.25
  heading-sm:
    fontFamily: Geist
    fontSize: 1.05rem
    fontWeight: 700
    lineHeight: 1.4
  body-md:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  caption-sm:
    fontFamily: Geist
    fontSize: 0.85rem
    fontWeight: 400
    lineHeight: 1.5
  code-sm:
    fontFamily: Geist Mono
    fontSize: 0.9rem
    fontWeight: 500
    lineHeight: 1.4

rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px

spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 24px
  6: 32px
  7: 48px
  8: 64px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
    fontWeight: 600
    rounded: "{rounded.md}"
    padding: 10px 20px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.body-md}"
    fontWeight: 600
    rounded: "{rounded.md}"
    padding: 10px 20px
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body-md}"
    fontWeight: 600
    rounded: "{rounded.md}"
    padding: 10px 20px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.md}"
    padding: 10px 20px
  button-disabled:
    backgroundColor: "#CFC7BF"
    textColor: "#7D736A"
    rounded: "{rounded.md}"
  badge-tag:
    backgroundColor: "color-mix({colors.primary}, 18%)"
    textColor: "{colors.primary}"
    typography: "{typography.code-sm}"
    rounded: "{rounded.full}"
    padding: 4px 12px
  text-input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px 14px
  text-input-focus:
    border: "1px solid {colors.secondary}"
    boxShadow: "0 0 0 3px rgba(21,104,201,0.25)"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    padding: 24px
  nav-bar:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    boxShadow: sm
  footer-section:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.mute}"
    typography: "{typography.body-md}"
    padding: 48px 24px
---

## Colors

### Brand
- **Primary / orange-red** (`{colors.primary}` -- `#C23B22`): Main CTA ("Register" button), active links, nav underlines. Hover -> `{colors.primary-hover}`, active/pressed -> `{colors.primary-active}`, pale background for badges/tags -> `{colors.primary-pale}`.
- **Secondary / blue** (`{colors.secondary}` -- `#1568C9`): Secondary action buttons, focus rings for inputs/forms. Hover -> `{colors.secondary-hover}`, active -> `{colors.secondary-active}`, pale background -> `{colors.secondary-pale}`.
- **Accent / gold** (`{colors.accent}` -- `#F0A202`): Secondary accents, prominent badges. Text on accent backgrounds always uses `{colors.on-accent}` (dark color, never white due to poor contrast). Hover -> `{colors.accent-hover}`, active -> `{colors.accent-active}`, pale background -> `{colors.accent-pale}`.

### Surface
- **Canvas** (`{colors.canvas}` -- `#FAF8F5`): Default page background, warm-neutral rather than pure white.
- **Surface Soft** (`{colors.surface-soft}` -- `#F1ECE5`): Alternating section backgrounds, footer.
- **Card** (`{colors.card}` -- `#FFFFFF`): Background for cards/inputs/nav -- a slightly "elevated" surface compared to the canvas.
- **Hairline** (`{colors.hairline}` -- `#E7DFD5`): Default 1px border for cards/inputs.
- **Hairline Strong** (`{colors.hairline-strong}` -- `#CBBFAF`): Stronger borders (important dividers, hover borders).

### Text
- **Ink** (`{colors.ink}` -- `#201A16`): Default heading and body text.
- **Mute** (`{colors.mute}` -- `#6B5F55`): Captions, meta text, footer copy.

### Semantic
- **Success** (`{colors.success}` -- `#0E9F6E`): Success confirmations, valid input borders.
- **Error** (`{colors.error}` -- `#B42318`): Validation errors, error messages.
- **Warning** (`{colors.warning}` -- `#D97706`): Warnings.
- **Neutral** (`{colors.neutral}` -- `#667085`): Neutral states, subdued disabled text.

### Dark Mode
All brand/surface/text/semantic tokens have alternative versions in `colors-dark` (activated via `[data-theme="dark"]`). Principle: brand colors are brighter and more saturated to pop on dark backgrounds (`{colors.canvas}` -> `#0F0F10`), text colors are inverted (`{colors.ink}` -> `#EDEDED`).

## Typography

### Font Family
- **Geist** -- primary font for all headings and body text.
- **Geist Mono** -- used specifically for code, tags, and technical labels (`{typography.code-sm}`).

The visual hierarchy relies primarily on **size + weight**, without using color to distinguish text levels (except `{colors.mute}` for captions).

### Hierarchy

| Token | Size | Weight | Line Height | Used for |
|---|---|---|---|---|
| `{typography.display}` | 2.6rem | 800 | 1.05 | Hero / logotype |
| `{typography.heading-lg}` | 2rem | 700 | 1.15 | Page titles (H1) |
| `{typography.heading-md}` | 1.5rem | 700 | 1.25 | Section titles (H2) |
| `{typography.heading-sm}` | 1.05rem | 700 | 1.4 | Card titles / labels (H3) |
| `{typography.body-md}` | 1rem | 400 | 1.6 | Default paragraphs |
| `{typography.caption-sm}` | 0.85rem | 400 | 1.5 | Captions, meta text (`{colors.mute}`) |
| `{typography.code-sm}` | 0.9rem | 500 | 1.4 | Tags, inline code blocks |

### Principles
Do not use a third font-family besides Geist/Geist Mono. Headings are always weight 700-800, body is always 400; there are no intermediate weights (500/600) for regular text -- 600 is reserved exclusively for button labels.

## Layout

### Spacing System
- **Base unit:** 4px
- **Tokens:** `{spacing.1}` (4px) · `{spacing.2}` (8px) · `{spacing.3}` (12px) · `{spacing.4}` (16px) · `{spacing.5}` (24px) · `{spacing.6}` (32px) · `{spacing.7}` (48px) · `{spacing.8}` (64px)
- **Inside components:** `{spacing.2}`-`{spacing.3}` (input padding, icon-text gap).
- **Between items in the same group:** `{spacing.4}`-`{spacing.5}` (card grid, form fields).
- **Between sections:** `{spacing.7}`-`{spacing.8}`.

### Grid & Container
- **Container:** max-width `960px`, padding `60px 24px` on desktop.
- **Card grid:** 3-up desktop (≥1024px) -> 2-up tablet (768-1023px) -> 1-up mobile (<768px).
- **Nav:** horizontal row on desktop/tablet -> hamburger drawer on mobile (keeping the red CTA button prominent).

### Whitespace Philosophy
Do not use decorative gradients or meshes. The "airiness" comes from alternating `{colors.canvas}` and `{colors.surface-soft}` between sections, not from excessively large padding inside individual components.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 -- Flat | No border, no shadow | Static sections, page background |
| 1 -- Hairline | 1px border `{colors.hairline}` | Cards, default sections (no shadow) |
| 2 -- Shadow sm | `--shadow-sm` | Inputs, tags |
| 3 -- Shadow md | `--shadow-md` | Floating cards, dropdowns, nav bars |
| 4 -- Shadow lg | `--shadow-lg` | Modals, popovers |
| Focus glow | `--shadow-focus-red` / `--shadow-focus-blue` | Focus ring matching context color (red = CTA, blue = input) |

**Rule:** Static surfaces (cards, sections) default to hairline borders only, no shadow. Shadows are strictly reserved for surfaces that are actually "elevated" above other content.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.sm}` | 8px | Inputs, tags |
| `{rounded.md}` | 12px | Buttons, form fields |
| `{rounded.lg}` | 16px | Cards, nav bars |
| `{rounded.xl}` | 24px | Modals, hero panels |
| `{rounded.full}` | 9999px | Avatars, switches, pill badges |

Do not use square corners (0px) anywhere in the system. Do not mix more than 2 border radius levels within the same component.

## Components

### Buttons

**`button-primary`**
- Background `{colors.primary}`, text `{colors.on-primary}`, weight 600, padding `10px 20px`, rounded `{rounded.md}`.
- Hover -> `button-primary-hover` (background `{colors.primary-hover}`, `translateY(-1px)`); active -> `button-primary-active`; disabled -> `button-disabled`.

**`button-secondary`**
- Background `{colors.secondary}`, text `{colors.on-secondary}` -- used for secondary actions (must not compete with the main CTA).

**`button-accent`**
- Background `{colors.accent}`, text `{colors.on-accent}` (dark text) -- highlights, do not use as a main CTA.

**`button-ghost`**
- Transparent background, border `{colors.hairline}`, text `{colors.ink}`.

**`button-disabled`**
- Background `#CFC7BF`, text `#7D736A` -- flat, non-interactive.

### Tags & Badges

**`badge-tag`**
- Background = brand color diluted to 16-20% (`color-mix`), text = dark brand color, rounded `{rounded.full}` (pill shape).

### Inputs & Forms

**`text-input`** + **`text-input-focus`**
- Default: background `{colors.card}`, 1px border `{colors.hairline}`, rounded `{rounded.sm}`, padding `12px 14px`.
- Focus: border changes to `{colors.secondary}` with a blue glow (`--shadow-focus-blue`) -- this is the only focus signal in the system.
- Success/Error states: change border + text color to `{colors.success}` / `{colors.error}` accordingly.

### Cards

**`card`**
- Background `{colors.card}`, 1px border `{colors.hairline}`, rounded `{rounded.lg}`, padding `24px`, no default shadow.

### Navigation

**`nav-bar`**
- Background `{colors.card}`, rounded `{rounded.md}`, `--shadow-sm`.
- Active links feature a `{colors.primary}` underline; language switcher acts as a pill.

### Footer

**`footer-section`**
- Background `{colors.surface-soft}`, text `{colors.mute}`, 4-column layout (logo/description + 3 link groups), social bar in the middle, copyright bar at the bottom.

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` for the single main CTA per screen -- do not place two red buttons next to each other.
- Use `{colors.secondary}` (blue) for focus rings -- this is the single consistent focus signal across the entire system.
- Keep default cards/sections flat (hairline only), only adding shadows when the surface is actually elevated.
- Always round corners (8-24px depending on component) -- absolutely no square corners.

### Don't
- Don't use `{colors.accent}` (gold) for the main CTA -- it should only serve as a secondary highlight.
- Don't add shadows to static sections or page backgrounds.
- Don't mix more than 2 border radius levels within a single component.
- Don't use white text on a `{colors.accent}` background -- contrast will fail, always use `{colors.on-accent}`.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| mobile | < 768px | Hero 60px->36px; cards 1-up; nav collapses into a hamburger drawer, keeping the red CTA prominent |
| tablet | 768-1023px | Cards 2-up; nav remains horizontal |
| desktop | ≥ 1024px | Cards 3-up on the same row |

### Collapsing Strategy
- **Nav:** horizontal row desktop/tablet -> hamburger drawer mobile.
- **Card grid:** 3-up -> 2-up -> 1-up at 1024px and 768px.
- **Footer:** 4 columns -> 2 columns -> 1 column when narrowed.

## Known Gaps

- **Hover state for `button-secondary`/`button-accent`** lacks specific color values -- currently utilizing the same darken logic as `button-primary`.
- **Dialog/modal styling** is not fully documented beyond the defined `{rounded.xl}`.
- **The `pill-tab` (segmented control) component** is missing in the original `preview.html` -- needs to be added if the Portal includes tabbed filtering.
