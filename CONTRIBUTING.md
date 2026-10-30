# Contributing to design-fleet

The fleet gets better the way it was designed to: someone notices a station getting something
wrong, writes down what it should have done instead, and sends the prose back.

You do not need to write code. Every station is a markdown file.

---

## The one rule

The fleet exists because **nobody signs off their own work**. A change that erodes that will be
sent back no matter how useful it looks:

- A **making** station (DesignR, Engraver, Shipwright, Draftsman, Scribe,
  Envoy) must never approve, audit, or declare its own output verified.
- A **checking** station (Design-Review, Contrarian, Surveyor, Lookout) must never edit. All four
  declare a restricted `tools:` list with no `edit`, and `fleet.py check` fails if that slips — so
  do not add `edit`, and do not delete the `tools:` line, because an unset list inherits *every*
  tool.
- Surveyor, Herald and Watchkeeper keep `shell` because they must run tests, `git` and `gh`. That
  means they *can* write files. It is recorded as `shellRequired` in `roles.json` with a reason.
  If you add `shell` to another read-only station, `check` will stop you until you record why.
- A checking station's `model:` must stay on a **different family** from the station it checks. The
  spread across Anthropic, OpenAI, xAI and Microsoft is deliberate, not incidental. `check` fails if a
  model drifts from `roles.json`.
- No station may wave a finding through because it looks minor.
- Anything a station could not verify is **named, never counted**.

