# Design Fleet Dashboard

The dashboard is a local observability and configuration surface for the
design-fleet plugin.

## What it shows

- Fleet station health
- Smooth shimmer skeletons and staggered panel reveal during initial loading
- Configured models and recent model responsiveness
- Latest detected smoke-test batch
- Active, stalled, and recent station runs with configurable live updates
- Activity grouped by repository
- Pull requests created through Herald's local `gh pr create` runs
- GitHub and Enterprise Managed User account status and avatar
- A standard Fluent spinner during the initial sign-in check, respecting reduced motion
- Local crew naming and installation
- Persistent per-agent model overrides for personalized crews
- Multiple named fleet instances across discovered installed providers
- Searchable fleet switching with provider metadata, creation, rename, and guarded deletion
- Agent-only AI credits and dollar consumption equivalents
- A guarded portal command runner with project, agent, model, and credit limit
- A live Trello-style handoff board with drag-and-confirm agent handoffs
- Hidden projects and orphaned unknown-project records excluded from the Board,
  Activity, and active-process lists
- Retry controls for failed or cancelled board tasks
- A canonical Pipeline page with forward delivery and separate feedback routes
- A separate live Activity page beneath Handoff board
- Embedded main-content Settings with General, Appearance, Projects, and Agents sections
- Browser-persisted auto-refresh intervals of 5, 10, 30, or 60 seconds (default 5)
- Station-card Change model actions that focus the selected agent's model field
- System, Light, and Dark appearance modes
- Standard Fluent light and dark themes
- Hamburger navigation drawer on mobile and compact tablets
- A compact, connected summary strip with shared dividers and prominent values
- Overview heading with inline Run agent and Range controls, without a separate top toolbar
- Single-row station filters with horizontal overflow on compact screens and unclipped popup menus
- Non-searchable Fluent range dropdown with four fixed options
- Searchable Fluent comboboxes for filters, projects, agents, and models
- Reduced-motion-safe transitions for navigation, views, menus, tooltips, and dialogs
- Active and inactive project groups with live Copilot session branches
- Searchable project navigation with persistent hide and restore controls
- Responsive row-major station grid with up to five columns on wide screens
- Compact station search, family/health/activity filters, and sorting by cost,
  runs, success, latency, recency, model, family, health, or fleet order
- Model-health row actions for smoke testing, model replacement settings, and
  copying model IDs
- Actionable model-health tooltips and one background smoke suite for all
  configured models
- Unused models hidden by default with an explicit reveal toggle

## Design system

The dashboard uses the public Fluent UI React implementation:

- `@fluentui/react-components` for Button, Card, Badge, Select, Input, Dialog,
  typography, focus management, and design tokens
- `@fluentui/react-icons`, generated from Microsoft's Fluent UI System Icons
- Standard `webLightTheme` and `webDarkTheme` tokens for colors and typography
- Fluent Card elevation tokens rather than custom widget shadows
- System, Light, and Dark appearance modes

The handoff board treats each parent Copilot session as a task card. The card
moves to the most recently launched station and keeps the full observed trail
returned by telemetry, without truncating the card's content.
Only running and stalled tasks appear by default; **Show task history** includes
finished and unknown tasks from the selected range. Dragging a card to another
station, choosing an agent from the card's handoff menu, or retrying a failed task
opens the guarded command dialog. After confirmation, the new run stays grouped
with the existing task.

On desktop, use the Board's left/right buttons, a horizontal trackpad gesture, or
Shift+wheel to reach more agents. Focus the Board itself to use Left/Right and
Home/End. Column bodies retain their independent vertical scrolling; compact
screens stack the columns vertically.

Changing the range immediately starts a new request and shows an updating status
while retaining the previous data. On Overview, the status crossfades in place of
the heading subtitle and restores it when loading finishes, without moving the
heading. Reduced-motion preferences disable the fade. Background polls wait for an in-flight request
instead of repeatedly cancelling slow responses. Project visibility preferences
remain scoped to the account and browser origin; hiding never deletes source history.

The separate Pipeline page shows the delivery crew's topology, including
Watchkeeper, pull request delivery, BuildR and the combined preview, with
blocking feedback routes beneath it. The deck uses an editable, monochrome
version of this same layout. The Activity page keeps the full recent-run list
out of the Overview page.

