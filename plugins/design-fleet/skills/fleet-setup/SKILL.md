---
name: fleet-setup
description: Set up, configure, and personalise the design fleet — connect it to the repository, Figma file and design system you are working on, choose which of the thirteen stations you want, and rename the whole crew to a theme of your choosing (Shipyard, Avengers, Flintstones, plain English, or your own). Use when the user says 'set up the fleet', 'configure design-fleet', 'set up my design agents', 'rename the fleet', 'change the crew', 'which agents do I have?', 'connect the fleet to this repo', or has just installed the design-fleet plugin. Do not use for running design work — that is the individual stations.
---

# Fleet setup

This is the setup station. It connects the fleet to **what you are working on**, and lets you
name the crew whatever you like.

Two things get created:

1. **`.copilot/design-fleet.json`** — the config every station reads: your repo, your Figma file,
   your design system, your gate commands.
2. **Your renamed agents** — personalised copies of the thirteen stations, written as plain
   markdown files you own and can edit.

The plugin's own stations are always available as `design-fleet:designr`, `design-fleet:surveyor`
and so on. Setup gives you shorter, personal names on top — `stark`, `wanda`, or whatever you pick.

---

## Step 0 — find the tools

The scripts live inside the installed plugin. Locate them first:

```bash
FLEET=$(dirname "$(dirname "$(find ~/.copilot/installed-plugins -name fleet.py -path '*design-fleet*' 2>/dev/null | head -1)")")
echo "$FLEET"
```

If that is empty, the plugin is not installed — tell the user to run
`/plugin marketplace add mbugua-j/design-fleet` then `/plugin install design-fleet@mbugua-j`,
and stop.

---

## Step 1 — check what is connected

Do not promise a station that cannot run. Check, and report honestly.

```bash
copilot mcp list 2>/dev/null
gh auth status 2>&1 | head -3
```

Map what you find to what the stations need:

| Capability | Needed by | If missing |
|---|---|---|
| `figma-console` MCP | designr, engraver, draftsman; design-review when the artifact is in Figma | Figma-backed work cannot run. Design-Review can still evaluate supplied screenshots or artifacts through its bundled method skill. |
| `playwright` MCP | lookout | Browser verification cannot run. |
| `gh` authenticated | herald, buildr, watchkeeper | Pull-request stations cannot run. |

Report the result as a short list of ✅ / ❌ before asking anything else. If something is missing,
say exactly which stations are affected — then carry on. A partial fleet is fine; a fleet that
lies about being ready is not.

### Offer to connect what is missing

Ask before running any of these — never modify a user's MCP config unprompted, and never touch a
server that is already configured and working.

```bash
# Browser verification (no credentials needed)
copilot mcp add playwright -- npx @playwright/mcp@0.0.82

# Figma — needs the user's own personal access token
export FIGMA_ACCESS_TOKEN=...   # in their shell, not in this chat
copilot mcp add figma-console --env FIGMA_ACCESS_TOKEN="$FIGMA_ACCESS_TOKEN" -- npx -y figma-console-mcp@1.40.0
```

Pin the versions. `@latest` means a future release of a third-party package runs on their machine
with their Figma token, unreviewed. Check the current version first and pin what you verified:
`npm view figma-console-mcp version`.

Handling the token — say all of this plainly, because most of it is not obvious:

- The token comes from Figma → Settings → Security → *Personal access tokens*. Ask for the
  **narrowest scopes** that work: file read, and variables read only if the design system needs it.
- **Never ask the user to paste a token into the chat**, and never write one into any file in the
  repository.
- Have them run the command **themselves, in their own terminal**. A token typed on a command line
  lands in shell history; exporting it first, as above, avoids that.
- `copilot mcp add --env` stores the value in **`~/.copilot/mcp-config.json` in plain text**. Tell
  them that is where it lives, so they can rotate or remove it.

The Figma stations also need the **Figma Desktop Bridge plugin running** in the Figma desktop app —
the MCP server alone is not enough. Say so, because it is the most common reason a Figma station
reports that it cannot connect.

### Confirm it actually works, not just that it is configured

`copilot mcp list` shows what is *configured*, which is not the same as reachable. Before promising
a station will run, have the user confirm the Figma Desktop Bridge is running and the file is open.
If a station later reports it cannot connect, that is the first thing to check.

