"""Discover fleet providers and persist user-owned fleet instances."""

from __future__ import annotations

import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


SCHEMA_VERSION = 1
SAFE_ID = re.compile(r"^[a-z][a-z0-9-]{0,63}$")
CAPABILITY_NAMES = (
    "telemetry",
    "commandLaunch",
    "smokeSuite",
    "crewManagement",
    "modelOverrides",
)


class FleetRegistryError(RuntimeError):
    """Raised when persisted registry state cannot be trusted."""


@dataclass(frozen=True)
class ProviderCapabilities:
    telemetry: bool
    command_launch: bool
    smoke_suite: bool
    crew_management: bool
    model_overrides: bool

    @classmethod
    def from_manifest(cls, payload: object) -> "ProviderCapabilities":
        if not isinstance(payload, dict):
            raise ValueError("capabilities must be an object")
        missing = [name for name in CAPABILITY_NAMES if name not in payload]
        if missing:
            raise ValueError(
                f"capabilities must include: {', '.join(CAPABILITY_NAMES)}"
            )
        invalid = [
            name for name in CAPABILITY_NAMES if not isinstance(payload[name], bool)
        ]
        if invalid:
            raise ValueError(
                f"capabilities must use boolean values: {', '.join(invalid)}"
            )
        return cls(
            telemetry=payload["telemetry"],
            command_launch=payload["commandLaunch"],
            smoke_suite=payload["smokeSuite"],
            crew_management=payload["crewManagement"],
            model_overrides=payload["modelOverrides"],
        )

    def to_dict(self) -> dict[str, bool]:
        return {
            "telemetry": self.telemetry,
            "commandLaunch": self.command_launch,
            "smokeSuite": self.smoke_suite,
            "crewManagement": self.crew_management,
            "modelOverrides": self.model_overrides,
        }


@dataclass(frozen=True)
class FleetProvider:
    id: str
    display_name: str
    agent_namespace: str
    root: Path
    agents_directory: Path
    station_manifest: Path
    crews_directory: Path
    entrypoint: Path | None
    capabilities: ProviderCapabilities

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "displayName": self.display_name,
            "agentNamespace": self.agent_namespace,
            "root": str(self.root),
            "agentsDirectory": str(self.agents_directory),
            "stationManifest": str(self.station_manifest),
            "crewsDirectory": str(self.crews_directory),
            "capabilities": self.capabilities.to_dict(),
        }


@dataclass(frozen=True)
class FleetInstance:
    id: str
    name: str
    provider_id: str
    provider_root: str
    crew: str | None = None
    config: dict[str, Any] | None = None

    def stored_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "providerId": self.provider_id,
            "providerRoot": self.provider_root,
        }
        if self.crew:
            payload["crew"] = self.crew
        if self.config:
            payload["config"] = self.config
        return payload


@dataclass(frozen=True)
class ResolvedFleet:
    instance: FleetInstance
    provider: FleetProvider

    @property
    def id(self) -> str:
        return self.instance.id


def _safe_relative_path(
    provider_root: Path,
    raw_path: object,
    field: str,
    *,
    directory: bool,
) -> Path:
    if not isinstance(raw_path, str) or not raw_path.strip():
        raise ValueError(f"{field} must be a non-empty relative path")
    relative = Path(raw_path)
    if relative.is_absolute():
        raise ValueError(f"{field} must stay inside the provider root")
    root = provider_root.resolve()
    candidate = (root / relative).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"{field} must stay inside the provider root")
    if directory and not candidate.is_dir():
        raise ValueError(f"{field} does not name an existing directory")
    if not directory and not candidate.is_file():
        raise ValueError(f"{field} does not name an existing file")
    return candidate


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:64].rstrip("-")


