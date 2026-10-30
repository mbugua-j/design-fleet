---
name: accessibility-evaluation-method
description: "Review designs, specifications, prototypes and interface screenshots for accessibility barriers and usability risks. Use for pre-implementation DESIGN REVIEW or broader HEURISTIC EVALUATION, including persona-led reviews. Produces evidence-qualified findings, questions and a 0-4 priority report. Not for generating designs, code review, running browser tests, or certifying conformance."
---

# Accessibility and usability review

This is an independently authored Design Fleet procedure informed by the public
references below. It does not incorporate private review guides, corporate
standards or an unpublished source corpus. Its priority scale and report structure
are project conventions, not W3C requirements.

## Set the review boundary

Use **DESIGN REVIEW** for decisions still being specified in Figma, wireframes,
annotated mockups or component specifications. Use **HEURISTIC EVALUATION** for
task usability across designs, prototypes or screenshots of implemented
interfaces. Choose one mode; do not charge for duplicate passes by default.

Establish the user's task, artifact and revision, intended audience, relevant
states, delivery intent and requested accessibility target. Follow the shared
UI delivery contract when it is present. If the task or artifact cannot be
identified, ask before evaluating. Do not invent a target standard.

Explain the available evidence. A screenshot can reveal visible content and
layout, not accessible names, reading order, keyboard operation or announcements.
A design annotation records intent, not proof that the implementation follows it.
Source values can support measurements; estimated screenshot colors cannot
establish an exact contrast ratio. Missing evidence is not a pass or a failure.

## Choose perspectives, not stereotypes

Ask which access needs matter for the task. Users may name personas, but do not
ask them to disclose diagnoses or personal medical information.

| Perspective | Questions to investigate |
|---|---|
| Keyboard-only or limited dexterity | Is every task reachable without precise pointing? Is focus and its intended route specified? |
| Blindness or nonvisual use | Are meaningful structure, control names and state changes specified beyond visual placement? |
| Low vision, zoom or limited color perception | Does content remain understandable when enlarged or without color distinctions? |
| Deafness or limited hearing | Is essential audio information also available without hearing it? |
| Reading, attention or memory differences | Are instructions, decisions, errors and recovery understandable without remembering hidden context? |
| Motion or flashing sensitivity | Can unnecessary movement be avoided, and is essential information available without animation? |

These are investigation lenses, not claims about every disabled person.
For a full persona-led review, resolve the selected perspectives first. If the
user explicitly wants a quick review without questions, declare a limited
keyboard-only perspective and list other perspectives as not reviewed.
Persona simulation does not replace evaluation with disabled users.

## Follow a task through its states

Trace entry, action, feedback, completion and recovery using the artifacts
actually supplied. Inspect relevant empty, loading, error and constrained-layout
states when available; list absent states rather than inventing their behavior.

Use these task-oriented usability questions alongside accessibility:

- Can the person identify the purpose, current state and next action?
- Are labels and interactions consistent with the task and supplied design system?
- Can they prevent, understand and recover from an error without losing work?
- Can they navigate, change their mind and leave an interaction?
- Does the experience avoid unnecessary effort, recall and time pressure?

For accessibility findings, consult the applicable public WCAG criterion before
assigning its identifier and level. Useful starting areas include text and
non-text alternatives, structure, contrast, keyboard access, focus, form
instructions, input errors, status feedback, target size, reflow and motion.
Check exceptions and scope; a general usability concern is not automatically
a WCAG failure. Do not fabricate a criterion or substitute an unavailable
corporate requirement.

## Resolve uncertainty without hiding evidence

Separate an observed barrier from a question about missing intent. Ask a small
batch of decision-changing questions, identifying the artifact location and why
the answer matters. Reuse answers across perspectives instead of repeating an
interview.

Do not present an unresolved inference as a confirmed finding. A supported,
independent observation may still be reported while another question is pending.
If the user cannot answer, label the issue **UNVERIFIED** or **BLOCKED** and
state the evidence needed. Never convert an unanswered question into a pass.
Route running-browser and assistive-technology verification to Lookout or a
qualified evaluator; do not perform implementation tests in this design review.

## Report impact separately from certainty

For each supported finding, record:

- A stable ID and exact artifact location.
- The task, state and access perspective affected.
- The observation, evidence source and limits.
- The practical user impact, not just a violated design preference.
- A relevant public criterion when supported, or **usability concern** otherwise.
- Priority, confidence and a concrete design decision or annotation to change.
- A way for an independent reviewer to check the correction.

Verify criterion numbers and titles against the public reference before citing
them. If the reference cannot be checked, describe the requirement without an
unverified number; a confident-looking citation is not evidence.

Use this project's priority scale; it is not a WCAG conformance level:

| Priority | Task impact |
|---|---|
| 4 | An essential task is blocked with no usable alternative shown. |
| 3 | A major barrier makes completion unreliable or demands a difficult workaround. |
| 2 | A recoverable obstacle adds meaningful effort, confusion or repeated errors. |
| 1 | A limited friction point with a straightforward recovery. |
| 0 | Informational observation; no demonstrated task barrier. |

Confidence describes evidence quality independently of impact. Do not lower
priority merely because evidence is missing; keep the concern unverified instead.
Deduplicate root causes while preserving the affected locations and perspectives.

Start the report with scope and limitations, then confirmed findings in descending
priority, open questions/unverified concerns, and the next responsible station.
Use **NOT REVIEWED** for excluded states or perspectives. Say "no supported
findings in this scope" rather than certifying an artifact accessible.

DesignR owns design corrections; Draftsman records agreed behavior and acceptance
criteria; Lookout verifies implemented behavior. Remain read-only: do not modify
the artifact or write a fix. Re-check changed evidence before closing a finding.
A narrow review, automated lint result or screenshot does not establish WCAG
conformance or legal compliance.

## Public references

Consult these sources for the concepts and criteria, not as evidence that an
unseen implementation passed:

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): normative success criteria and conformance requirements.
- [WAI Easy Checks](https://www.w3.org/WAI/test-evaluate/preliminary/): introductory checks and the limits of a preliminary review.
- [WCAG-EM overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/): scope, sampling and reporting for conformance evaluation.
- [Involving Users in Evaluating Web Accessibility](https://www.w3.org/WAI/test-evaluate/involving-users/): combine user evaluation with standards-based evaluation; do not generalize from one person's experience.

These links are references, not an endorsement by W3C. No source document is
bundled or reproduced as a private guide.