---

## Step 2 — ask what they work on

Use the **`ask_user` tool** — one form, not a series of chat questions. Ask only what you cannot
detect. Detect first:

- Repository: `git remote get-url origin` and `gh repo view --json nameWithOwner`
- Gate commands: read `package.json` scripts, or the project's Makefile / CI config
- Dev server URL: look for a `dev` script and its configured port

Then ask for what you genuinely cannot know:

| Field | Type | Notes |
|---|---|---|
| `whatYouDo` | enum | Product design · Design system · Both · Mostly research and docs |
| `figmaFileKey` | string | From the Figma URL: `figma.com/design/**FILEKEY**/…`. Blank if not using Figma. |
| `designSystem` | enum | Fluent 2 · Material 3 · Our own · None yet — the name is used in critique and specs |
| `componentLibrary` | string, optional | The implementation library, when it is distinct from the design system name |
| `accessibilityTarget` | enum | WCAG 2.2 AA · WCAG 2.2 AAA · Not enforced |
| `uxDesignSystem` | string, optional | Project-relative path written to `guidance.uxDesignSystem` |
| `accessibility` | string, optional | Project-relative path written to `guidance.accessibility` |
| `figmaAuthoring` | string, optional | Project-relative path written to `guidance.figmaAuthoring`; only activated for Figma-backed design/authoring work |
| `defaultDeliveryIntent` | enum, optional | `ask` · `prototype` · `production-ready` |
| `crew` | enum | Shipyard · Plain English · Avengers · Flintstones · Custom |
| `scope` | enum | This project only · All my projects |

Show what you detected as the defaults, so the user is confirming rather than typing.

The optional guidance files contain direct project-specific behaviour using **MUST**, **SHOULD**
and **MAY**. They are not copies of standards and not pages made only of links. Ground them in the
project's actual components, tokens and interaction conventions. `guidance.figmaAuthoring` is the
finite opt-in for repository-owned Figma workflow instructions; do not discover substitutes by
scanning for filenames. When a guidance key is absent, stations continue with the shared
`design-fleet.ui-delivery/1` baseline rather than treating the missing file as permission to skip
the subject.

---

## Step 3 — choose the crew

```bash
python3 "$FLEET/bin/fleet.py" crews
python3 "$FLEET/bin/fleet.py" show --crew avengers
```

Show the user the mapping **before** writing anything.

If they chose **Custom**, do not hand-write JSON. Use the `new-crew` command, which validates the
result and saves it to `~/.copilot/design-fleet/crews/` — outside the plugin, so a plugin update
cannot delete it.

Propose thirteen names first (their team, a film, whatever theme they gave), show the list, get
approval, then:

```bash
python3 "$FLEET/bin/fleet.py" new-crew --name <theme> --label "<Theme>" \
  --set designr=<Name> --set engraver=<Name> \
  --set design-review=<Name> --set contrarian=<Name> --set scribe=<Name> \
  --set draftsman=<Name> --set envoy=<Name> \
  --set shipwright=<Name> --set surveyor=<Name> --set lookout=<Name> \
  --set herald=<Name> --set buildr=<Name> --set watchkeeper=<Name>
```

If the user would rather name them one at a time, tell them to run it in their own terminal without
`--set` — it prompts for each station, showing what that station does and offering the default:

```bash
python3 "$FLEET/bin/fleet.py" new-crew --name <theme>
```

Names must be distinct and may use letters, digits, hyphens, dots and underscores — no spaces.
**Start each name with a capital letter**, so it reads properly in the desktop app's agent picker.

Tip worth telling the user: cute names are fun for one person, but **plain English wins the moment
someone else joins**. `Browser-Verifier` needs no explanation; `Barton` does.

---

## Step 4 — choose the stations

List them and let the user pick:

```bash
python3 "$FLEET/bin/fleet.py" stations
```

Sensible starting sets:

- **Design only** — `designr,design-review,contrarian`
- **Design and hand off** — add `draftsman,scribe,envoy`
- **The whole yard** — all thirteen

Do not install stations whose tools are missing. Say which you skipped and why.

---

## Step 5 — write the config

