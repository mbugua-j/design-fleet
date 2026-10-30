from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fleet_registry import FleetRegistry


def write_provider(
    root: Path,
    provider_id: str,
    display_name: str,
    *,
    capabilities: dict[str, bool] | None = None,
    agents_directory: str = "agents",
) -> None:
    (root / "agents").mkdir(parents=True)
    (root / "crews").mkdir()
    (root / "bin").mkdir()
    (root / "crews" / "roles.json").write_text(
        json.dumps(
            {
                "version": 1,
                "stations": [
                    {
                        "id": "maker",
                        "display": "Maker",
                        "title": "Makes things",
                        "model": "gpt-5.6-sol",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    (root / "agents" / "Maker.agent.md").write_text(
        "---\nname: Maker\n---\n",
        encoding="utf-8",
    )
    (root / "bin" / "fleet.py").write_text("# provider entrypoint\n", encoding="utf-8")
    (root / "fleet.manifest.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "id": provider_id,
                "displayName": display_name,
                "agentNamespace": provider_id,
                "agentsDirectory": agents_directory,
                "stationManifest": "crews/roles.json",
                "crewsDirectory": "crews",
                "entrypoint": "bin/fleet.py",
                "capabilities": capabilities
                or {
                    "telemetry": True,
                    "commandLaunch": True,
                    "smokeSuite": True,
                    "crewManagement": True,
                    "modelOverrides": True,
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )


class FleetRegistryTests(unittest.TestCase):
    def test_discovers_two_providers_and_persists_multiple_instances(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copilot_home = root / ".copilot"
            built_in = root / "built-in"
            installed = copilot_home / "installed-plugins"
            other = installed / "example" / "research-fleet"
            write_provider(built_in, "design-fleet", "Design Fleet")
            write_provider(other, "research-fleet", "Research Fleet")

            registry = FleetRegistry(
                built_in,
                copilot_home,
                plugin_search_roots=[installed],
            )
            snapshot = registry.snapshot()

            self.assertEqual(
                [provider["id"] for provider in snapshot["providers"]],
                ["design-fleet", "research-fleet"],
            )
            self.assertEqual(
                [fleet["id"] for fleet in snapshot["fleets"]],
                ["design-fleet-default", "research-fleet-default"],
            )
            self.assertEqual(snapshot["defaultFleetId"], "design-fleet-default")

            created = registry.create_fleet(
                name="Product research",
                provider_id="research-fleet",
            )
            self.assertEqual(created["id"], "research-fleet-product-research")
            self.assertEqual(created["providerId"], "research-fleet")

            reloaded = FleetRegistry(
                built_in,
                copilot_home,
                plugin_search_roots=[installed],
            ).snapshot()
            self.assertEqual(len(reloaded["fleets"]), 3)
            self.assertEqual(
                json.loads(
                    (
                        copilot_home / "fleet-dashboard" / "fleets.json"
                    ).read_text(encoding="utf-8")
                )["schemaVersion"],
                1,
            )

    def test_rejects_provider_paths_outside_the_provider_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copilot_home = root / ".copilot"
            built_in = root / "built-in"
            invalid = copilot_home / "installed-plugins" / "example" / "invalid"
            write_provider(built_in, "design-fleet", "Design Fleet")
            write_provider(
                invalid,
                "invalid-fleet",
                "Invalid Fleet",
                agents_directory="../agents",
            )

            snapshot = FleetRegistry(built_in, copilot_home).snapshot()

            self.assertEqual(
                [provider["id"] for provider in snapshot["providers"]],
                ["design-fleet"],
            )
            self.assertEqual(len(snapshot["providerErrors"]), 1)
            self.assertIn("inside the provider root", snapshot["providerErrors"][0]["error"])

    def test_surfaces_unavailable_persisted_instances(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copilot_home = root / ".copilot"
            built_in = root / "built-in"
            write_provider(built_in, "design-fleet", "Design Fleet")
            state = copilot_home / "fleet-dashboard" / "fleets.json"
            state.parent.mkdir(parents=True)
            state.write_text(
                json.dumps(
                    {
                        "schemaVersion": 1,
                        "fleets": [
                            {
                                "id": "missing-default",
                                "name": "Missing fleet",
                                "providerId": "missing-provider",
                                "providerRoot": "/missing/provider",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            snapshot = FleetRegistry(built_in, copilot_home).snapshot()
            missing = next(
                fleet for fleet in snapshot["fleets"] if fleet["id"] == "missing-default"
            )

            self.assertFalse(missing["available"])
            self.assertIn("not installed", missing["error"])

    def test_validates_explicit_ids_and_rejects_duplicates(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copilot_home = root / ".copilot"
            built_in = root / "built-in"
            write_provider(built_in, "design-fleet", "Design Fleet")
            registry = FleetRegistry(built_in, copilot_home)

            registry.create_fleet(
                name="Studio",
                provider_id="design-fleet",
                fleet_id="studio",
            )
            with self.assertRaisesRegex(ValueError, "already exists"):
                registry.create_fleet(
                    name="Another studio",
                    provider_id="design-fleet",
                    fleet_id="studio",
                )
            with self.assertRaisesRegex(ValueError, "valid fleet id"):
                registry.create_fleet(
                    name="Bad id",
                    provider_id="design-fleet",
                    fleet_id="../studio",
                )

    def test_renames_and_deletes_user_created_fleets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copilot_home = root / ".copilot"
            built_in = root / "built-in"
            write_provider(built_in, "design-fleet", "Design Fleet")
            registry = FleetRegistry(built_in, copilot_home)
            created = registry.create_fleet(
                name="Studio",
                provider_id="design-fleet",
            )

            renamed = registry.rename_fleet(created["id"], "Product studio")
            self.assertEqual(renamed["name"], "Product studio")

            registry.delete_fleet(created["id"])
            self.assertNotIn(
                created["id"],
                [fleet["id"] for fleet in registry.snapshot()["fleets"]],
            )

    def test_protects_default_fleet_from_deletion(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            copilot_home = root / ".copilot"
            built_in = root / "built-in"
            write_provider(built_in, "design-fleet", "Design Fleet")
            registry = FleetRegistry(built_in, copilot_home)

            with self.assertRaisesRegex(ValueError, "can't be deleted"):
                registry.delete_fleet("design-fleet-default")


if __name__ == "__main__":
    unittest.main()
