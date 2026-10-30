---
name: design-fleet
description: The design fleet — thirteen stations that take design work from a brief to something shipped, where no station is allowed to approve its own work. Routes a piece of work to the right station and enforces the handovers between them. Use when the user says 'design fleet', 'run the fleet on <thing>', 'take <thing> through the fleet', 'who should do this?', 'design <screen> properly', or asks which station handles a step. Do not use for a one-line change that needs no review, or when the user has already named a specific station.
---

# The design fleet

**Say "fleet" to call it.** Thirteen stations, one pipeline, one rule:

> **Nobody signs off their own work.**

A single agent that designs, critiques and approves is the same judgement wearing three hats. It
carries one context, one model family, and one notion of finished. The fleet splits those apart on
purpose — and gives the checking stations a different model family from the making stations,
because a blind spot travels with a family. Put the reviewer on the same one as the maker and it
will agree with the mistake it was hired to catch.

## Before routing anything

Read `.copilot/design-fleet.json`. If it does not exist, run the **`fleet-setup`** skill first —
stations act on that config and will guess badly without it.

Relevant UI stations preload the shared contract marked `design-fleet.ui-delivery/1`; that skill
owns the baseline and evidence boundaries. Routing applies its result: explicit task context wins
over the configured default, `ask` must be resolved, and a prototype label travels with every
handoff.

For production-ready UI, route the complete path **Design-Review → Draftsman → Shipwright →
Surveyor → Lookout → Herald** and every configured gate. Do not route missing evidence as a pass.

Station names depend on the user's crew pack. If they renamed the fleet, use *their* names. Read
the `crew` field in the config and the files in `.github/agents/` or `~/.copilot/agents/` to learn
them. The canonical names below are what the plugin ships as `design-fleet:<name>`.

---

## The stations

**Make the thing** — these write, and none of them may approve their own output.

| Station | Does |
|---|---|
| `designr` | Structure and flows in grey, several labelled Figma directions, or recreates a coded screen as editable frames |
| `engraver` | Cuts an icon into the full platform asset matrix, read from spec, never memory |

**Check it** — these cannot edit, and both may stop the pipeline.

| Station | Does |
|---|---|
| `design-review` | Independent accessibility and usability review using public W3C/WAI references, access perspectives and evidence-qualified priorities |
| `contrarian` | Attacks the brief itself: framing, assumptions, success metric |

**Explain it**

| Station | Does |
|---|---|
| `draftsman` | Measured spec: states, behaviour, testable acceptance criteria |
| `scribe` | Component docs, design-system guidance, decision records |
| `envoy` | Status notes and decks that argue a case, both from verified state |

**Ship it**

| Station | Does |
|---|---|
| `shipwright` | The only station that writes code |
| `surveyor` | Independent diff review, different model family, no edit tool |
| `lookout` | Real browser, proves it mounts |
| `herald` | Files the pull request, reads the checks back, never merges |
| `buildr` | Merges every open pull request into one preview and proves it still works |
| `watchkeeper` | Triages new review comments and newly conflicting pull requests, then routes them by ownership. Runs when called, or on a schedule the user creates with `/every` — see `fleet-setup` |

---

## Routing

Match the request to the earliest station that fits. Going straight to visual design when the
structure is unsettled is the most common and most expensive mistake.

| The user has… | Start at |
|---|---|
| An idea, no screens | `contrarian` — check the problem is real before designing it |
| An agreed problem, no structure | `designr` in WIREFRAME mode |
| Structure agreed, needs visuals | `designr` in BRAINSTORM mode |
| A design they want judged | `design-review`, and `contrarian` if the brief is also in doubt |
| A chosen design, going to engineering | `draftsman` |
| An approved spec | `shipwright` → `surveyor` → `lookout` → `herald` |
| Production-ready UI | `design-review` → `draftsman` → `shipwright` → `surveyor` → `lookout` → `herald`, plus every configured gate |
| An icon to produce | `engraver` → `design-review` |
| To present or report | `envoy` — DECK mode for a room, NOTE mode for an inbox |
| Several open pull requests | `buildr` |
| A quiet week of pull-request activity | `watchkeeper` — invoke it directly, or set up an `/every` schedule (see `fleet-setup`) that checks for review comments and conflict transitions |

Announce the route in one line before starting, so the user can redirect cheaply.

---

## The pipeline

```
  contrarian ──→ designr ──→ design-review
                    │              │
                    │              └── blocking finding ──┐
                    ↓                                     │
                 engraver ──→ design-review               │
                    │                                     │
                    ↓                                     │
                draftsman ──→ shipwright ←────────────────┘
                                  │
                 surveyor ←───────┤
                  lookout ←───────┤
                      │           │
        blocking ─────┴───────────┘
                      │
                   herald ──→ pull request
                                  │
         watchkeeper ──→ triage ──┘
               buildr ──→ combined preview
```

Prototype work may take a shorter route when the task calls for it, but its label travels with the
work and no station may convert incomplete evidence into a production-ready claim.

---

## The backward arrow

The forward arrows only mean something because the backward one exists.

- **Who can block** — `design-review`, `contrarian`, `surveyor`, `lookout`. Any one of them sends
  the work back, and the pipeline stops moving forward.
- **Who cannot wave it through** — nobody. No station may pass a finding because it looks minor.
  That judgement is not given to the station that wants to ship.
- **Who fixes** — only the station that made the thing. Reviewers never edit; several of them are
  given no edit tool at all, so the separation is structural rather than a promise.

Never file, publish, or present over an unaddressed blocking finding.

---

## Running the fleet

Call a station with the `task` tool, naming the agent. Give it **complete context** — every station
is stateless and starts fresh.

- Run **independent** stations in parallel: `design-review` and `contrarian` examine different
  things and never need each other's output.
- Run **dependent** stations in sequence: `surveyor` before `herald`, always.
- Never run a maker and its own checker as the same call.

When a station reports back, relay its findings **without softening them**. A blocking finding
passed on as a suggestion has defeated the entire structure.

---

## What it costs

The fleet is not free, and every station is priced against the job it is doing: `watchkeeper` uses
a lightweight model because most of its wakes find nothing, while `surveyor` uses a stronger review
model because an independent second opinion still needs depth. Model prices change; choose from
measured role fit, not a permanent cheapest-to-dearest ranking.

For a small change that needs no independent judgement, say so and do it directly. A fleet run on a
one-line copy fix is theatre.