Write `.copilot/design-fleet.json` in the project root (or `~/.copilot/design-fleet.json` for
all projects). **Every station reads this file**, project first, then user-level as a fallback.

```json
{
  "version": 1,
  "crew": "avengers",
  "project": {
    "name": "Acme Console",
    "repo": "acme/console",
    "upstream": "acme/console",
    "baseBranch": "main",
    "branchPrefix": "design/"
  },
  "design": {
    "figmaFileKey": "YOUR_FIGMA_FILE_KEY",
    "designSystem": "Fluent 2",
    "componentLibrary": "Fluent UI React",
    "accessibilityTarget": "WCAG 2.2 AA",
    "tokenCollection": "Global",
    "tokenNaming": "fluent",
    "wireframePage": "Wireframes",
    "iconSpecPage": "Icons",
    "iconSourceNode": "1:234",
    "targetPlatforms": ["windows", "ios", "android"],
    "assetOutputDir": "assets/icons"
  },
  "guidance": {
    "uxDesignSystem": "docs/instructions/ux-design-system.md",
    "accessibility": "docs/instructions/accessibility.md",
    "figmaAuthoring": "docs/instructions/figma-authoring.md",
    "defaultDeliveryIntent": "ask"
  },
  "app": {
    "devUrl": "http://localhost:5173",
    "startCommand": "npm run dev",
    "previewPort": 7979
  },
  "gates": ["npm run lint", "npm run typecheck", "npm test"],
  "docs": {
    "specsDir": "docs/specs",
    "componentDocsDir": "docs/components",
    "voice": "plain, second person, no exclamation marks"
  },
  "deck": {
    "brand": "Acme",
    "template": "acme-2026.pptx",
    "outputFormat": "pptx"
  },
  "stakeholders": {
    "audience": "product leadership",
    "cadence": "weekly, Thursday"
  },
  "preview": {
    "include": [12, 14, 15],
    "authors": ["your-github-handle"]
  },
  "watch": {
    "scope": "authored-by-me",
    "statePath": ".copilot/design-fleet-watch.json",
    "everyMinutes": 30
  }
}
```

Only include keys you actually established. **An invented Figma key or a guessed gate command is
worse than an absent one** — a station will act on it. A station that finds a key missing is
instructed to ask rather than guess, so leaving one out is safe; making one up is not.

Guidance paths are optional. Validate every configured value as a project-relative path to a
readable project file containing direct MUST/SHOULD/MAY instructions rather than copied standards
or link-only summaries. A configured `guidance.figmaAuthoring` path may explicitly link relative
supporting documents; DesignR reads those before its first Figma call. Resolve the configured path
inside the selected project root and linked paths relative to their containing documents. Reject
absolute paths, `..` escapes, and symlinks whose real paths escape the project. Linked traversal
uses a visited set of real paths and stops on cycles or beyond depth 4 (configured document at depth
0). Preserve the concrete missing, unreadable, escape, cycle, or depth-limit error and offending
path or reference chain. The key is not activated for backend or code-only work, and its absence
leaves the shared baseline in force.

The shared UI delivery contract consumes these fields; setup records them but does not preload or
execute that contract. Project Figma instructions refine the station but cannot authorize
self-review, bypass target ambiguity, mutation without bridge/file identity, a change to station
ownership or evidence boundaries, scanning for other Figma files, or inferring skill names.
`guidance.defaultDeliveryIntent` is only a default; explicit task context still decides whether a
piece of UI is a prototype or production-ready, and `ask` means the fleet must resolve that intent.

`preview.include` and `preview.authors` matter for safety, not just convenience: BuildR merges and
**executes** those pull requests on this machine. Leave the scope narrow.

`watch.everyMinutes` records the cadence the user **wants** Watchkeeper to run at. Writing this
field does nothing by itself — it is not read by anything that creates a schedule, and it is not
reconciled automatically if the user changes it later. It only becomes real in Step 5a.

`watch.statePath` is local operational state, not configuration to initialise during setup.
Watchkeeper uses the bundled `bin/watch.py` and `docs/watch-state.md`: an explicit complete
first-run baseline, read-only plans, and receipt-backed commits. Do not touch existing state or
point this at another tool's watch file. Legacy/corrupt/unreadable files require the documented explicit
new-path recovery, never automatic history reset. Keep state, lock and snapshot/receipt artifacts
out of source control; do not run a baseline merely to test setup.