## Run it

From the repository:

```bash
python3 plugins/design-fleet/bin/fleet.py dashboard
```

The command opens `http://127.0.0.1:8100`. To choose another port or prevent
the browser from opening:

```bash
python3 plugins/design-fleet/bin/fleet.py dashboard --port 8110 --no-open
```

After installing the plugin, ask Copilot:

```text
open the fleet dashboard
```

The bundled `fleet-dashboard` skill resolves the installed plugin path and
starts the same command.

## Authentication

The dashboard remains hidden until GitHub CLI reports an active, successfully
authenticated GitHub or Enterprise Managed User account. Sign-in uses the
official `gh auth login --web` browser flow.

Users can sign out an account from the account dialog after confirming the
action. Sign-out removes that account from GitHub CLI on the local machine; it
does not revoke the token. Signing out the final account returns the browser to
the sign-in screen.

### Account isolation

Every fleet-data request includes the browser's selected `host/login`, which
the server checks against the active GitHub CLI identity. Inactive sign-ins do
not grant access. Switching accounts clears the view and reloads account context;
responses from the previous account are discarded. Fleet selection, hidden
projects, and cleared-activity preferences use account-specific storage keys.

Plugin installations and historical telemetry are stored in a local Copilot
profile, not installed separately by `gh auth switch`. The dashboard binds a
single-account profile to its Copilot identity in
`fleet-dashboard/account.json` under `COPILOT_HOME` (default `~/.copilot`).
Only enabled plugin installation records in that profile are exposed to its
owner. Other GitHub accounts see **No fleet for this account**, with no provider
paths, agents, projects, histories, crews, or jobs from the original profile.
The same restriction applies to direct API reads and writes.

Existing history is never reassigned to whichever GitHub account opens the page.
Missing identity metadata and profiles listing multiple Copilot accounts fail
closed. If a bound profile later changes Copilot identity, its history is
quarantined rather than transferred. Use separate account-specific profiles and
point the dashboard at the intended profile with `COPILOT_HOME`; merely switching
GitHub CLI accounts does not migrate or install a fleet. Do not remove the
ownership marker to reuse mixed history.

Dashboard account changes wait until dashboard-launched jobs finish, so queued
work cannot silently run under a newly selected GitHub identity. External CLI
account changes are detected on subsequent dashboard requests; this local
dashboard is not an operating-system security boundary.

## Development

```bash
cd plugins/design-fleet/dashboard
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm test:pipeline
corepack pnpm test:server
corepack pnpm test:accounts
corepack pnpm build
python3 server.py
```

Corepack reads the pinned pnpm version from this directory's `package.json`.
Keep lockfile verification enabled when updating dependencies.
Registry packages are locked by version and content integrity, without
machine-specific mirror tarball URLs. This lets local development use its
configured registry mirror while CI uses npm's public registry; both retain
pnpm's metadata and integrity verification.
`pnpm-workspace.yaml` explicitly denies esbuild's install script; the supported
platform packages supply the binary used by the build and tests. Other dependency
scripts still require an explicit decision rather than being approved wholesale.

The built `dist/` directory is committed because plugin users should not need
Node.js dependencies to run the dashboard. The runtime server and telemetry
collector use only the Python standard library.

## Data sources

The dashboard reads local metadata only:

- `~/.copilot/session-store.db` for model usage, latency, and project sessions
- `~/.copilot/session-state/*/workspace.yaml` and live `inuse.*.lock` files for
  currently running project sessions
- `~/.copilot/session-state/*/events.jsonl` for task launches, station
  attribution, smoke tests, process lifecycle, and Herald PR commands
- `~/.copilot/data.db` for desktop agent sessions where available
- the selected provider's validated station manifest, agent directory, and crew
  files
- `gh auth status --json hosts` for account status

Historical prompt and response content are not displayed. A command launched
explicitly from the portal can show its own final output to the initiating user.
The dashboard binds only to `127.0.0.1`, sends no telemetry, and does not expose
GitHub tokens.

