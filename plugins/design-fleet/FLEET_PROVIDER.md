# Fleet dashboard provider contract

`fleet.manifest.json` is the versioned contract that lets the dashboard discover
an installed agent fleet without hard-coding that plugin's directory layout.
The dashboard bundled with this plugin supports schema version `1`.

## Manifest

Place the manifest at the root of the provider plugin:

```json
{
  "schemaVersion": 1,
  "id": "example-fleet",
  "displayName": "Example Fleet",
  "agentNamespace": "example-fleet",
  "agentsDirectory": "agents",
  "stationManifest": "crews/roles.json",
  "crewsDirectory": "crews",
  "entrypoint": "bin/fleet.py",
  "capabilities": {
    "telemetry": true,
    "commandLaunch": true,
    "smokeSuite": true,
    "crewManagement": true,
    "modelOverrides": true
  }
}
```

| Field | Contract |
|---|---|
| `schemaVersion` | Must be `1`. Unknown versions are rejected. |
| `id` | Stable lowercase provider id: letters, digits, and hyphens, beginning with a letter. Installed providers must not reuse an id. |
| `displayName` | Human-readable provider name, 1–80 characters. |
| `agentNamespace` | Copilot plugin namespace used for `--agent namespace:AgentName`. Defaults conceptually to `id`, but providers should declare it. |
| `agentsDirectory` | Relative directory containing the provider's `.agent.md` files. |
| `stationManifest` | Relative JSON file containing the canonical station roster. |
| `crewsDirectory` | Relative directory containing shipped crew definitions. |
| `entrypoint` | Relative provider command used for crew creation/application. Required only when `crewManagement` is `true`. |
| `capabilities` | All five schema-v1 boolean flags must be present. |

Every declared path is resolved and must exist inside the provider root. Absolute
paths, traversal outside the root, and escaping symlinks are rejected. A browser
request can select only a registered fleet id; it cannot supply a provider root,
entrypoint, agent path, or executable path.

## Capabilities

- `telemetry`: the provider roster can be used to attribute local Copilot
  sessions and render dashboard station/model data.
- `commandLaunch`: the dashboard may run the provider's agents with Copilot CLI
  and the validated provider root.
- `smokeSuite`: the provider supports model smoke tests. This also requires
  `commandLaunch`.
- `crewManagement`: the provider entrypoint implements the crew command contract
  below.
- `modelOverrides`: crew definitions may override station models. The dashboard
  disables model controls when this is false.

Unsupported actions are disabled in the client and rejected again by the server.

## Station and crew data

The station manifest must contain a `stations` array. Each station needs stable
`id`, `display`, `title`, and `model` strings. Existing dashboard fields such as
`purpose`, `family`, `group`, and `reasoningEffort` remain optional but provide a
more complete dashboard.

Crew JSON files use the same shape as design-fleet: `name`, `label`, a `names`
mapping keyed by every station id, and an optional `models` mapping. User-owned
crew files are read from:

```text
$COPILOT_HOME/<provider-id>/crews/
```

When `crewManagement` is enabled, `entrypoint` must accept:

```text
python entrypoint new-crew --name ID --label LABEL --force \
  --set STATION=NAME [--model STATION=MODEL ...]

python entrypoint apply --crew ID --scope user
```

The command must return non-zero and write an actionable message to stdout or
stderr when it cannot complete.

## Discovery and instances

The dashboard always loads its own built-in provider, then searches only these
known Copilot plugin roots:

```text
$COPILOT_HOME/installed-plugins/
$COPILOT_HOME/plugins/
```

It searches those roots for `fleet.manifest.json`; it does not scan the user's
home directory. One deterministic default fleet instance is created for each
valid provider. Users can create additional named instances of the same
provider.

Fleet instances are stored outside every plugin so plugin updates cannot remove
them:

```text
$COPILOT_HOME/fleet-dashboard/fleets.json
```

Writes use a same-directory temporary file, flush and `fsync`, then atomic
replacement. Persisted instances whose provider is removed or becomes invalid
remain visible as unavailable rather than silently falling back to Design Fleet.

## Current schema-v1 limits

- Fleet instances can be created but not renamed or deleted in the dashboard.
- Instances of one provider share that provider's `TelemetryCollector` and its
  incremental event cache. Dashboard-launched jobs are still tagged and looked
  up by fleet id.
- Local Copilot session telemetry predating fleet ids can be attributed only to
  the provider's deterministic default instance.
- The dashboard does not install providers; install or update plugins through
  Copilot CLI, then refresh the dashboard.