---

## Step 5a — schedule Watchkeeper (optional, opt-in only)

Watchkeeper does not run on its own. Nothing in this skill, the plugin, or the config you just
wrote puts it on a timer — the CLI has no mechanism that does that by itself. If the user wants
`watchkeeper` to actually wake periodically, they create the schedule themselves with the CLI's
native `/every` command:

```
/every 30m design-fleet:Watchkeeper, check for review comments and merge conflicts
```

Match the interval to `watch.everyMinutes` in the config you just wrote — the config only records
the intent, so this is the step that makes it real. Points worth telling the user:

- **This is their call, not yours.** Never run `/every` on their behalf without asking; say what
  it does and let them type it, since it starts recurring behaviour in their session.
- **`/every` is an experimental CLI feature.** If it's not recognized, they enable it with
  `/experimental`, then retry `/every`. If it's still unavailable after that, the fix is to update
  the CLI and invoke `watchkeeper` directly in the meantime — it works fine unscheduled.
- `/every` with no arguments lists and manages existing schedules, so they can check what is
  running or stop one later.
- The schedule lives in **this CLI session**, not in the repo or the plugin. It does not survive
  switching sessions, and reinstalling or updating the plugin has no effect on it either way.
- If they later edit `watch.everyMinutes`, the running schedule keeps its old interval until they
  stop it and create a new one to match.

If they decline, say so and move on — Watchkeeper still works fine invoked directly, just not
unattended.

---

## Step 6 — write the agents

```bash
# Preview first
python3 "$FLEET/bin/fleet.py" apply --crew avengers --scope project --dir . --dry-run

# Then for real
python3 "$FLEET/bin/fleet.py" apply --crew avengers --scope project --dir .
```

- `--scope project` writes to `.github/agents/` — travels with the repo, so the team gets it too.
- `--scope user` writes to `~/.copilot/agents/` — follows you across every project.
- `--stations a,b,c` writes a subset.
- Existing files are **never overwritten** without `--force`, so a station you have refined by hand
  is safe.
- Generated copies preserve each canonical agent's `skills:` declaration. Relevant UI stations
  therefore preload `ui-delivery-guardrails` without making this setup skill depend on it.

---

## Step 7 — confirm it actually worked

Do not declare success without checking:

```bash
ls .github/agents/          # or ~/.copilot/agents/
```

Tell the user to run `/agent` to see the new names, and that project-scope agents need
`/add-dir <project>` or a restart to load.

### Check for duplicates

Renaming writes new agents; it does not remove ones already present. Because the desktop app hides
the `design-fleet:` prefix, a plugin station and a personal agent of the same name look identical
in its picker.

```bash
ls ~/.copilot/agents/ 2>/dev/null
ls .github/agents/ 2>/dev/null
```

If a role appears twice, offer to move the unwanted copy out of the folder rather than deleting it:

```bash
mkdir -p ~/.copilot/design-fleet/agents-backup
mv ~/.copilot/agents/<name>.agent.md ~/.copilot/design-fleet/agents-backup/
```

**Never delete a user's agent file outright** — they may have refined it, or it may carry
project-specific knowledge the generic station does not have. Always move, always say where to.

Then tell them to **restart both the CLI and the desktop app**, since both cache the agent list.

Finally, show them the roster you actually created — station, new name, and what to say to call it.

---

## Refining a station later

This is the part worth saying out loud, because it is the whole point of the design:

> Every station is a markdown file. Open it, edit the prose, save. That is the entire workflow —
> no rebuild, no reinstall. Your fleet gets sharper every time a station gets something wrong and
> you write down what it should have done instead.

- Plugin originals: `$FLEET/agents/*.agent.md` — replaced on plugin update.
- Your copies: `.github/agents/` or `~/.copilot/agents/` — **yours**, never overwritten.

Refine the copies. To share an improvement with everyone, open a pull request against the
canonical file in the repo. Universal UI rules belong in `ui-delivery-guardrails`; a personalised
agent that declares that skill receives contract updates when the plugin updates without replacing
the agent file.
