## What was wrong

<!-- Concretely: what did a station do, or fail to do? A refinement with a story behind it
     survives; one that sounded good gets deleted later by someone who cannot tell if it matters. -->

## What I changed

<!-- Which station(s), crew, or docs. One station per pull request is ideal. -->

## What I ran, and what changed

<!-- Actually run the station you edited. A prompt edit that reads well and behaves no
     differently is not an improvement. Paste the before/after behaviour. -->

## Checklist

- [ ] `python3 plugins/design-fleet/bin/fleet.py check` passes
- [ ] I ran the station I changed and observed a real difference
- [ ] Making stations still never approve their own work
- [ ] Checking stations still cannot edit (no `edit` added to their `tools:`)
- [ ] A checker's `model:` is still a different family from the station it checks
- [ ] If I added or renamed a station: `roles.json`, **every** crew, and the README roster are updated
