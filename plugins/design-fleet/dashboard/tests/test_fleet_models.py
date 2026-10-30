from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parent.parent
PLUGIN_ROOT = DASHBOARD_ROOT.parent
FLEET_SCRIPT = PLUGIN_ROOT / "bin" / "fleet.py"
ROLES = json.loads(
    (PLUGIN_ROOT / "crews" / "roles.json").read_text(encoding="utf-8")
)["stations"]
EXPECTED_MODEL_PROFILES = {
    "designr": ("gpt-6.1-sol", "high"),
    "engraver": ("claude-sonnet-5.5", None),
    "design-review": ("grok-4.7", None),
    "contrarian": ("claude-sonnet-5.5", None),
    "scribe": ("claude-sonnet-5.5", None),
    "draftsman": ("gpt-6.1-sol", "high"),
    "envoy": ("gpt-6.1-sol", "medium"),
    "shipwright": ("gpt-6.1-sol", "high"),
    "surveyor": ("claude-sonnet-5.5", None),
    "lookout": ("mai-code-1.1-flash", None),
    "herald": ("gpt-5.6-terra", None),
    "buildr": ("claude-sonnet-5.5", None),
    "watchkeeper": ("claude-haiku-5.5", None),
}


class FleetModelOverrideTests(unittest.TestCase):
    def test_model_override_is_written_to_personalized_agent(self) -> None:
        with tempfile.TemporaryDirectory() as home:
            environment = {**os.environ, "COPILOT_HOME": home}
            command = [
                sys.executable,
                str(FLEET_SCRIPT),
                "new-crew",
                "--name",
                "model-test",
                "--label",
                "Model Test",
                "--force",
                "--model",
                "designr=claude-sonnet-5",
            ]
            for station in ROLES:
                command.extend(
                    ["--set", f"{station['id']}=Test{station['display'].replace('-', '')}"]
                )
            subprocess.run(command, env=environment, check=True, capture_output=True)
            subprocess.run(
                [
                    sys.executable,
                    str(FLEET_SCRIPT),
                    "apply",
                    "--crew",
                    "model-test",
                    "--scope",
                    "user",
                ],
                env=environment,
                check=True,
                capture_output=True,
            )
            generated = (
                Path(home) / "agents" / "TestDesignR.agent.md"
            ).read_text(encoding="utf-8")
            self.assertIn("\nmodel: claude-sonnet-5\n", generated)
            self.assertIn("\nreasoningEffort: high\n", generated)

    def test_model_and_effort_assignments_match_agent_sources(self) -> None:
        by_id = {station["id"]: station for station in ROLES}
        self.assertEqual(set(by_id), set(EXPECTED_MODEL_PROFILES))
        for station_id, (model, effort) in EXPECTED_MODEL_PROFILES.items():
            station = by_id[station_id]
            self.assertEqual(station["model"], model)
            self.assertEqual(station.get("reasoningEffort"), effort)
            source = (
                PLUGIN_ROOT / "agents" / f"{station['display']}.agent.md"
            ).read_text(encoding="utf-8")
            self.assertIn(f"\nmodel: {model}\n", source)
            if effort is None:
                self.assertNotIn("\nreasoningEffort:", source)
            else:
                self.assertIn(f"\nreasoningEffort: {effort}\n", source)

    def test_default_models_and_efforts_survive_every_bundled_crew(self) -> None:
        crew_paths = sorted((PLUGIN_ROOT / "crews").glob("*.json"))
        with tempfile.TemporaryDirectory() as directory:
            environment = {**os.environ, "COPILOT_HOME": str(Path(directory) / "home")}
            for crew_path in crew_paths:
                if crew_path.stem == "roles":
                    continue
                with self.subTest(crew=crew_path.stem):
                    crew = json.loads(crew_path.read_text(encoding="utf-8"))
                    destination = Path(directory) / crew_path.stem
                    subprocess.run(
                        [
                            sys.executable,
                            str(FLEET_SCRIPT),
                            "apply",
                            "--crew",
                            crew_path.stem,
                            "--scope",
                            "project",
                            "--dir",
                            str(destination),
                            "--allow-shipped-names",
                        ],
                        env=environment,
                        check=True,
                        capture_output=True,
                    )
                    for station_id, (model, effort) in EXPECTED_MODEL_PROFILES.items():
                        generated = (
                            destination
                            / ".github"
                            / "agents"
                            / f"{crew['names'][station_id]}.agent.md"
                        ).read_text(encoding="utf-8")
                        self.assertIn(f"\nmodel: {model}\n", generated)
                        if effort is None:
                            self.assertNotIn("\nreasoningEffort:", generated)
                        else:
                            self.assertIn(f"\nreasoningEffort: {effort}\n", generated)


if __name__ == "__main__":
    unittest.main()