class FleetRegistry:
    """Owns provider discovery and user fleet-instance persistence."""

    def __init__(
        self,
        builtin_provider_root: Path,
        copilot_home: Path,
        *,
        plugin_search_roots: Iterable[Path] | None = None,
    ) -> None:
        self.builtin_provider_root = builtin_provider_root.resolve()
        self.copilot_home = copilot_home.expanduser().resolve()
        self.state_path = self.copilot_home / "fleet-dashboard" / "fleets.json"
        self.plugin_search_roots = tuple(
            path.expanduser().resolve()
            for path in (
                plugin_search_roots
                if plugin_search_roots is not None
                else (
                    self.copilot_home / "installed-plugins",
                    self.copilot_home / "plugins",
                )
            )
        )
        self.providers: dict[str, FleetProvider] = {}
        self.provider_errors: list[dict[str, str]] = []
        self.instances = self._load_instances()
        self.refresh()

    def _load_provider(self, provider_root: Path) -> FleetProvider:
        root = provider_root.resolve()
        manifest_path = (root / "fleet.manifest.json").resolve()
        if manifest_path != root / "fleet.manifest.json":
            raise ValueError("fleet.manifest.json must stay inside the provider root")
        try:
            payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        except OSError as error:
            raise ValueError(f"unable to read manifest: {error}") from error
        except json.JSONDecodeError as error:
            raise ValueError(f"manifest is not valid JSON: {error.msg}") from error
        if not isinstance(payload, dict):
            raise ValueError("manifest must contain an object")
        if payload.get("schemaVersion") != SCHEMA_VERSION:
            raise ValueError(f"unsupported schemaVersion; expected {SCHEMA_VERSION}")

        provider_id = payload.get("id")
        if not isinstance(provider_id, str) or not SAFE_ID.fullmatch(provider_id):
            raise ValueError(
                "id must start with a lowercase letter and contain only lowercase "
                "letters, digits, and hyphens"
            )
        display_name = payload.get("displayName")
        if (
            not isinstance(display_name, str)
            or not display_name.strip()
            or len(display_name.strip()) > 80
        ):
            raise ValueError("displayName is required and must be 80 characters or fewer")
        namespace = payload.get("agentNamespace", provider_id)
        if not isinstance(namespace, str) or not SAFE_ID.fullmatch(namespace):
            raise ValueError("agentNamespace must be a valid provider-style id")

        agents = _safe_relative_path(
            root, payload.get("agentsDirectory"), "agentsDirectory", directory=True
        )
        station_manifest = _safe_relative_path(
            root, payload.get("stationManifest"), "stationManifest", directory=False
        )
        crews = _safe_relative_path(
            root, payload.get("crewsDirectory"), "crewsDirectory", directory=True
        )
        capabilities = ProviderCapabilities.from_manifest(
            payload.get("capabilities")
        )
        raw_entrypoint = payload.get("entrypoint")
        entrypoint = (
            _safe_relative_path(
                root, raw_entrypoint, "entrypoint", directory=False
            )
            if raw_entrypoint is not None
            else None
        )
        if capabilities.crew_management and entrypoint is None:
            raise ValueError("entrypoint is required when crewManagement is enabled")

        return FleetProvider(
            id=provider_id,
            display_name=display_name.strip(),
            agent_namespace=namespace,
            root=root,
            agents_directory=agents,
            station_manifest=station_manifest,
            crews_directory=crews,
            entrypoint=entrypoint,
            capabilities=capabilities,
        )

    def _candidate_roots(self) -> list[Path]:
        candidates = [self.builtin_provider_root]
        for search_root in self.plugin_search_roots:
            if not search_root.is_dir():
                continue
            candidates.extend(
                path.parent.resolve()
                for path in search_root.rglob("fleet.manifest.json")
            )
        return sorted(set(candidates), key=str)

    def refresh(self) -> None:
        providers: dict[str, FleetProvider] = {}
        errors: list[dict[str, str]] = []
        ordered_roots = [self.builtin_provider_root]
        ordered_roots.extend(
            root
            for root in self._candidate_roots()
            if root != self.builtin_provider_root
        )
        for root in ordered_roots:
            try:
                provider = self._load_provider(root)
            except ValueError as error:
                errors.append({"root": str(root), "error": str(error)})
                continue
            existing = providers.get(provider.id)
            if existing is not None:
                errors.append(
                    {
                        "root": str(root),
                        "error": (
                            f"provider id '{provider.id}' duplicates "
                            f"{existing.root}"
                        ),
                    }
                )
                continue
            providers[provider.id] = provider
        self.providers = providers
        self.provider_errors = errors

        changed = False
        known_ids = {instance.id for instance in self.instances}
        for provider in self.providers.values():
            instance_id = f"{provider.id}-default"
            if instance_id in known_ids:
                continue
            self.instances.append(
                FleetInstance(
                    id=instance_id,
                    name=provider.display_name,
                    provider_id=provider.id,
                    provider_root=str(provider.root),
                )
            )
            known_ids.add(instance_id)
            changed = True
        if changed:
            self._write_instances()

    def _load_instances(self) -> list[FleetInstance]:
        if not self.state_path.exists():
            return []
        try:
            payload = json.loads(self.state_path.read_text(encoding="utf-8"))
        except OSError as error:
            raise FleetRegistryError(f"Unable to read fleet registry: {error}") from error
        except json.JSONDecodeError as error:
            raise FleetRegistryError(
                f"Fleet registry is not valid JSON: {error.msg}"
            ) from error
        if not isinstance(payload, dict) or payload.get("schemaVersion") != SCHEMA_VERSION:
            raise FleetRegistryError(
                f"Fleet registry must use schemaVersion {SCHEMA_VERSION}"
            )
        raw_instances = payload.get("fleets")
        if not isinstance(raw_instances, list):
            raise FleetRegistryError("Fleet registry fleets must be an array")

        instances: list[FleetInstance] = []
        seen: set[str] = set()
        for index, raw in enumerate(raw_instances):
            if not isinstance(raw, dict):
                raise FleetRegistryError(f"Fleet entry {index + 1} must be an object")
            fleet_id = raw.get("id")
            name = raw.get("name")
            provider_id = raw.get("providerId")
            provider_root = raw.get("providerRoot")
            if not isinstance(fleet_id, str) or not SAFE_ID.fullmatch(fleet_id):
                raise FleetRegistryError(f"Fleet entry {index + 1} has an invalid id")
            if fleet_id in seen:
                raise FleetRegistryError(f"Fleet id '{fleet_id}' is duplicated")
            if (
                not isinstance(name, str)
                or not name.strip()
                or len(name.strip()) > 80
            ):
                raise FleetRegistryError(
                    f"Fleet entry '{fleet_id}' has an invalid name"
                )
            if not isinstance(provider_id, str) or not SAFE_ID.fullmatch(provider_id):
                raise FleetRegistryError(
                    f"Fleet entry '{fleet_id}' has an invalid providerId"
                )
            if not isinstance(provider_root, str) or not provider_root:
                raise FleetRegistryError(
                    f"Fleet entry '{fleet_id}' has an invalid providerRoot"
                )
            crew = raw.get("crew")
            config = raw.get("config")
            if crew is not None and not isinstance(crew, str):
                raise FleetRegistryError(
                    f"Fleet entry '{fleet_id}' has an invalid crew"
                )
            if config is not None and not isinstance(config, dict):
                raise FleetRegistryError(
                    f"Fleet entry '{fleet_id}' has an invalid config"
                )
            seen.add(fleet_id)
            instances.append(
                FleetInstance(
                    id=fleet_id,
                    name=name.strip(),
                    provider_id=provider_id,
                    provider_root=provider_root,
                    crew=crew,
                    config=config,
                )
            )
        return instances

    def _write_instances(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schemaVersion": SCHEMA_VERSION,
            "fleets": [
                instance.stored_dict()
                for instance in sorted(self.instances, key=lambda item: item.id)
            ],
        }
        handle = tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=self.state_path.parent,
            prefix=".fleets-",
            suffix=".tmp",
            delete=False,
        )
        temporary = Path(handle.name)
        try:
            with handle:
                json.dump(payload, handle, ensure_ascii=True, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.state_path)
        except OSError:
            temporary.unlink(missing_ok=True)
            raise

    def _default_fleet_id(self) -> str | None:
        builtin_provider = next(
            (
                provider
                for provider in self.providers.values()
                if provider.root == self.builtin_provider_root
            ),
            None,
        )
        builtin_default = (
            f"{builtin_provider.id}-default" if builtin_provider else None
        )
        available = {
            instance.id
            for instance in self.instances
            if instance.provider_id in self.providers
        }
        if builtin_default in available:
            return builtin_default
        return min(available) if available else None

    def snapshot(self) -> dict[str, Any]:
        self.refresh()
        fleets = []
        for instance in sorted(self.instances, key=lambda item: item.id):
            provider = self.providers.get(instance.provider_id)
            fleets.append(
                {
                    **instance.stored_dict(),
                    "providerRoot": (
                        str(provider.root) if provider else instance.provider_root
                    ),
                    "available": provider is not None,
                    "error": (
                        None
                        if provider
                        else (
                            f"Provider '{instance.provider_id}' is not installed "
                            "or its manifest is invalid."
                        )
                    ),
                }
            )
        return {
            "schemaVersion": SCHEMA_VERSION,
            "defaultFleetId": self._default_fleet_id(),
            "providers": [
                provider.to_dict()
                for provider in sorted(self.providers.values(), key=lambda item: item.id)
            ],
            "fleets": fleets,
            "providerErrors": list(self.provider_errors),
        }

    def create_fleet(
        self,
        *,
        name: str,
        provider_id: str,
        fleet_id: str | None = None,
    ) -> dict[str, Any]:
        self.refresh()
        normalized_name = name.strip()
        if not normalized_name or len(normalized_name) > 80:
            raise ValueError("Fleet name is required and must be 80 characters or fewer")
        provider = self.providers.get(provider_id)
        if provider is None:
            raise ValueError("Select an available fleet provider")
        generated_id = _slug(f"{provider.id}-{normalized_name}")
        chosen_id = fleet_id or generated_id
        if not chosen_id or not SAFE_ID.fullmatch(chosen_id):
            raise ValueError(
                "Choose a valid fleet id using lowercase letters, digits, and hyphens"
            )
        if any(instance.id == chosen_id for instance in self.instances):
            raise ValueError(f"Fleet id '{chosen_id}' already exists")
        instance = FleetInstance(
            id=chosen_id,
            name=normalized_name,
            provider_id=provider.id,
            provider_root=str(provider.root),
        )
        self.instances.append(instance)
        self._write_instances()
        return {
            **instance.stored_dict(),
            "available": True,
            "error": None,
        }

    def rename_fleet(self, fleet_id: str, name: str) -> dict[str, Any]:
        self.refresh()
        normalized_name = name.strip()
        if not normalized_name or len(normalized_name) > 80:
            raise ValueError("Fleet name is required and must be 80 characters or fewer")
        index = next(
            (
                candidate_index
                for candidate_index, instance in enumerate(self.instances)
                if instance.id == fleet_id
            ),
            None,
        )
        if index is None:
            raise ValueError("Select a valid fleet")
        current = self.instances[index]
        updated = FleetInstance(
            id=current.id,
            name=normalized_name,
            provider_id=current.provider_id,
            provider_root=current.provider_root,
            crew=current.crew,
            config=current.config,
        )
        self.instances[index] = updated
        self._write_instances()
        return {
            **updated.stored_dict(),
            "available": updated.provider_id in self.providers,
            "error": None,
        }

    def delete_fleet(self, fleet_id: str) -> None:
        self.refresh()
        instance = next(
            (candidate for candidate in self.instances if candidate.id == fleet_id),
            None,
        )
        if instance is None:
            raise ValueError("Select a valid fleet")
        if instance.id == f"{instance.provider_id}-default":
            raise ValueError("Default fleet instances can't be deleted")
        self.instances = [
            candidate for candidate in self.instances if candidate.id != fleet_id
        ]
        self._write_instances()

    def resolve_fleet(self, fleet_id: str | None = None) -> ResolvedFleet:
        self.refresh()
        chosen_id = fleet_id or self._default_fleet_id()
        if not chosen_id:
            raise ValueError("No available fleet providers were discovered")
        instance = next(
            (candidate for candidate in self.instances if candidate.id == chosen_id),
            None,
        )
        if instance is None:
            raise ValueError("Select a valid fleet")
        provider = self.providers.get(instance.provider_id)
        if provider is None:
            raise ValueError(
                f"Fleet '{instance.name}' is unavailable because provider "
                f"'{instance.provider_id}' is not installed or is invalid"
            )
        return ResolvedFleet(instance=instance, provider=provider)
