# design-fleet

**A fleet of design agents for GitHub Copilot CLI.**

Thirteen stations that take design work from a rough idea to something shipped — where no station
is allowed to approve its own work.

See [CHANGELOG.md](CHANGELOG.md) for released versions, changes and upgrade notes.

---

## The idea

One agent is not bad at the work. It is just **alone**.

A single agent designs the screen, critiques the screen, and declares it done — inside one context,
on one model, with one notion of finished. Every one of those is the same judgement wearing a
different hat.

So this fleet splits them apart:

- The station that **makes** the thing is never the station that **judges** it.
- The judging stations run on a **different model family** from the making stations, because a blind
  spot travels with a family. Put the reviewer on the same one as the maker and it will agree with
  the mistake it was hired to catch.
- Checking stations are **denied the edit tool** in their configuration, so for most of them the
  separation is enforced rather than merely instructed. See
  [How far the separation actually goes](#how-far-the-separation-actually-goes) — it is not absolute,
  and the exceptions are listed.
- A checking station is instructed to **send the work back**, and not to file over an unaddressed
  finding. This part is a **workflow convention carried in the prompts**, not something the code can
  enforce — see the same section.

> **Nobody signs off their own work.**

---

## See how the fleet works

The [Shipyard presentation](deck/) is packaged as a self-contained static site.
It covers all thirteen stations and their default models, the original nine-station
Shipyard workflow, the shared delivery contract, and a dashboard walkthrough
showing how to inspect the fleet and take action.

Deploy the `deck/` directory directly on a static host, or run it with:

```bash
cd deck
npm start
```

---

## Install

In Copilot CLI:

```
/plugin marketplace add mbugua-j/design-fleet
/plugin install design-fleet@mbugua-j
```

Or from your terminal:

```bash
copilot plugin marketplace add mbugua-j/design-fleet
copilot plugin install design-fleet@mbugua-j
```

Then restart and check it landed with `/agent`.

### Open the fleet dashboard

The plugin includes a local dashboard for station health, model responsiveness,
smoke tests, five-second activity updates by project, a live handoff board,
Herald pull-request counts, agent credit and dollar equivalents, GitHub account
switching, portal agent commands, crew naming and model overrides, and
embedded Settings with System/Light/Dark modes plus GitHub, Fluent, Midnight,
Forest, Sand, and Aubergine palettes. The main dashboard uses shimmer loading,
a searchable multi-fleet provider switcher, grouped projects, and a responsive
row-major station grid, plus station filters, model actions, a canonical
Pipeline page, and a separate Activity page below Handoff board.

Installed fleet plugins can join the dashboard by shipping the versioned
[`fleet.manifest.json` provider contract](plugins/design-fleet/FLEET_PROVIDER.md).
Users can keep multiple named instances of one provider; instance data lives at
`$COPILOT_HOME/fleet-dashboard/fleets.json`, outside plugin update directories.

From a clone:

```bash
python3 plugins/design-fleet/bin/fleet.py dashboard
```

After installing the plugin, tell Copilot:

```text
open the fleet dashboard
```

The dashboard opens on `http://127.0.0.1:8100` and reads local Copilot metadata.
It does not display prompt or response content, transmit telemetry, or handle
GitHub credentials. GitHub and Enterprise Managed User sign-in uses the
official `gh auth login --web` browser flow.

### Already installed? Update anytime

```bash
copilot plugin update design-fleet@mbugua-j
```

Restart the CLI and the desktop app afterwards — see [Keeping up to date](#keeping-up-to-date) for
what does and doesn't come along with an update.

### Works in the CLI *and* the desktop app

Plugins install into `~/.copilot/`, which the **GitHub Copilot desktop app** reads too — so the
stations appear in the app's agent picker (the **Default agent** dropdown next to the model
selector), not just in the terminal.

Two things worth knowing:

- **Restart the desktop app** after installing or renaming. It caches the agent list, so a station
  you just added will not appear — and one you just removed may linger — until it restarts.
- **The app hides the plugin prefix.** In the CLI a station is `design-fleet:DesignR`; in the app
  it is just `DesignR`. If you also have a personal agent of the same name in `~/.copilot/agents/`,
  the app will show **both, looking identical**. See [Avoiding duplicates](#avoiding-duplicates).

### Then set it up

```
set up my design fleet
```

That runs the **`fleet-setup`** skill, which:

1. Checks what you have connected (Figma, Playwright, GitHub) and tells you which stations can
   actually run.
2. Asks what you are working on — your repo, Figma file, design system, component library,
   accessibility target, optional project guidance paths (including repository-owned Figma
   authoring instructions), and default UI delivery intent — and writes it to
   `.copilot/design-fleet.json`.
3. Lets you **rename the whole crew** to whatever you like.
4. Writes your personalised agents as markdown files you own.

You can skip setup entirely and use the stations as they ship. Setup is what connects them to
*your* work.

Optional project guidance is configured separately from the design-system name:

```json
{
  "design": {
    "designSystem": "Fluent 2",
    "componentLibrary": "Fluent UI React"
  },
  "guidance": {
    "uxDesignSystem": "docs/instructions/ux-design-system.md",
    "accessibility": "docs/instructions/accessibility.md",
    "figmaAuthoring": "docs/instructions/figma-authoring.md",
    "defaultDeliveryIntent": "ask"
  }
}
```

Those files contain direct project-specific **MUST**, **SHOULD** and **MAY** behaviour grounded in
the components and tokens the project actually uses—not copied standards or link-only pages.
`guidance.figmaAuthoring` is read only for Figma-backed design or authoring work, before the first
Figma call. Its configured path and linked relative references must remain inside the selected
project root: absolute paths, `..` escapes, and escaping symlinks are rejected. Traversal tracks
visited real paths and stops on cycles or beyond four linked hops. A concrete containment or read
error stops that work. Project instructions cannot enable scanning for arbitrary Figma-named files
or inferring product-specific skill names. Stations keep the shared baseline when an optional key
is absent.

Stations resolve the project config first and use the user-level config only when it is absent.
For non-Figma project rules, pass the relevant repository instruction file explicitly in the task
or use the host's repository-instruction mechanism; putting a runbook anywhere in the repository
does not make the fleet load it. There is no generic `guidance.runbook` loader. Keep repository,
fork, gates, ports, widgets and delivery-ledger rules project-scoped rather than copying another
product's agent prompts into the canonical fleet.

### One shared UI delivery contract

`ui-delivery-guardrails` is the versioned, role-neutral contract shared by design,
specification, implementation, review, browser verification, documentation, challenge and PR
delivery. Its stable marker is `design-fleet.ui-delivery/1`. The nine UI delivery stations preload
it and keep their own role-specific enforcement and tool boundaries.

Personalised or local agents can receive the same universal updates without replacing their own
prompts. Add the skill to the agent front matter:

```yaml
skills: ['ui-delivery-guardrails']
```

If the agent already preloads another skill, keep both names in the list. Then run:

```bash
copilot plugin update design-fleet@mbugua-j
```

Restart the CLI and desktop app afterwards. The updated plugin skill is loaded the next time the
agent starts, while role-specific rules remain in the personalised agent and project-specific
rules remain in the configured guidance files.

---

## The thirteen stations

🔴 = instructed to **block** · ✏️ = can edit files · 👁 = denied the edit tool

### Make the thing

| Station | Model | What it does |
|---|---|---|
| **DesignR** ✏️ | gpt-6.1-sol | Three modes. **WIREFRAME** settles structure, semantic/task order, focus intent and every state in deliberate grey. **BRAINSTORM** builds several labelled Figma directions with the tradeoff stated under each. **RECREATE** turns a coded screen into editable, auto-layout frames with bound tokens. Presents options; **never picks the winner**. |
| **Engraver** ✏️ | claude-sonnet-5.5 | Cuts an icon into the full platform asset matrix — Windows tiles and altforms, Apple light/dark/tinted, Android adaptive. Reads every size **from the spec, never from memory**, and names any asset it could not cut. |

### Check it — cannot approve their own work

| Station | Model | What it does |
|---|---|---|
| **Design-Review** 🔴 👁 | grok-4.7 | Independent accessibility and usability review using public W3C/WAI references. **DESIGN REVIEW** examines designs before implementation; **HEURISTIC EVALUATION** accepts broader artifacts. Reports evidence limits, access perspectives, unresolved questions and 0–4 priorities without certifying conformance. |
| **Contrarian** 🔴 👁 | claude-sonnet-5.5 | Where Design-Review asks *"does this meet the criteria?"*, this asks **"are these the right criteria?"** — attacking the problem, the framing, the assumptions, the success metric, and the unpriced cost. Steelmans doing the opposite. |

### Explain it

| Station | Model | What it does |
|---|---|---|
| **Draftsman** ✏️ | gpt-6.1-sol | The build-ready mini-spec: measured redlines, component source, semantic and interaction contracts, responsive rules, accessibility acceptance criteria, and criteria written so they can be **disproved**. Writes `UNSPECIFIED` rather than guessing. |
| **Scribe** ✏️ | claude-sonnet-5.5 | Component docs, project UX/design-system and accessibility guidance, and decision records — documenting what the thing **is**, not what it was meant to be, and flagging where those differ. |
| **Envoy** ✏️ | gpt-6.1-sol | Two modes. **NOTE** assembles a stakeholder update from verified state, including **whether last week's commitment actually happened**. **DECK** builds slides that argue a case, agreeing the **spine** — problem, stakes, approach, work, evidence, ask — before making a single slide. Never sends or presents anything without your say-so. |

### Ship it

| Station | Model | What it does |
|---|---|---|
| **Shipwright** ✏️ | gpt-6.1-sol | The **only** station that writes code. Applies the shared UI delivery contract even without a spec, fixes causes not symptoms, and runs every configured gate without manufacturing evidence. |
| **Surveyor** 🔴 👁 | claude-sonnet-5.5 | Independent code review on a different model family. **Denied the edit tool**, though it keeps shell to run tests. Reviews accessibility behaviour and wiring after design fidelity without duplicating deterministic gate findings. |
| **Lookout** 🔴 👁 | mai-code-1.1-flash | Drives a real browser. Checks the **console at mount first**, then keyboard/focus behaviour, observable labels and status, recovery, reflow, touch and reduced motion. |
| **Herald** 👁 | gpt-5.6-terra | Files the pull request, reads the checks back **verbatim**, and requires evidence-backed UI accessibility notes instead of inventing missing evidence. Never merges. |
| **BuildR** ✏️ | claude-sonnet-5.5 | Merges every open pull request into one preview on top of today's upstream and proves it still mounts — catching what breaks **only in combination**. |
| **Watchkeeper** 👁 | claude-haiku-5.5 | Triages new review comments and newly conflicting pull requests, routing writable source-branch conflicts to Shipwright and external or unknown ownership to the human. Runs when you call it, or on a schedule you create yourself — see [Scheduling Watchkeeper](#scheduling-watchkeeper). Uses a lightweight model because most runs find nothing. |

Four model families — Anthropic, OpenAI, xAI, Microsoft — deliberately spread so no reviewer shares its
maker's blind spots.

Reasoning effort is pinned to **high** for DesignR, Draftsman, and Shipwright,
and **medium** for Envoy. Other stations inherit the invoking session or model
default unless a per-run override is supplied.

### Why these model defaults

Defaults were checked against an available Copilot CLI model catalog on
October 30, 2026, with loading/inference smoke tests. Availability varies by
account and host. These checks do not establish complete workflow correctness,
quality equivalence, cost savings or latency improvements.

| Station | Decision | Expected benefit and limit |
|---|---|---|
| Shipwright | GPT-6.1 Sol, high effort | Implementation role; correctness still requires independent review and tests. |
| DesignR | GPT-6.1 Sol, high effort | Design role; artifact quality must be assessed separately from model availability. |
| Draftsman | GPT-6.1 Sol, high effort | Refresh Sol while keeping measurement and specification work grounded in source evidence. |
| Envoy | GPT-6.1 Sol, medium effort | Refresh Sol without raising reasoning effort for routine reporting. |

Model access depends on the account and host. Existing personalised agents and
crew model overrides are not silently migrated; re-apply a crew explicitly to
adopt the new defaults. Changing `model:` does not enable Codex-specific context
management or new API tool features in Copilot.

### Evidence that survives a handoff

Shipwright establishes red/green regression sensitivity, using isolated known-bad controls when
needed rather than mutating a user's working tree. Claims of pre-existing failures need the actual
merge-base SHA and a comparable reproduction. Surveyor separates confirmed, latent and unverified
findings; measurement-backed disputes require an independent re-check, not a maker's waiver.

Lookout supplies numeric geometry evidence and comparable captures for relevant themes/states,
calibrating custom probes without adding rituals to ordinary browser actions or editing e2e code.
Herald leads with user impact in maintainer-facing prose, retaining detailed provenance internally.
Visible changes default to a **Before | After** image table with reader-accessible images no more
than 1024 px high; missing evidence is named, not fabricated. Every handoff distinguishes failed
checks from not-run, blocked and unverified results. Model defaults and ownership boundaries remain
unchanged.

### Design-Review's two modes

Design-Review preloads both the shared `ui-delivery-guardrails` contract and the bundled
`accessibility-evaluation-method` before it evaluates anything. The method is independently
authored, with public W3C/WAI references; no private review guide is bundled or required.

| Mode | Use it for |
|---|---|
| **DESIGN REVIEW** | Figma designs, annotated mockups, wireframes and component specs before implementation |
| **HEURISTIC EVALUATION** | Broader interface artifacts, prototypes and screenshots of implemented interfaces |

A full evaluation establishes access perspectives and the task, then separates supported
findings from questions about missing intent. It uses a project-specific 0–4 priority scale,
not a conformance rating. Multiple perspectives share one dialog. Screenshots cannot prove
keyboard or assistive-technology behavior; implementation checks belong to **Lookout**.

### Prototype versus production-ready UI

The shared contract marked `design-fleet.ui-delivery/1` owns delivery intent and evidence rules.
Explicit task context wins; `guidance.defaultDeliveryIntent` supplies only a default, and `ask`
means the intent must be resolved. A prototype is labelled as a prototype in every handoff and
cannot be reported as production-ready.

Production-ready UI completes **Design-Review → Draftsman → Shipwright → Surveyor → Lookout →
Herald** and every configured gate. Missing accessibility automation or evidence stays
**unverified**; the fleet does not silently pass it or claim to install new tooling.

---

## How far the separation actually goes

The fleet's promise is easy to overstate, so here is the honest accounting. `fleet.py check`
enforces the first row and refuses to let the others drift silently.

| Claim | Actually enforced? |
|---|---|
| Checking stations are denied the `edit` tool | **Yes.** Declared in each agent's `tools:`, and `fleet.py check` fails the build if a station marked read-only omits `tools:` or includes `edit`. |
| Design-Review, Contrarian and Lookout cannot write anything | **Yes.** They hold only read, search, and an allow-listed set of Figma read calls or Playwright. Their preloaded skills are context, not write tools. Figma *write* calls and `figma_execute` are excluded. |
| Surveyor, Herald and Watchkeeper cannot write anything | **No.** They have no `edit` tool, but they keep `shell` — Surveyor to run your tests, Herald and Watchkeeper to run `git` and `gh`. A shell can write files. This is recorded as `shellRequired` in `crews/roles.json` with the reason. |
| A checker's model is a different family from the maker it checks | **Partly.** The pairings that matter (DesignR→Design-Review, Shipwright→Surveyor/Lookout) hold today, and `check` fails if a model drifts from `roles.json`. The family split itself is not yet asserted by a test. |
| Nothing ships over an unaddressed blocking finding | **No — this is a convention in the prompts.** Stations are stateless. Nothing binds Surveyor's verdict to a commit, and Herald cannot verify a review happened. If you invoke Herald directly, it will file. |

The last row is the significant one. Treat blocking as *"the fleet is built to make skipping a
review obvious"*, not *"the fleet makes skipping a review impossible"*. A receipts mechanism —
each checker writing a verdict bound to a commit, and Herald refusing without one — would close
it, and is the most valuable thing this repository is still missing.

---

## Name your crew

The stations ship with harbour names. You can call them anything.

```bash
FLEET=$(dirname "$(dirname "$(find ~/.copilot/installed-plugins -name fleet.py -path '*design-fleet*' | head -1)")")

python3 "$FLEET/bin/fleet.py" crews                    # what is available
python3 "$FLEET/bin/fleet.py" show --crew avengers     # preview the renaming
python3 "$FLEET/bin/fleet.py" apply --crew avengers --scope user
```

| Crew | DesignR becomes | Design-Review becomes | Surveyor becomes |
|---|---|---|---|
| `shipyard` | DesignR | Design-Review | Surveyor |
| `plain` | Design-Explorer | Design-Critic | Code-Reviewer |
| `avengers` | Stark | Vision | Wanda |
| `flintstones` | Fred | Betty | Hoppy |

### Naming them yourself

Run `new-crew` and it walks you through all thirteen, one at a time, showing what each station does
and offering the default — press Enter to keep it, or type your own:

```bash
python3 "$FLEET/bin/fleet.py" new-crew --name starwars
```

```
  Design station — Explores several Figma directions…
  name for designr [DesignR]: Luke

  Structure station — Low-fidelity wireframes, flows and states…
```

Or name them all in one line:

```bash
python3 "$FLEET/bin/fleet.py" new-crew --name starwars --label "Star Wars" \
  --set designr=Luke --set design-review=Yoda \
  --set contrarian=Vader --set shipwright=Han --set surveyor=Ackbar
  # …and so on for all thirteen
```

Then write the agents:

```bash
python3 "$FLEET/bin/fleet.py" apply --crew starwars --scope user
```

Your crews are saved to `~/.copilot/design-fleet/crews/`, **outside the plugin**, so updating or
reinstalling the plugin cannot delete them. Names may use letters, digits, hyphens, dots and
underscores — no spaces — and must all be distinct.

Renaming rewrites **every cross-reference between the stations**, so the handovers still work.
Ackbar sends blocking findings back to **Han**, then on to **Rey** and **Finn** — never to a
station that no longer exists.

> Worth knowing: themed names are fun for one person, but **plain English wins the moment someone
> else joins your project**. `Browser-Verifier` needs no explanation. `Barton` does.

### Where they get written

| Scope | Location | Use when |
|---|---|---|
| `--scope user` | `~/.copilot/agents/` | It should follow you across every project, and appear in the desktop app |
| `--scope project` | `.github/agents/` | The whole team should get the fleet, committed with the repo |

---

## Avoiding duplicates

Renaming writes **new** agents; it does not remove the ones already there. Because the desktop app
hides the `design-fleet:` prefix, a plugin station and a personal agent of the same name look
identical in the picker.

Check what you actually have:

```bash
ls ~/.copilot/agents/        # your personal agents
ls .github/agents/           # this project's agents
copilot plugin list          # plugin-provided stations
```

If you see the same role twice, keep one. Move the copies you don't want out of the folder rather
than deleting them:

```bash
mkdir -p ~/.copilot/design-fleet/agents-backup
mv ~/.copilot/agents/old-agent.agent.md ~/.copilot/design-fleet/agents-backup/
```

Anything outside `agents/` is not loaded, so the duplicate disappears — and you still have it if
you want it back. **Restart the CLI and the desktop app afterwards**; both cache the agent list.

Which copy to keep:

- **The plugin stations** if you want updates when the plugin updates.
- **Your own files** if you have refined them, or they carry project-specific knowledge the generic
  station does not have.

---

## Refining a station

**Every station is a markdown file.** That is the whole design.

```
~/.copilot/agents/Vision.agent.md
```

Open it. Edit the prose. Save. That is the entire workflow — no rebuild, no reinstall, no code.

**The filename is the name Copilot shows you.** `Vision.agent.md` appears as `Vision` in the CLI
and in the desktop app's picker, so renaming the file renames the station. Keep the `name:` field
in step with it.

The front matter sets the name, the model, and which tools the station may use. Everything below it
is the station's judgement, written in plain English:

```markdown
---
name: Vision
model: grok-4.7
---

# Vision — the independent check

## You do not edit
You are a check, not a hand. Never modify the design...
```

So when a station gets something wrong, you write down what it should have done instead — and it is
right next time. Your fleet gets sharper by being *edited*, not retrained.

Your copies are **never overwritten** by re-running setup, unless you pass `--force`. To share an
improvement with everyone, open a pull request against the file in `plugins/design-fleet/agents/`.

---

## What you need

| For | You need |
|---|---|
| Everything | GitHub Copilot CLI |
| `designr`, `engraver`, `draftsman` | `figma-console` MCP **and** the Figma Desktop Bridge plugin running |
| `design-review` on Figma files | `figma-console` MCP and Desktop Bridge; screenshot and artifact reviews still work without it |
| `lookout` | `playwright` MCP |
| `herald`, `buildr`, `watchkeeper` | `gh` CLI, authenticated |

Nothing is mandatory. The stations you cannot run are simply reported as unavailable — setup tells
you which, up front, instead of failing halfway through.

```bash
copilot mcp add playwright -- npx @playwright/mcp@0.0.82

export FIGMA_ACCESS_TOKEN=...    # in your shell, not pasted into a chat
copilot mcp add figma-console --env FIGMA_ACCESS_TOKEN="$FIGMA_ACCESS_TOKEN" -- npx -y figma-console-mcp@1.40.0
```

Get a Figma token from **Figma → Settings → Security → Personal access tokens**, with the narrowest
scopes that work. Two things worth knowing: pin the package versions rather than using `@latest`, so
a future third-party release does not run against your token unreviewed; and `--env` stores the
value in **`~/.copilot/mcp-config.json` in plain text**, which is where you go to rotate or remove
it. Exporting the variable first keeps the token out of your shell history.

The Figma stations also need the **Figma Desktop Bridge plugin running** in the Figma desktop app.
The MCP server alone is not enough.

---

## Using it

There are two ways to run a station, and the difference catches people out.

### Just talk to it

Name the station at the start of what you want:

```
DesignR, give me three directions for the empty state
Contrarian, is this even the right problem?
Design-Review, audit this against WCAG 2.2 AA
Draftsman, spec this for engineering
Envoy, write the stakeholder update
```

This is the usual way, and the one the rest of this README assumes.

### Or select it first with `/agent`

`/agent` **selects** a station for the session. It takes a name and nothing else:

```
/agent design-fleet:DesignR
```

Then send your prompt as an ordinary message, on the next line:

```
give me three directions for the empty state
```

Run `/agent` on its own to browse and pick from a list.

**The mistake to avoid** is putting the prompt on the same line:

```
/agent design-fleet:DesignR give me three directions   ← does not work
```

Everything after `/agent ` is read as the name, so the CLI looks for an agent called
`design-fleet:DesignR give me three directions`, does not find one, and says so. The error quotes
your whole line back, which is the clue: if you can see your prompt inside the agent name, this is
what happened.

Note the `design-fleet:` prefix. In the CLI a plugin station is `design-fleet:DesignR`, not
`DesignR` — see [Works in the CLI *and* the desktop app](#works-in-the-cli-and-the-desktop-app).

In the desktop app, pick the station from the **Default agent** dropdown instead.

### From a script

Outside an interactive session, the name and the prompt do go together:

```bash
copilot --agent design-fleet:DesignR -p "give me three directions for the empty state"
```

### Or let the fleet route it

```
fleet, take the new onboarding screen from idea to spec
```

The routing rule that saves the most time: **going straight to visual design when the structure is
unsettled is the most common and most expensive mistake.** If the problem is not agreed, start at
`contrarian`. If the structure is not agreed, start at `designr` in WIREFRAME mode.

---

## Watchkeeper state and scheduling

Watchkeeper uses the bundled standard-library `bin/watch.py` helper: explicit first-run
**baseline**, read-only **plan**, then receipt-backed **commit**. It tracks bot and human comments
across issue/review/inline endpoints, detects edits, and reports missing coverage or unknown
mergeability rather than silently declaring a quiet wake.

Read the [watch-state workflow and schema](plugins/design-fleet/docs/watch-state.md) before use.
It covers complete paginated collection, protected commits, retry/deduplication, and explicit
legacy recovery. Existing legacy or other tools' state is **not automatically converted or reset**:
preserve it, reconcile outstanding work, and deliberately baseline a new path. No setup,
installation or helper command starts monitoring.

## Scheduling Watchkeeper

Watchkeeper does not wake on its own. Installing the plugin, running `set up my design fleet`, or
setting `watch.everyMinutes` in `.copilot/design-fleet.json` **records a cadence — it does not
create a schedule.** Nothing runs Watchkeeper unattended until you create one yourself, with the
CLI's own recurring-prompt command:

```
/every 30m design-fleet:Watchkeeper, check for review comments
```

`/every` on its own, with no arguments, lists and manages the schedules you already have — use it
to check what is running or to stop one.

Three things worth knowing:

- **`/every` is an experimental CLI feature.** If the CLI doesn't recognize it, run `/experimental`,
  turn experimental features on, and try `/every` again. If it's still unavailable after that,
  update the CLI (check your version with `copilot --version`) and retry. Until it works, invoke
  Watchkeeper directly instead — see the trigger phrases in the fleet table above.
- The schedule lives in **this CLI session**. It does not follow you to a new session, and a plugin
  update or reinstall has no effect on it either way — you re-create it if you want it back.
- If you change `watch.everyMinutes` later, the running schedule keeps its old interval. Stop it
  and create a new one to match.

---

## What it costs

The fleet is not free, and each station is priced against the job it does. `watchkeeper` uses a
lightweight model because most of its wakes find nothing — an expensive empty poll gets switched
off. `surveyor` uses a stronger review model because an independent second opinion still needs
enough depth to catch what the maker missed.

Model prices and rate cards change. Treat these assignments as measured role-fit decisions, not a
permanent ranking from cheapest to dearest.

For a small change that needs no independent judgement, don't run the fleet. A full pipeline on a
one-line copy fix is theatre.

---

## Troubleshooting

**`Custom agent not found: design-fleet:DesignR <your prompt>`.** The prompt is inside the agent
name, which means it was typed on the same line as `/agent`. That command takes a name and nothing
else. Select the station first, then send the prompt as a separate message — see
[Using it](#using-it).

**`/agent` doesn't list the stations.** Restart the CLI. Confirm with `copilot plugin list`.

**The desktop app shows the same agent twice.** You have a personal agent and a plugin station with
the same name — the app hides the `design-fleet:` prefix, so they look identical. See
[Avoiding duplicates](#avoiding-duplicates).

**The desktop app shows an agent I deleted, or not one I just added.** It caches the agent list.
Quit and reopen the app.

**Project agents aren't loading.** Agents in `.github/agents/` need the directory trusted — run
`/add-dir <your-project>` or restart in that directory. Agents in `~/.copilot/agents/` load
everywhere, including the desktop app, with no extra step.

**A Figma station says it cannot connect.** The MCP server is not enough on its own — the **Figma
Desktop Bridge plugin must be running** in the Figma desktop app.

**A station used the wrong repo or Figma file.** It read `.copilot/design-fleet.json`. Fix the
config, or re-run `set up my design fleet`.

**Renaming skipped some files.** Existing files are never overwritten, so your edits stay safe. Pass
`--force` if you really want them replaced.

---

## Keeping up to date

Already installed and want the latest fixes? Update the plugin itself:

```bash
copilot plugin update design-fleet@mbugua-j
```

Then restart the CLI and the desktop app — both cache the agent list.

This updates the **plugin's** stations and skills. Personalised copies you wrote into
`~/.copilot/agents/` or `.github/agents/` are yours and are never touched, so prompt and model
changes still require review or re-application. Universal UI contract updates do flow to a
personalised agent that declares `skills: ['ui-delivery-guardrails']`; restart the CLI and desktop
app to load the updated skill. To see which agent files have fallen behind:

```bash
python3 "$FLEET/bin/fleet.py" status --scope user
```

```
  Wanda.agent.md    v1.1.0    up to date
  Barton.agent.md   v1.1.0    RETIRED MODEL — re-apply with --force
  Stark.agent.md    v1.1.0    SHIPPED VERSION CHANGED — review and re-apply
```

This matters more than it sounds. Models get retired — Gemini 3.1 Pro and Claude Sonnet 4.6 both
retired on 1 September 2026 — and a personalised copy pinned to a dead model simply stops working.
To take the shipped version of one station:

```bash
python3 "$FLEET/bin/fleet.py" apply --crew <yours> --scope user --stations <station> --force
```

`--force` overwrites, so keep a copy of your edits first if you want to merge them by hand.

---

## Contributing

The fleet gets better the way it was designed to: someone notices a station getting something
wrong, writes down what it should have done instead, and sends the prose back. **You do not need to
write code** — every station is a markdown file.

```bash
git clone https://github.com/mbugua-j/design-fleet
cd design-fleet

# edit plugins/design-fleet/agents/<Station>.agent.md, then:
python3 plugins/design-fleet/bin/fleet.py check

# try it for real (remove the released copy first, or you'll see every station twice)
copilot plugin uninstall design-fleet
copilot plugin install ./plugins/design-fleet
```

Open a pull request saying what went wrong, what you changed, and what behaved differently
afterwards. CI validates every station and renders every crew.

The one thing a contribution must not do is erode the rule the fleet exists for: **making stations
never approve their own work, and checking stations cannot edit.**

Full guide: **[CONTRIBUTING.md](CONTRIBUTING.md)**.

---

## Repository layout

```
.github/plugin/marketplace.json     the marketplace index
.github/workflows/validate.yml      CI: validates stations and renders every crew
plugins/design-fleet/
  fleet.manifest.json              dashboard provider contract
  FLEET_PROVIDER.md                provider schema and authoring guide
  .github/plugin/plugin.json        the plugin manifest
  agents/                           the thirteen stations, as markdown
  skills/fleet-setup/               the setup and renaming flow
  skills/design-fleet/              routing and the handover rules
  skills/ui-delivery-guardrails/    shared UI delivery contract (`design-fleet.ui-delivery/1`)
  skills/accessibility-evaluation-method/  two-mode persona and heuristic evaluation workflow
  crews/                            name packs, plus roles.json
  bin/fleet.py                      the renamer, and `check`
```

## Licence

MIT — see [LICENSE](LICENSE).
