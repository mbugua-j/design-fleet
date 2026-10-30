# Local watch state

`bin/watch.py` is a Python standard-library helper, not a watcher service. It ingests a JSON
snapshot, compares it deterministically with local state, and commits only acknowledged work.
It never calls GitHub, posts replies, resolves threads, executes comment content, starts a timer,
or migrates an existing state file. Use it only inside a user-requested Watchkeeper run.

## Resolve the scope and collect

Read the project's `.copilot/design-fleet.json`, falling back to `~/.copilot/design-fleet.json`
only when absent. Resolve `project.repo` and `watch.scope` before fetching. For `authored-by-me`,
establish the authenticated login and filter the complete open-PR list; for `all-open`, retain
the whole list. If another scope is requested, obtain an explicit PR list rather than guessing.
One state file is pinned to one `owner/repo` (case-insensitive). Separate repositories need
separate explicitly selected files. Enterprise hosts are not supported by this schema; do not
reuse a github.com state file for a different host.

Stored state is history, never proof that a PR is open. Intersect an explicit PR
list with the fresh open set; never seed successful discovery from state entries
or earlier reports. An empty complete open scope needs no state pruning.

Set `FLEET` to the actual plugin root containing both `bin/fleet.py` and `bin/watch.py`.
The checkout root is `plugins/design-fleet`; installed and personalised agents must locate the
same installed plugin rather than resolving relative to their copied agent file.

For example, these are **read-only collection commands**, not an autonomous loop:

```sh
gh api --hostname github.com --paginate --slurp 'repos/acme/console/pulls?state=open&per_page=100'
gh api --hostname github.com --paginate --slurp 'repos/acme/console/issues/12/comments?per_page=100'
gh api --hostname github.com --paginate --slurp 'repos/acme/console/pulls/12/reviews?per_page=100'
gh api --hostname github.com --paginate --slurp 'repos/acme/console/pulls/12/comments?per_page=100'
gh pr view 12 --repo github.com/acme/console --json number,state,author,headRepository,headRepositoryOwner,headRefName,headRefOid,baseRefName,mergeable,mergeStateStatus
```

Use explicit validated repository/PR values, never interpolate comment text into a command.
Save raw results and exit status in a private local session directory. Read all pages, flatten
the outer page array once, and normalize the fields below into `snapshot.json`. Do not use
`gh pr view --comments` or a default limited PR list as proof of complete pagination. A failed
page/request, truncation, invalid response, or unhandled record means `complete: false`, not an
empty successful endpoint. Do not filter out humans, bots, empty review bodies, or resolved
inline threads. Collection/normalization is the agent's responsibility; the helper validates the
snapshot, not the truth of a claimed successful fetch.

Re-read state/head/mergeability after collection and state again before routing or reporting.
If a PR closed or merged, exclude it from active scope while preserving stored history.
Recollect and regenerate a plan if its snapshot was already planned; reconcile successful
receipts without replaying handoffs. Do not edit a planned snapshot or acknowledge an
unrouted event. A failed state read is unknown: report it and leave those events unacknowledged.
If the head changed or fields contradict each other,
refetch that PR or mark its metadata unknown. Set `observedAt` after collection, not at its start.
The snapshot is an observation, not a transaction across GitHub: changes racing pagination can
still be detected on the next full sweep. Never use a high-watermark `since` filter in place of
reading the endpoints; an edit to an old comment is still an event.

## Snapshot schema (version 1)

All fields shown are required; extra fields and duplicate JSON keys are rejected. Times are
UTC seconds in `YYYY-MM-DDTHH:MM:SSZ`. IDs and PR numbers are positive integers, not strings or
booleans. `scope` is the exact list intended for this sweep; `pullRequests` must be a subset of it.
An omitted scoped PR is reported missing. If PR discovery failed, retain all PR numbers known to
be in scope and set `discoveryComplete: false`; the total open-PR denominator remains unknown.

```json
{
  "version": 1,
  "repo": "acme/console",
  "scope": [12],
  "discoveryComplete": true,
  "observedAt": "2026-09-05T11:00:00Z",
  "pullRequests": [{
    "number": 12,
    "metadata": {
      "headSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "mergeable": "MERGEABLE",
      "mergeStateStatus": "CLEAN",
      "author": "contributor",
      "sourceRepo": "acme/console",
      "sourceBranch": "fix/example",
      "baseBranch": "main"
    },
    "comments": {
      "issue": {
        "complete": true,
        "items": [{
          "id": 123,
          "createdAt": "2026-09-05T10:00:00Z",
          "updatedAt": "2026-09-05T10:30:00Z",
          "body": "Please cover the edited-comment case.",
          "author": "reviewer"
        }]
      },
      "review": {"complete": true, "items": []},
      "inline": {"complete": true, "items": []}
    }
  }]
}
```

