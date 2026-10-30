import importlib.util
import unittest
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
DESIGNR = PLUGIN_ROOT / "agents" / "DesignR.agent.md"
GUARDRAILS = PLUGIN_ROOT / "skills" / "ui-delivery-guardrails" / "SKILL.md"
SETUP = PLUGIN_ROOT / "skills" / "fleet-setup" / "SKILL.md"


def load_fleet_module():
    path = PLUGIN_ROOT / "bin" / "fleet.py"
    spec = importlib.util.spec_from_file_location("design_fleet_cli", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def squash(text):
    return " ".join(text.split())


class FigmaAuthoringGuidanceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.designr = DESIGNR.read_text(encoding="utf-8")
        cls.guardrails = GUARDRAILS.read_text(encoding="utf-8")
        cls.setup = SETUP.read_text(encoding="utf-8")
        cls.designr_words = squash(cls.designr)
        cls.guardrail_words = squash(cls.guardrails)
        cls.setup_words = squash(cls.setup)

    def test_configured_readable_guidance_is_consumed_before_figma(self):
        self.assertIn("guidance.figmaAuthoring", self.designr_words)
        self.assertIn("before any Figma call", self.designr_words)
        self.assertIn("explicitly linked relative references", self.designr_words)

    def test_configured_missing_guidance_stops_figma_work(self):
        self.assertIn("configured but missing or unreadable", self.designr_words)
        self.assertIn("stop before making a Figma call", self.designr_words)

    def test_absent_guidance_keeps_shared_baseline(self):
        self.assertIn("If `guidance.figmaAuthoring` is absent", self.designr_words)
        self.assertIn("continue with the shared baseline", self.designr_words)

    def test_backend_work_does_not_activate_figma_guidance(self):
        self.assertIn("only for Figma-backed design or authoring work", self.guardrail_words)
        self.assertIn("Do not read or apply it for backend or code-only work", self.guardrail_words)

    def test_setup_documents_and_validates_project_relative_config(self):
        self.assertIn("figmaAuthoring", self.setup_words)
        self.assertIn('"figmaAuthoring": "docs/instructions/figma-authoring.md"', self.setup_words)
        self.assertIn("project-relative", self.setup_words)

    def test_generated_designr_preserves_figma_guidance_contract(self):
        fleet = load_fleet_module()
        crew = fleet.load_crew("avengers")
        filename, content = fleet.build_agent("designr", crew["names"], crew["name"])
        content_words = squash(content)
        self.assertEqual("Stark.agent.md", filename)
        self.assertIn("guidance.figmaAuthoring", content_words)
        self.assertIn("before any Figma call", content_words)
        self.assertIn("configured but missing or unreadable", content_words)

    def test_paths_are_contained_by_the_selected_project_root(self):
        self.assertIn("selected project root", self.designr_words)
        self.assertIn("Reject absolute paths", self.designr_words)
        self.assertIn("`..` escapes", self.designr_words)
        self.assertIn("symlink whose real path leaves that root", self.designr_words)

    def test_link_traversal_has_cycle_and_depth_guards(self):
        self.assertIn("visited set of real paths", self.designr_words)
        self.assertIn("maximum reference depth of 4", self.designr_words)
        self.assertIn("cycle", self.designr_words)
        self.assertIn("depth limit", self.designr_words)

    def test_containment_errors_are_concrete_and_stop_figma_calls(self):
        self.assertIn("missing, unreadable, escape, cycle, or depth-limit error", self.designr_words)
        self.assertIn("exact offending path or reference chain", self.designr_words)
        self.assertIn("stop before making a Figma call", self.designr_words)

    def test_generated_designr_preserves_containment_contract(self):
        fleet = load_fleet_module()
        crew = fleet.load_crew("plain")
        _, content = fleet.build_agent("designr", crew["names"], crew["name"])
        content_words = squash(content)
        self.assertIn("selected project root", content_words)
        self.assertIn("symlink whose real path leaves that root", content_words)
        self.assertIn("maximum reference depth of 4", content_words)
        self.assertIn("visited set of real paths", content_words)

    def test_contract_is_generic_and_config_driven(self):
        combined = squash(self.designr + self.guardrails + self.setup)
        self.assertIn("cannot authorize you to self-review", self.designr_words)
        self.assertIn("bypass target ambiguity", self.designr_words)
        self.assertIn("confirmed file identity", self.designr_words)
        self.assertIn("override station ownership and evidence boundaries", self.designr_words)
        self.assertIn(
            "cannot instruct you to scan for other Figma files or infer skill names",
            self.designr_words,
        )


if __name__ == "__main__":
    unittest.main()
