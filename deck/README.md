# Design Fleet / Shipyard deck

This directory is a self-contained, 12-slide static presentation about the
13-station Design Fleet and its original nine-station Shipyard workflow.
Content was refreshed against the repository on September 7, 2026.

The full roster shows each station's canonical model, family and explicit
reasoning level. Crew overrides may differ. Tests compare these labels with
`crews/roles.json` and the canonical agent definitions so future model changes
cannot silently leave the deck stale.

The deck also covers the shared delivery contract, spec-driven assets,
current PR media and watch-state rules, and a dashboard walkthrough. The
dashboard screenshot uses synthetic sample data, not live performance or
private project/account details. Undated cost figures and the old PR-throughput
case study were removed because their supporting evidence is not in this repo.

Slide 5 rebuilds the app's Pipeline layout as native HTML cards and feedback
routes with SVG connectors, not a screenshot. Labels are selectable text and
the illustration follows the presentation's light/dark theme. It works without
the dashboard server, a framework or a build step.

### Edit the Pipeline

- **Cards, models and feedback:** edit slide 5 in `index.html`.
- **Positions:** edit a card's `--x` / `--y` values, in the app's 1216-wide
  coordinate space. Connectors follow the actual ports automatically.
- **Handoffs:** edit SVG path `data-source` / `data-target` values as
  `node-id:port-name`. `data-kind` controls solid versus dashed lines.
- **Appearance:** edit `pipeline.css`; the native Asta Sans font and Fluent icon
  sprite are bundled locally with their licenses.

`pipeline.js` only draws the connection geometry and decorative ports/handles.
The handles preserve the app's appearance; this is an editable source document,
not a drag-and-drop authoring application. Long role and feedback labels wrap
rather than becoming permanently truncated pixels. Tests compare native cards,
model defaults, positions, handoffs and feedback routes with the app sources,
so intentional app changes need corresponding deck edits rather than a recapture.

Design decisions, the token set, the motion rules and the traps this deck has
already sprung on someone are in **[DESIGN.md](DESIGN.md)**.

## Host it

Use this directory as the site root on any static host:

- **Build command:** none
- **Publish directory:** `.`
- **Entry point:** `index.html`

If the host expects a running process instead, select Node 20 or newer and use:

```bash
npm start
```

The included server listens on `PORT` and `HOST` when the platform supplies them.
It has no package dependencies and sends `no-store` responses.

## Run locally

```bash
cd deck
npm start
```

Open <http://127.0.0.1:8099>. For loopback-only hosting, use
`HOST=127.0.0.1 npm start`. Run `npm test` to check assets, the slide count,
all thirteen model assignments, the nine workflow labels and stale claims.
The server needs no package installation.

The model roster is slide 3 (`#3`); Pipeline is slide 5 (`#5`); the dashboard showcase is slide 11 (`#11`).
The deck uses a black, white and grey palette throughout, including the native
Pipeline and grayscale artwork/dashboard illustration. It follows the device's
light/dark mode, or accepts `?theme=light` / `?theme=dark`. Older
`?clawpilotTheme=light` / `dark` links remain compatible but use the same
monochrome palette. Original image assets are preserved; grayscale is applied
at display time.

## Controls

| Input | Action |
| --- | --- |
| `→`, `↓`, space, `PageDown` | Next slide |
| `←`, `↑`, `PageUp` | Previous slide |
| `Home` / `End` | First / last slide |
| `R` (or `r`) | Return to the first slide |
| `F` | Toggle fullscreen |
| Click | Left third goes back; elsewhere goes forward |

The current slide is stored in the URL hash, so `#4` links directly to slide 4.
Motion respects `prefers-reduced-motion`.
Browser reload shortcuts such as Cmd+R and Ctrl+R are left unchanged.
Restart also works while a link or button has focus; typing in form fields or
editable content is left alone.

## Fonts

The presentation retains its serif display typography and uses Segoe UI with
Aptos, Calibri and platform fallbacks for body text. The native Pipeline uses
locally bundled Asta Sans (`fonts/AstaSans-OFL.txt`); the dashboard screenshot
also shows Asta Sans. No external font service is required. Pipeline icons are
exported from the app's Fluent icon package (`Fluent-icons-LICENSE.txt`).

This is a local HTML refresh. The historical Figma presentation was not changed
and is no longer claimed to match slide-for-slide.