Normalize issue and inline comments from `id`, `created_at`, `updated_at`, `body`, `user.login`.
Use `null` for a genuinely absent author. For review bodies, use the review's `id`, `body`,
`user.login`, and `submitted_at` as `createdAt`; use a real update timestamp if supplied,
otherwise `submitted_at` as `updatedAt`. The body fingerprint detects review edits even without
an update timestamp. An unsubmitted review with no reliable timestamp is an unhandled record:
mark that endpoint incomplete and report it; never invent a timestamp to baseline it.
Do not put the enclosing review ID into an inline comment's ID field.

Metadata maps `headRefOid` to `headSha`, `author.login` to `author`, `headRefName` to `sourceBranch`,
and `baseRefName` to `baseBranch`. Build `sourceRepo` from the confirmed head repository owner
login and repository name. Metadata values may be `null` when unavailable; do not invent a source
repository for a deleted fork. `mergeable` accepts `MERGEABLE`, `CONFLICTING`, `UNKNOWN`, or null.
`mergeStateStatus` accepts `BEHIND`, `BLOCKED`, `CLEAN`, `DIRTY`, `DRAFT`, `HAS_HOOKS`, `UNKNOWN`,
`UNSTABLE`, or null. New API values require a helper update, not coercion to clean.

All metadata fields must be present and non-null to establish known state. `CONFLICTING` plus
`DIRTY` means conflicting; `MERGEABLE` plus a known non-`DIRTY` status means not conflicting,
**not** checks-passing or merge-authorized. Unknown/contradictory mergeability or missing ownership
is reported unknown and never clears the last known conflict. A newly conflicting PR or a changed
head that remains conflicting produces an event. Returning to known non-conflicting state arms
the next conflict transition. Only an observed transition can be detected.
The helper cannot reconstruct edits or conflict transitions that happened entirely between sweeps.
When a service omits edit timestamps, it also cannot order two different bodies observed in the
same second; refetch instead of combining contradictory snapshots.

## Explicit baseline, then plan and acknowledge

Create the state parent directory deliberately. Keep state, lock, temporary state files, snapshots,
plans and receipts out of source control; put transient artifacts in a private session directory.
The helper requires explicit `--state` and never searches old state locations.

For a **new** state path only:

```sh
python3 "$FLEET/bin/watch.py" baseline --state .copilot/design-fleet-watch.json --snapshot snapshot.json
```

Baseline requires complete discovery, all three endpoints for every scoped PR, and known metadata.
It never overwrites a file. Report its `baselinedComments` count and `baselinedConflicts` PR list:
these historical observations are intentionally excluded from new-work routing, **not claimed
read or resolved**. This explicit first-run decision is the only exception to per-event receipts.
If historical items still need action, reconcile them explicitly before taking this baseline;
do not silently suppress outstanding work. A newly encountered PR after baseline is not silently
baselined: all of its previously unacknowledged comments are returned.

On subsequent sweeps:

```sh
python3 "$FLEET/bin/watch.py" plan --state .copilot/design-fleet-watch.json --snapshot snapshot.json > plan.json
```

`plan` does not change state. Read its coverage first, then each event's full content from the plan.
Read-only collection is not acknowledgement. For each event, route the issue to its owner, save
the draft for the human, or record a reasoned noise/duplicate disposition. Persist an internal
handoff/triage record carrying the exact event ID and content version **before** acknowledging it.
Record the recipient's accepted handoff or the location of the durable human-facing draft/noise
record. Do not equate a failed send or a still-in-memory draft with delivery.

Save only successful acknowledgements in `receipts.json`, an array of:

```json
[
  {
    "eventId": "64-character event id copied exactly from plan.json",
    "disposition": "routed",
    "reference": "durable handoff or local triage record identifier"
  }
]
```

`disposition` is `routed`, `drafted`, or `noise`; `reference` must be nonblank. The helper enforces
shape and matching event identity, not whether a human actually read the body or a recipient
accepted the handoff. These are the station's responsibility. Never auto-fill receipts for all
fetched events. Do not include comment bodies in receipt references.

