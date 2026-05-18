# Content brief: Paws & Paths "Meet your walker" section

Build a single HTML page (`page.html` + `style.css`) that implements the
**top section** of the Paws & Paths landing page. Stay strictly inside the
tokens and components declared in `DESIGN.md`.

## Required content (in order)

1. **Hero**
   - Eyebrow label: `TRUSTED PET CARE`
   - Headline (display token): `Walks that wag tails.`
   - Body (body-lg token): `Book a vetted local walker in under a minute.
     Live GPS, photo updates, and a dog who comes home tired and happy.`
   - Two buttons side-by-side:
     - Primary: `Find a walker`
     - Secondary: `How it works`

2. **Walker profile card** (component: `card-profile`)
   - 64×64 circular avatar placeholder (solid `primary-container` fill, no image needed)
   - Walker name (title-lg): `Mia Carter`
   - Sub-line (body-md, on-surface-variant): `Certified walker · Berkeley`
   - Status badge (component: `badge-status`): `Available today`

3. **Stat cards row** (component: `card-walk-stat`, two cards side-by-side)
   - Card A: big number `247` (headline-lg) + label `Walks completed`
   - Card B: big number `4.97` (headline-lg) + label `Average rating`

## Layout constraints

- Fixed centered container, max-width 720px on desktop, full-bleed below 640px
- Vertical rhythm: `spacing.lg` between hero / profile / stats sections
- Profile card and each stat card use the radii declared in DESIGN.md for
  their respective component
- The whole page sits on `colors.background`; cards lift onto the surface
  tints declared in DESIGN.md
- Font: load Plus Jakarta Sans from Google Fonts (weights 400 / 600 / 700 / 800)

## Out of scope

- Footer, navigation, additional sections
- JavaScript / interactivity
- Hover / focus states (CSS-only ok if you choose, not graded)
- Dark mode