The telemetry endpoint is polled while the page is visible, using the interval
chosen in Settings > General > Auto-refresh (five seconds by default).
Changing the telemetry range refreshes immediately, independent of that interval.
Event-log parsing is incrementally cached, active sessions are resolved from
live process IDs instead of scanning every historical session directory, and
the React client preserves stable object references so unchanged cards remain
mounted while changed values update in place. Production assets are served with
gzip compression and immutable caching for content-hashed bundles. Polling
pauses while account management is open or the browser tab is hidden. It
continues while a portal-launched command is running so process and handoff
status can move live.

Choose Change model from a station card to open Settings > Agents focused on
that station's model field, then use Save crew or Save and install. Providers
with fixed models retain name configuration instead. Saving refreshes the
dashboard in its selected range but never starts a paid smoke test. Smoke tests
run only through the explicit Run smoke test action and its confirmation and
credit controls.

## Multiple fleet providers

The dashboard loads its bundled provider and discovers other installed plugins
that contain a versioned `fleet.manifest.json`. It searches only
`$COPILOT_HOME/installed-plugins/` and `$COPILOT_HOME/plugins/`; it never scans
the whole home directory. See
[`../FLEET_PROVIDER.md`](../FLEET_PROVIDER.md) for the schema and authoring
contract.

Every provider receives a deterministic default fleet instance. The Fleet
combobox can switch between those instances or create additional named
instances from any discovered provider. The active fleet id is stored in browser
local storage; the instances themselves are persisted atomically at:

```text
$COPILOT_HOME/fleet-dashboard/fleets.json
```

Provider roots, roster paths, agent directories, crew directories, and optional
entrypoints come only from validated installed manifests. All paths must resolve
inside the provider root. API callers send a fleet id, never a filesystem or
executable path. Removed or invalid providers and their persisted instances are
reported as unavailable instead of being treated as the bundled fleet.

## AI credits and spend

Copilot records usage in nano-AI units. The dashboard converts these to AI
credits by dividing `total_nano_aiu` by 1,000,000,000. It displays a dollar
consumption equivalent at $0.01 per AI credit.

That dollar figure is not an invoice. Organization and enterprise included
credits are pooled before overage is charged, and the local session store does
not contain the billing pool allocation.

The dashboard reads local usage receipts, not an organization's external billing
reports. It does not retrieve billing-pool allocations or scrape private reports.

## Running agents

The Run agent dialog uses Copilot CLI non-interactive mode with:

- A selected local project checkout
- A selected fleet station
- A per-run model override
- A maximum AI-credit limit from 30 to 1,000 credits, matching the Copilot CLI
  minimum
- Explicit confirmation that the station's tools will be auto-approved

It does not pass `--allow-all-paths`. The selected agent may still modify files
or run commands from the checkout, so prompts should be treated like terminal
instructions.

## Agent model overrides

Settings > Agents can save a model for each station in a personalized crew.
Only values that differ from the shipped role are stored as overrides. Applying
the crew writes local agent files and leaves the canonical plugin station
unchanged.

## GitHub and EMU authentication

The dashboard launches the official GitHub CLI browser flow:

```bash
gh auth login --hostname github.com --web
```

Managed users authenticate through their enterprise identity provider. An
enterprise using GitHub data residency can enter its GHE.com hostname. The
dashboard can show and switch accounts, but it never asks for or reads a token
or password.

## Limits

- Historical station attribution depends on local event logs still being
  present.
- Herald statistics count successful local `gh pr create` commands attributed
  to Herald. Pull requests created elsewhere are not claimed as Herald work.
- A model is marked down only when a detected smoke test fails or completes
  without a model call. Lack of recent use is shown as untested, not down.
- Successful activity older than 24 hours is shown as **Test recommended**, not
  as a failure. Models not assigned to a current station are shown as
  **Not assigned** and are excluded from the batch smoke suite.
- Running state is inferred from local lifecycle events. An old unclosed run is
  shown as stalled or unknown rather than falsely reported as active.
- User-created fleet instances can be renamed and deleted; default instances
  cannot be deleted.
- Instances backed by the same provider share that provider's telemetry cache;
  dashboard-launched jobs remain isolated by fleet id.
- Historical local telemetry recorded before fleet ids is associated only with
  a provider's deterministic default instance.
