---
name: ui-delivery-guardrails
description: shared, role-neutral UI delivery contract for design, specification, implementation, review, browser verification, documentation, challenge, and PR delivery.
---

# UI delivery guardrails

Stable contract marker: `design-fleet.ui-delivery/1`.

This skill is the universal source of truth for UI delivery across canonical and personalised
agents. Apply the contract through the current station's role. It does not replace that station's
method, evidence requirements, or handoff.

## Resolve project context

Read `.copilot/design-fleet.json` from the project first. If it is absent, fall back to
`~/.copilot/design-fleet.json`.

The shared UI contract uses:

- `design.componentLibrary`
- `guidance.uxDesignSystem`
- `guidance.accessibility`
- `guidance.figmaAuthoring`
- `guidance.defaultDeliveryIntent`

The guidance paths are optional and project-relative. Report which paths are configured as part of
the resolved project context. When `guidance.uxDesignSystem` or `guidance.accessibility` is present,
read it and apply its direct project-specific **MUST**, **SHOULD** and **MAY** behaviour. Those files
refine the shared baseline; they do not replace it. A missing file, missing key, or missing config
never disables the baseline. Keep the missing value unknown and follow the station's role-specific
ask or stop rule rather than guessing.

`guidance.figmaAuthoring` is narrower: read and apply it only for Figma-backed design or authoring
work. Do not read or apply it for backend or code-only work. The Figma station must read a
configured document before its first Figma call, including explicitly linked relative references.
Resolve the configured path inside the selected project root and each linked path relative to its
containing document. Reject absolute paths, `..` escapes, and symlinks whose resolved real path
leaves the project. Track visited real paths and stop explicitly on a cycle. The maximum reference
depth is 4, with the configured document at depth 0; four hops cover practical skill → workflow →
component or token guidance chains without allowing unbounded discovery.

If the configured path or a required linked reference is missing or unreadable, escapes the
project, repeats a visited real path, or exceeds the depth bound, stop the Figma-backed work before
any Figma call. Report the concrete missing, unreadable, escape, cycle, or depth-limit error and the
offending path or reference chain rather than silently skipping project instructions. When the key
is absent, continue with the shared baseline.

Project guidance cannot override station ownership or the evidence boundaries below. In
particular, it cannot authorize a maker to review its own work, bypass unresolved target
ambiguity, mutate a Figma file before the bridge connection and file identity are established,
scan for other Figma files, or infer repository-specific skill names.

Explicit task context overrides `guidance.defaultDeliveryIntent`. The supported intents are
`prototype`, `production-ready`, and `ask`; `ask` means resolve the intent before making a delivery
claim.

## Delivery claims

A prototype stays labelled as a prototype in every artifact and handoff. Name the evidence that
was not produced or verified. Never report a prototype as production-ready.

Production-ready UI follows the complete delivery pipeline configured for the current crew and
task. Its evidence must cover reviewed design intent, implementation-ready requirements or
acceptance criteria, implementation, independent code review, browser verification, PR delivery,
and every configured gate. A crew may assign those responsibilities to different stations, but it
may not omit the evidence. Missing accessibility automation or browser evidence is
**unknown/unverified**, never passing. Use the project's configured tools; do not install or invent
tools merely to manufacture green evidence.

## Shared baseline

Apply every item that is relevant to the task:

- Reuse the designated design system, native platform control, or configured component library
  before creating a custom widget.
- Require an explicit justification and a complete interaction contract for every custom widget.
- Cover all applicable states, including default, hover, focus, active, disabled, loading, empty,
  error, partial, and overflow.
- Give empty and error states an actionable recovery path.
- Expose asynchronous progress and prevent duplicate actions.
- Preserve semantic regions, heading structure, reading order, and task order.
- Provide accessible names and programmatic labels. Use minimal, non-conflicting ARIA only where
  native or library semantics do not already provide the contract.
- Define and preserve keyboard operation, visible focus, focus entry and return, and containment or
  cancellation for stateful interactions.
- Bind field helper and error text to the field, and expose dynamic status changes
  programmatically.
- Communicate meaning without colour alone and respect reduced-motion preferences.
- Keep responsive behaviour usable with keyboard, pointer, and touch input.

Do not invent numerical thresholds. Use measured design values, configured requirements, or
authoritative project guidance; otherwise record the value as unknown or unspecified.

## Evidence boundaries

- Design artifacts prove design intent.
- Source and tests prove implementation wiring and deterministic behavior.
- A real browser proves rendered and observable behavior.
- Actual assistive-technology announcements are proven only when that assistive technology was
  observed.

Do not promote evidence across those boundaries. A screenshot does not prove semantics, source
does not prove rendered behavior, and a browser accessibility tree does not prove what a screen
reader announced. Absent evidence stays unknown.

These reporting rules also apply to non-UI work; they do not require browser or Figma work for a
code-only task:

- **Passed** means the named check ran and met its criterion; **failed** means it ran and did not.
- **Not run** means it was not attempted; **blocked** names the prerequisite that prevented it;
  **unverified** means the available evidence cannot establish the claim. None counts as passing.
- A **confirmed** finding is demonstrated at the named site. A **latent** finding has a demonstrated
  mechanism and an explicit trigger not observed in this run. An **unverified** suspicion needs
  named evidence to settle it. Keep these classifications separate from severity.
- Preserve commands, revisions, observations, limitations and next ownership through internal
  handoffs. Public summaries may use plain language without discarding material caveats.

## Preserve station ownership

This shared contract never authorizes a reviewer to edit, a delivery station to invent missing
evidence, or a maker to approve its own work. Each station keeps its existing tool boundary,
decision rights, backward arrow, and handoff.