Be careful not to overstate this in documentation. Blocking is a convention carried in the prompts;
nothing in the code prevents a user from invoking Herald directly. See
[How far the separation actually goes](README.md#how-far-the-separation-actually-goes).

---

## Four kinds of contribution

### 1. Refine a station — the most valuable, and the easiest

Edit the prose in `plugins/design-fleet/agents/<Station>.agent.md`.

Good refinements are **specific and earned**. The best ones come from a station getting something
wrong in real use:

> Lookout kept reporting "renders correctly" without opening the console, so I made checking the
> console at mount the first numbered step and made a mount error explicitly blocking.

Say in your pull request **what went wrong** that prompted the change. A rule with a story behind
it survives; a rule someone thought sounded good gets deleted a year later by someone who cannot
tell whether it matters.

Avoid: vague encouragement ("be thorough", "do a great job"). It costs tokens and changes nothing.

### 2. Add a crew

Add `plugins/design-fleet/crews/<name>.json` with all thirteen stations named. Easiest way:

```bash
python3 plugins/design-fleet/bin/fleet.py new-crew --name <name> --label "<Label>"
cp ~/.copilot/design-fleet/crews/<name>.json plugins/design-fleet/crews/
```

Names must be distinct, start with a capital, and use letters, digits, dots, hyphens or
underscores — no spaces.

They must also not reuse a name the plugin already ships (`Shipwright`, `Surveyor`, `BuildR`
and so on). A generated agent lands beside the plugin's own, so a reused name leaves two
agents called the same thing — and pickers that hide the plugin namespace show them
identically. `fleet.py check` fails on this. The one exception is `shipyard`, which *is* the
shipped naming rather than a renaming of it; `fleet.py apply` refuses that pack instead.

### 3. Add a station

The highest bar, because every station costs the user money and attention. Before proposing one,
answer in the pull request:

- **What does it do that no existing station does?** If it overlaps, refine the existing one.
- **Who checks its work?** A making station with no checker breaks the one rule.
- **Why that model?** Right-sized for the role: lightweight for frequent mechanical work, stronger where independent judgement needs depth. Re-measure rather than trusting a permanent price ranking.

Then update all four together, or `check` will fail:

1. `agents/<Station>.agent.md` — filename is the name Copilot displays
2. `crews/roles.json` — id, display, group, title, purpose, model, family, edits, needs, optionalNeeds, skills
3. **every** file in `crews/` — all crews need a name for it
4. `README.md` — the roster table

### Merging a station into another

The reverse of adding one, and the same bar: say in the pull request **what overlapped**, and what
discipline the absorbed station carried that the survivor must now keep. Fold its rules into the
survivor's prose — a merge that quietly drops them is a capability deletion wearing a refactor's
clothes.

Delete the agent file and its entry in `crews/roles.json`, remove the name from **every** crew
pack, then add the mapping to `retired` in `roles.json`:

```json
"retired": { "wireframer": "designr" }
```

That last step matters. Users have their own crew packs in `~/.copilot/design-fleet/crews/`, and
without the mapping their next `check` reports a station that "does not exist" instead of telling
them where the work went.

### 4. Improve the fleet dashboard

The local dashboard lives in `plugins/design-fleet/dashboard/`. It is a React
and TypeScript application with a Python standard-library telemetry server.

Keep its trust boundary narrow:

- Do not display historical prompt or response content. Output from an explicit
  portal-launched command may be shown only to the initiating local user.
- Never read, print, or store GitHub tokens.
- Bind the server to loopback.
- Attribute work only when the event logs prove the station identity.
- Report missing telemetry as unknown or untested, never healthy.
- Require explicit confirmation and an AI-credit cap before a portal command
  auto-approves agent tools.
- Keep the committed `dist/` build current so plugin users do not need Node.js
  dependencies at runtime.

Run:

```bash
(
  cd plugins/design-fleet/dashboard
  corepack pnpm install --frozen-lockfile
  corepack pnpm lint
  corepack pnpm test:pipeline
  corepack pnpm test:accounts
  corepack pnpm test:state
  corepack pnpm test:server
  corepack pnpm build
)
```

Run Corepack from the dashboard directory so it uses the repository's pinned
pnpm version rather than a globally installed version.

---

## Working on it locally

```bash
git clone https://github.com/mbugua-j/design-fleet
cd design-fleet
```

To try your changes in Copilot, install from your clone. Remove the released copy first, or you
will see every station twice:

```bash
copilot plugin uninstall design-fleet
copilot plugin install ./plugins/design-fleet
```

Restart the CLI (and the desktop app — it caches the agent list), then call your station.

To go back to the released version:

```bash
copilot plugin uninstall design-fleet
copilot plugin install design-fleet@mbugua-j
```

---

## Before you open a pull request

```bash
python3 plugins/design-fleet/bin/fleet.py check
python3 -m unittest discover -s plugins/design-fleet/tests -p 'test_*.py'
```

This catches the mistakes that are easy to make and hard to spot — a `name:` that disagrees with
its filename (Copilot uses the **filename**, so the field alone changes nothing), an agent missing
from `roles.json`, a crew missing a station or reusing a name.

CI runs the same command, plus a render of every crew.
Validation runs on every pull request, including documentation-only
changes, so path filtering cannot leave a future required `check` status pending.
This does not itself enable branch protection; a repository administrator must configure it.

The standard-library tests cover project guidance, canonical/generated station contracts, and
the local watch-state helper (including partial coverage, edited comments and protected commits).
Watch changes must exercise temporary state only; never reset a contributor's real watch history.

**Actually run the station you changed.** A prompt edit that reads well and behaves no differently
is not an improvement. Say in the pull request what you observed before and after.

---

## Opening the pull request

Fork, branch, and open a pull request against `main`. In the description, say:

- What was wrong, concretely.
- What you changed.
- What you ran, and what it did differently afterwards.

Small pull requests get merged. One station per pull request is ideal.

---

## For maintainers

**Review it with the fleet.** Surveyor is the point of this repository:

```
Surveyor, review this pull request against the fleet's one rule
Contrarian, is this refinement earned, or is it someone's taste?
```

**Merging:**

1. Confirm `check` is green and the change respects the one rule.
2. Bump the version in **both** `plugins/design-fleet/.github/plugin/plugin.json` and
   `.github/plugin/marketplace.json` — CI fails if they disagree.
   Use the pre-1.0 policy below; do not automatically increment the major version.
3. Merge to `main`. The marketplace serves `main` directly, so it is live immediately.

### Versioning: small, deliberate increments

Keep the plugin on `0.x.y` until the owner explicitly approves a stable `1.0.0`
milestone. The current baseline is `0.3.0`; routine releases should progress
through `0.3.1`, `0.3.2`, and so on, not `4.0.0` or `5.0.0`.

| Increment | When to use it |
| --- | --- |
| Patch (`0.3.0` to `0.3.1`) | Compatible fixes, small UI refinements, documentation, model-default updates, and maintenance. |
| Minor (`0.3.x` to `0.4.0`) | A deliberate capability milestone, such as a new crew/station/skill, or an incompatible setup/state change with migration guidance. |
| Stable major (`1.0.0`) | Only an explicitly approved stable-release milestone, not an automatic response to a breaking change during `0.x` development. |

The reset from `3.0.0` to `0.3.0` changes numbering, not functionality. Keep the
historical changelog entries and published tags intact; do not rewrite them to
make the sequence appear monotonic. Across this boundary, a lower version does
not mean older code. Confirm existing installations receive the reset release
rather than assuming automatic update detection will accept the lower number.
The marketplace's own metadata version and private dashboard/deck package
versions are separate from the plugin version; do not reset those in tandem.

Maintain [`CHANGELOG.md`](CHANGELOG.md) in the same release pull request. Record the
plugin version, publication date, meaningful changes and any required migration.
Use `Unreleased` for changes not yet assigned to a release. Keep the plugin and
marketplace versions synchronized; never label a breaking setup/state change as
a patch simply because much of the diff is prose.

### Publishing a GitHub Release

Changing the manifests does not create a GitHub Release. After the version and
changelog changes are committed and merged into `main`, and that revision's CI
has passed, publish the matching release explicitly. For the numbering reset:

```bash
gh release create v0.3.0 \
  --repo mbugua-j/design-fleet \
  --target main \
  --title "Design Fleet 0.3.0" \
  --generate-notes \
  --latest
```

Use the same version in both manifests, the tag, and the release title. Replace
`main` with the full reviewed commit SHA when publishing a specific revision.
The command creates the tag if it does not exist; if it already exists, confirm
that it points to the intended revision before publishing. `--latest` explicitly
sets the Releases page's Latest marker, including across the numbering reset.
This command does not include uncommitted or unpushed local changes.

Review generated release notes and add required migration guidance before
announcing the release. Future routine releases use `v0.3.1`, `v0.3.2`, and so on.

On September 7, 2026, the existing GitHub release was renamed from `v2.0.0` to
`v0.2.0` with the owner's approval. Both tags identify the same original commit;
the old tag remains an alias, and the archived manifests still contain `2.0.0`.
This historical relabeling is distinct from the new `0.3.0` manifest version.

### Updating your installation

**Then update your own machine:**

```bash
copilot plugin update design-fleet@mbugua-j
```

Restart the CLI and the desktop app. Note that this updates the **plugin's** stations — personalised
copies you wrote into `~/.copilot/agents/` or `.github/agents/` are yours and are never touched. To
take the new version of a station you have personalised, re-apply it:

```bash
python3 "$FLEET/bin/fleet.py" apply --crew <yours> --scope user --stations <station> --force
```

`--force` overwrites, so keep your own edits somewhere first if you want to merge them by hand.