```sh
python3 "$FLEET/bin/watch.py" commit --state .copilot/design-fleet-watch.json \
  --snapshot snapshot.json --plan plan.json --receipts receipts.json
```

Keep the snapshot and plan unchanged between planning and commit. Empty receipts (`[]`) are
valid: known non-actionable metadata observations can advance, but no new/edited comment
or new conflict is marked handled. Unacknowledged events remain pending. Partial sweeps may
commit successfully read and routed items; they never delete or advance unseen comments/PRs.
No deletion or closed-PR pruning is attempted.

The result names `coverage`, committed revision, acknowledged IDs and pending IDs. Exit 0 means
the operation succeeded, **not** full coverage: inspect `coverage.complete` even on success.
Only complete coverage with no new events and no pending work permits a quiet no-change report.
For partial discovery the known scope count is not a claim about all open PRs. Missing or
unreadable state, invalid input, stale plans and lock/persistence errors exit nonzero with a
concrete message; never describe these as no new comments.

## Persistence, concurrency and retry limits

State schema version 2 stores the repository, revision, last observation time, and PR-specific
comment keys (`issue:123`, `review:123`, `inline:123`). Each comment stores created/updated times,
a SHA-256 fingerprint of its normalized content, a generation and its latest receipt (null for
baseline). The fingerprint catches body edits as well as timestamp changes. Generations make
repeated body reversions and recurrent same-head conflict transitions distinct events. Known
metadata and its latest conflict receipt are also retained. No comment bodies are stored in
state; plans/raw snapshots do contain them and need appropriate local protection.

Identical repeated records deduplicate; conflicting duplicates are rejected. Older snapshot
times, regressed edit times and changed creation times are rejected, not allowed to roll back
history. Re-fetch instead. A no-op commit of the same observation leaves bytes/revision unchanged.

Each operation holds an exclusive `<state>.lock` containing its PID and canonical state path.
Commit checks both revision and full state/snapshot digests against a regenerated plan, then
writes a restrictive-permission temporary sibling, flushes/fsyncs it, atomically replaces state,
and fsyncs the parent directory on POSIX. The parent must exist on a local filesystem with these
semantics. Do not use synchronized/network state storage or non-cooperating writers.

The lock protects state operations, **not the time an agent spends routing**. Concurrent plans
can observe the same event. Include the event ID in durable handoffs so recipients/coordinators
deduplicate them. If commit rejects a stale plan, re-plan and reconcile prior receipts before
dispatching anything again; acknowledge only IDs still present. A crash between routing and
commit can replay work: this is at-least-once delivery, not an exactly-once service.

Locks are never automatically stolen. After an interrupted process, inspect the lock and confirm
the recorded process/operation is no longer active before explicitly removing that exact lock.
PID reuse means a PID alone is insufficient proof. Do not remove a live writer's lock or kill an
unrelated process. Interrupted writes may leave a named temporary sibling: preserve state, inspect
the specific leftover, and re-plan before cleaning it up. A persistence error after replacement
may mean state committed despite the error; re-plan rather than blindly repeating a handoff.

## Legacy state: preserve, do not guess

Legacy `repos`/last-comment-watermark and other tools' `seen` variants are **not converted**. They do
not reliably establish endpoint identity, complete coverage and edited-comment history for this
schema. An old, corrupt or unreadable file is not first run. `baseline` refuses existing paths;
`plan`/`commit` refuse unsupported schemas.

An explicit safe recovery/migration is:

1. Stop overlapping operations using that path; do not create, change or cancel schedules without
   the user's authorization.
2. Preserve the old file unchanged. If readable, export/copy it to an explicitly named backup
   and compare bytes; retain the original even if parsing fails. Resolve access errors rather
   than replacing an unreadable file with empty history.
3. Reconcile outstanding old routes/drafts with the human. This helper cannot prove which legacy
   entries were read, nor infer a missing repository mapping. Record any historical follow-up
   separately; a fresh baseline is a deliberate history boundary, not a lossless migration.
4. Select a **new**, unused local path, fetch a complete snapshot, and explicitly baseline it.
   Report the counts, conflict list and timestamp. Only after approval change `watch.statePath`
   or a calling command to the new path. Nothing here repoints the user's configuration.

Never default to `.fleet/watch-state.json`, reinterpret a legacy watermark as every comment seen,
or claim support for an unseen legacy variant.
