from __future__ import annotations

import unittest
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
APP_SOURCE = (DASHBOARD_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
API_SOURCE = (DASHBOARD_ROOT / "src" / "api.ts").read_text(encoding="utf-8")
TYPE_SOURCE = (DASHBOARD_ROOT / "src" / "types.ts").read_text(encoding="utf-8")


class MultiFleetFrontendContractTests(unittest.TestCase):
    def test_types_and_api_are_fleet_aware(self) -> None:
        self.assertIn("export interface FleetProvider", TYPE_SOURCE)
        self.assertIn("export interface FleetInstance", TYPE_SOURCE)
        self.assertIn("export interface FleetsData", TYPE_SOURCE)
        self.assertIn("export async function getFleets", API_SOURCE)
        self.assertIn("export async function createFleet", API_SOURCE)
        self.assertIn("export async function renameFleet", API_SOURCE)
        self.assertIn("export async function deleteFleet", API_SOURCE)
        self.assertIn("fleetId: string", API_SOURCE)
        self.assertIn("params.set(\"fleet\", fleetId)", API_SOURCE)
        self.assertIn("body: JSON.stringify({ ...input, fleetId })", API_SOURCE)

    def test_navigation_uses_dedicated_picker_with_fleet_actions(self) -> None:
        fleet_section = APP_SOURCE.split(
            '<section className="fleet-nav-section" aria-label="Fleet">', 1
        )[1].split('<nav aria-label="Dashboard views">', 1)[0]
        self.assertIn("<FleetPicker", fleet_section)
        self.assertNotIn("<PeopleTeam24Regular", fleet_section)
        self.assertIn("onRename={setRenameFleetTarget}", fleet_section)
        self.assertIn("onDelete={setDeleteFleetTarget}", fleet_section)
        self.assertIn("function RenameFleetDialog", APP_SOURCE)
        self.assertIn("function DeleteFleetDialog", APP_SOURCE)
        self.assertIn("Create new fleet", APP_SOURCE)
        self.assertIn("<CreateFleetDialog", APP_SOURCE)
        self.assertIn("key={activeFleetId}", APP_SOURCE)
        self.assertIn("design-fleet:active-fleet:v1", APP_SOURCE)
        self.assertNotIn("design-fleet.dashboard-name", APP_SOURCE)
        self.assertNotIn("fleet-name-form", fleet_section)
        self.assertNotIn("activeProvider.displayName", fleet_section)
        self.assertNotIn("activeProvider.id", fleet_section)

    def test_create_dialog_exposes_provider_context_and_actionable_errors(self) -> None:
        self.assertIn("function CreateFleetDialog", APP_SOURCE)
        self.assertIn('ariaLabel="Fleet provider"', APP_SOURCE)
        self.assertIn("provider.displayName", APP_SOURCE)
        self.assertIn("provider.root", APP_SOURCE)
        self.assertIn('role="alert"', APP_SOURCE)
        self.assertIn("await createFleet", APP_SOURCE)
        self.assertIn('data-fleet-picker-trigger="true"', APP_SOURCE)
        self.assertIn("mobileMenuButtonRef.current?.focus()", APP_SOURCE)

    def test_capabilities_gate_provider_specific_actions(self) -> None:
        self.assertIn("activeProvider?.capabilities.commandLaunch", APP_SOURCE)
        self.assertIn("activeProvider?.capabilities.smokeSuite", APP_SOURCE)
        self.assertIn("activeProvider?.capabilities.crewManagement", APP_SOURCE)
        self.assertIn("activeProvider?.capabilities.modelOverrides", APP_SOURCE)
        self.assertIn("This provider keeps station models fixed.", APP_SOURCE)


if __name__ == "__main__":
    unittest.main()
