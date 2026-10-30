import {
  Add24Regular,
  AppsListDetail24Regular,
  ArrowReset20Regular,
  ArrowSortDown24Regular,
  ArrowSortUp24Regular,
  Board24Regular,
  BranchFork20Regular,
  BranchFork24Regular,
  Checkmark20Regular,
  CheckmarkCircle16Filled,
  ChevronDown20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  ChevronUp20Regular,
  Clock16Regular,
  Clock20Regular,
  Code20Regular,
  Copy24Regular,
  DataUsage24Regular,
  Delete24Regular,
  DesignIdeas20Regular,
  Desktop24Regular,
  Desktop20Regular,
  Drag20Regular,
  Dismiss24Regular,
  Dismiss16Regular,
  DismissCircle16Filled,
  Edit20Regular,
  Filter24Regular,
  Flowchart20Regular,
  Flowchart24Regular,
  History24Regular,
  Info16Regular,
  Key24Regular,
  MoreHorizontal24Regular,
  Navigation24Regular,
  Open16Regular,
  PanelLeft24Filled,
  PanelLeft24Regular,
  PaintBrush20Regular,
  PaintBrush24Regular,
  PeopleTeam24Regular,
  Person24Regular,
  Play24Regular,
  Pulse24Regular,
  Replay20Regular,
  Save24Regular,
  ScaleFit20Regular,
  Search24Regular,
  Settings24Regular,
  ShieldCheckmark20Regular,
  SignOut24Regular,
  Warning16Filled,
  WeatherMoon24Regular,
  WeatherSunny24Regular,
  ZoomIn20Regular,
  ZoomOut20Regular,
} from "@fluentui/react-icons";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Combobox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Dropdown,
  Input,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Spinner,
  Textarea,
  Tooltip,
  Title1,
  Title2,
  useComboboxFilter,
} from "@fluentui/react-components";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  activityIsLive,
  filterProjectItems,
  filterVisibleProjects,
  projectKey,
} from "./projectVisibility";
import {
  accountStorageKey,
  clearAccountContext,
  getAuthJob,
  getAuthStatus,
  getCommandJob,
  getCrews,
  getCurrentSmokeSuite,
  getDashboard,
  getFleets,
  getSmokeSuiteJob,
  deleteFleet,
  logoutAccount,
  renameFleet,
  saveCrew,
  startLogin,
  startAgentCommand,
  startSmokeSuite,
  switchAccount,
  createFleet,
} from "./api";
import {
  PIPELINE_LAYOUTS,
  PIPELINE_ZOOM_DEFAULT,
  PIPELINE_ZOOM_MAX,
  PIPELINE_ZOOM_MIN,
  PIPELINE_ZOOM_STEP,
  buildPipelinePath,
  calculatePipelineFitZoom,
  clampPipelinePosition,
  clampPipelineZoom,
  clonePipelinePositions,
  movePipelinePositionByKey,
  parsePipelinePositions,
  parsePipelineZoom,
  screenDeltaToPipelineWorld,
  serializePipelinePositions,
  serializePipelineZoom,
  type PipelineLayoutMode,
  type PipelineNodeId,
  type PipelinePoint,
  type PipelinePortSide,
  type PipelinePositionMap,
} from "./pipelineLayout";
import {
  defaultPalette,
  isPaletteId,
  type PaletteId,
} from "./themePalettes";
import type {
  AuthJob,
  AuthStatus,
  CommandJob,
  CrewsData,
  DashboardData,
  FleetInstance,
  FleetProvider,
  FleetsData,
  GitHubAccount,
  HandoffTask,
  HealthStatus,
  ModelSummary,
  ProcessSummary,
  ProjectSummary,
  SmokeSuiteJob,
  StationSummary,
} from "./types";

const ranges = [
  { value: 1, label: "24 hours" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const hiddenProjectsStorageKey = "design-fleet:hidden-projects:v1";
const clearedActivityStorageKey = "design-fleet:cleared-activity:v1";
const activeFleetStorageKey = "design-fleet:active-fleet:v1";
const telemetryRangeStorageKey = "design-fleet:telemetry-range:v1";
const refreshIntervalStorageKey = "design-fleet:refresh-interval:v1";
const refreshIntervals = [5_000, 10_000, 30_000, 60_000];

function loadRefreshInterval(): number {
  const stored = window.localStorage.getItem(refreshIntervalStorageKey);
  if (stored === null) return 5_000;
  const interval = refreshIntervals.find((value) => String(value) === stored);
  if (interval) return interval;
  console.warn("Ignoring invalid saved auto-refresh interval.", stored);
  return 5_000;
}

function loadTelemetryRange(): number {
  const stored = window.localStorage.getItem(telemetryRangeStorageKey);
  if (stored === null) return 7;
  const range = ranges.find((option) => String(option.value) === stored);
  if (range) return range.value;
  console.warn("Ignoring invalid saved telemetry range.", stored);
  return 7;
}

type ClearedActivityState = {
  all: string | null;
  projects: Record<string, string>;
};

function loadHiddenProjects(): string[] {
  const stored = window.localStorage.getItem(accountStorageKey(hiddenProjectsStorageKey));
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.filter((item): item is string => typeof item === "string")),
    );
  } catch (error) {
    console.warn("Ignoring invalid hidden project settings.", error);
    return [];
  }
}

function loadClearedActivity(): ClearedActivityState {
  const fallback: ClearedActivityState = { all: null, projects: {} };
  const stored = window.localStorage.getItem(accountStorageKey(clearedActivityStorageKey));
  if (!stored) return fallback;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fallback;
    }
    const value = parsed as Record<string, unknown>;
    const all =
      typeof value.all === "string" && Number.isFinite(Date.parse(value.all))
        ? value.all
        : null;
    const projects =
      value.projects
      && typeof value.projects === "object"
      && !Array.isArray(value.projects)
        ? Object.fromEntries(
            Object.entries(value.projects).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string"
                && Number.isFinite(Date.parse(entry[1])),
            ),
          )
        : {};
    return { all, projects };
  } catch (error) {
    console.warn("Ignoring invalid cleared activity settings.", error);
    return fallback;
  }
}

function filterClearedActivity(
  activity: ProcessSummary[],
  cleared: ClearedActivityState,
): ProcessSummary[] {
  const globalCutoff = cleared.all ? Date.parse(cleared.all) : Number.NaN;
  return activity.filter((item) => {
    if (activityIsLive(item)) return true;
    const projectCutoff = cleared.projects[item.project]
      ? Date.parse(cleared.projects[item.project])
      : Number.NaN;
    const cutoff = Math.max(
      Number.isFinite(globalCutoff) ? globalCutoff : 0,
      Number.isFinite(projectCutoff) ? projectCutoff : 0,
    );
    if (!cutoff) return true;
    const lastActivity = Date.parse(item.lastActivity);
    return !Number.isFinite(lastActivity) || lastActivity > cutoff;
  });
}

function hasAuthenticatedAccount(auth: AuthStatus | null): boolean {
  return Boolean(
    auth?.accounts.some((account) => account.active && account.state === "success"),
  );
}

const supportsViewTransitions = "startViewTransition" in document;
if (supportsViewTransitions) {
  document.documentElement.classList.add("view-transitions-supported");
}

function runUiTransition(update: () => void): void {
  if (
    !supportsViewTransitions
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }

  const transition = document.startViewTransition(() => {
    flushSync(update);
  });
  void transition.finished.then(
    () => undefined,
    () => undefined,
  );
}

let stationTransitionSequence = 0;

function runStationTransition(update: () => void): void {
  if (
    !supportsViewTransitions
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }

  const sequence = ++stationTransitionSequence;
  document.documentElement.classList.add("station-transition-active");
  const transition = document.startViewTransition(() => {
    flushSync(update);
  });
  const finish = () => {
    if (sequence === stationTransitionSequence) {
      document.documentElement.classList.remove("station-transition-active");
    }
  };
  void transition.finished.then(finish, finish);
}

type DashboardView =
  | "overview"
  | "pipeline"
  | "handoffs"
  | "activity"
  | "settings";

type AppearanceMode = "system" | "light" | "dark";
type StationSortKey =
  | "fleet"
  | "name"
  | "model"
  | "family"
  | "health"
  | "cost"
  | "runs"
  | "success"
  | "latency"
  | "recent";
type StationHealthFilter =
  | "all"
  | "healthy"
  | "issues"
  | "warning"
  | "down"
  | "untested";
type SettingsSection = "general" | "appearance" | "projects" | "agents";
type CommandPreset = {
  action?: "handoff" | "retry" | "run";
  kind?: "command" | "smoke";
  project?: string;
  stationId?: string;
  model?: string;
  prompt?: string;
  taskId?: string;
  taskTitle?: string;
};

type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string;
  disabled?: boolean;
};

function SearchableSelect({
  id,
  ariaDescribedBy,
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder = "Search or select",
  searchPlaceholder = "Type to filter",
  size = "medium",
  disabled = false,
  className = "",
  inlinePopup = true,
  clearable = true,
  clearValue = "",
}: {
  id?: string;
  ariaDescribedBy?: string;
  value: string;
  options: SearchableSelectOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  searchPlaceholder?: string;
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  className?: string;
  inlinePopup?: boolean;
  clearable?: boolean;
  clearValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    options.find((option) => option.value === value)?.label || "";
  const clearedLabel =
    options.find((option) => option.value === clearValue)?.label || "";
  const canClear = clearable && value !== clearValue;
  const [query, setQuery] = useState(selectedLabel);
  const inputRef = useRef<HTMLInputElement>(null);
  const clearSelection = () => {
    onValueChange(clearValue);
    setQuery(clearedLabel);
    inputRef.current?.focus();
  };
  const filterableOptions = options.map((option) => ({
    ...option,
    children: option.label,
  }));
  const filteredOptions = useComboboxFilter(query, filterableOptions, {
    noOptionsMessage: "No matching options",
    optionToReactKey: (option) => option.value || "__empty",
    optionToText: (option) =>
      `${option.label} ${option.keywords || ""}`.trim(),
    renderOption: (option) => (
      <Option
        key={option.value || "__empty"}
        value={option.value}
        text={option.label}
        disabled={option.disabled}
      >
        {option.label}
      </Option>
    ),
  });

  return (
    <Combobox
      id={id}
      aria-describedby={ariaDescribedBy}
      ref={inputRef}
      className={`searchable-select ${className}`.trim()}
      value={open ? query : selectedLabel}
      selectedOptions={
        options.some((option) => option.value === value) ? [value] : []
      }
      placeholder={open ? searchPlaceholder : placeholder}
      size={size}
      disabled={disabled}
      clearable={canClear}
      clearIcon={
        canClear
          ? {
              "aria-hidden": false,
              "aria-label": `Clear ${ariaLabel}`,
              role: "button",
              tabIndex: 0,
              onClick: clearSelection,
              onKeyDown: (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                clearSelection();
              },
            }
          : undefined
      }
      inlinePopup={inlinePopup}
      autoComplete="off"
      aria-label={ariaLabel}
      listbox={{ className: "searchable-select-listbox" }}
      onChange={(event) => {
        setQuery(event.target.value);
      }}
      onOpenChange={(_, data) => {
        setOpen(data.open);
        setQuery(data.open ? "" : selectedLabel);
      }}
      onOptionSelect={(_, data) => {
        if (data.optionValue === undefined) return;
        onValueChange(data.optionValue);
        setQuery(data.optionText || "");
      }}
    >
      {filteredOptions}
    </Combobox>
  );
}

function FleetPicker({
  fleets,
  providers,
  value,
  disabled,
  onValueChange,
  onCreate,
  onRename,
  onDelete,
}: {
  fleets: FleetInstance[];
  providers: FleetProvider[];
  value: string;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onCreate: () => void;
  onRename: (fleet: FleetInstance) => void;
  onDelete: (fleet: FleetInstance) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeFleet = fleets.find((fleet) => fleet.id === value) || null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredFleets = fleets.filter((fleet) => {
    if (!normalizedQuery) return true;
    const provider = providers.find(
      (candidate) => candidate.id === fleet.providerId,
    );
    return [
      fleet.name,
      fleet.id,
      provider?.displayName || "",
      fleet.providerId,
    ].some((candidate) =>
      candidate.toLocaleLowerCase().includes(normalizedQuery),
    );
  });

  return (
    <Popover
      open={open}
      positioning="below-start"
      trapFocus
      onOpenChange={(_, data) => {
        setOpen(data.open);
        if (!data.open) setQuery("");
      }}
    >
      <PopoverTrigger disableButtonEnhancement>
        <Button
          appearance="secondary"
          className="fleet-picker-trigger"
          type="button"
          disabled={disabled}
          aria-label={`Active fleet: ${activeFleet?.name || "none selected"}`}
          data-fleet-picker-trigger="true"
        >
          <span className="fleet-picker-trigger-copy">
            {activeFleet?.name || "Choose fleet"}
          </span>
          {open ? (
            <ChevronUp20Regular
              className="fleet-picker-trigger-chevron"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown20Regular
              className="fleet-picker-trigger-chevron"
              aria-hidden="true"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className="fleet-picker-popover" aria-label="Choose fleet">
        {fleets.length > 5 ? (
          <Input
            className="fleet-picker-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search fleets"
            placeholder="Search fleets"
            autoFocus
          />
        ) : null}
        <ul className="fleet-picker-list">
          {filteredFleets.map((fleet) => {
            const selected = fleet.id === value;
            const provider = providers.find(
              (candidate) => candidate.id === fleet.providerId,
            );
            const deletable = fleet.id !== `${fleet.providerId}-default`;
            const showProvider =
              !fleet.available
              || fleets.some(
                (candidate) =>
                  candidate.id !== fleet.id
                  && candidate.name.toLocaleLowerCase()
                    === fleet.name.toLocaleLowerCase(),
              );
            return (
              <li
                className={`fleet-picker-row ${
                  selected ? "selected" : ""
                } ${deletable ? "deletable" : ""}`}
                key={fleet.id}
              >
                <button
                  className="fleet-picker-select"
                  type="button"
                  disabled={!fleet.available}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    onValueChange(fleet.id);
                  }}
                >
                  <span className="fleet-picker-check" aria-hidden="true">
                    {selected ? <Checkmark20Regular /> : null}
                  </span>
                  <span className="fleet-picker-copy">
                    <strong>{fleet.name}</strong>
                    {showProvider ? (
                      <small>
                        {provider?.displayName || fleet.providerId}
                        {!fleet.available ? " · unavailable" : ""}
                      </small>
                    ) : null}
                  </span>
                </button>
                <Button
                  appearance="subtle"
                  size="small"
                  className="fleet-picker-action"
                  type="button"
                  icon={<Edit20Regular aria-hidden="true" />}
                  aria-label={`Rename ${fleet.name}`}
                  title={`Rename ${fleet.name}`}
                  onClick={() => {
                    setOpen(false);
                    onRename(fleet);
                  }}
                />
                {deletable ? (
                  <Button
                    appearance="subtle"
                    size="small"
                    className="fleet-picker-action fleet-picker-delete"
                    type="button"
                    icon={<Delete24Regular aria-hidden="true" />}
                    aria-label={`Delete ${fleet.name}`}
                    title={`Delete ${fleet.name}`}
                    onClick={() => {
                      setOpen(false);
                      onDelete(fleet);
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {!filteredFleets.length ? (
          <p className="fleet-picker-empty">No matching fleets</p>
        ) : null}
        <Button
          appearance="subtle"
          className="fleet-picker-create"
          type="button"
          icon={<Add24Regular aria-hidden="true" />}
          onClick={() => {
            setOpen(false);
            onCreate();
          }}
        >
          Create new fleet
        </Button>
      </PopoverSurface>
    </Popover>
  );
}

const stationSortOptions: Array<{ value: StationSortKey; label: string }> = [
  { value: "fleet", label: "Fleet order" },
  { value: "name", label: "Station name" },
  { value: "model", label: "Model" },
  { value: "family", label: "Model family" },
  { value: "health", label: "Health status" },
  { value: "cost", label: "AI credit cost" },
  { value: "runs", label: "Run count" },
  { value: "success", label: "Success rate" },
  { value: "latency", label: "First-token latency" },
  { value: "recent", label: "Most recent run" },
];

const healthRank: Record<HealthStatus, number> = {
  down: 0,
  failed: 0,
  cancelled: 0,
  stalled: 1,
  warning: 1,
  unknown: 2,
  untested: 2,
  stale: 2,
  unassigned: 3,
  running: 3,
  healthy: 4,
  completed: 4,
};

const appearanceModes: Array<{
  id: AppearanceMode;
  label: string;
  detail: string;
  icon: React.ReactNode;
}> = [
  {
    id: "system",
    label: "System",
    detail: "Match your device",
    icon: <Desktop24Regular aria-hidden="true" />,
  },
  {
    id: "light",
    label: "Light",
    detail: "Always use light",
    icon: <WeatherSunny24Regular aria-hidden="true" />,
  },
  {
    id: "dark",
    label: "Dark",
    detail: "Always use dark",
    icon: <WeatherMoon24Regular aria-hidden="true" />,
  },
];

const statusLabels: Record<HealthStatus, string> = {
  healthy: "Healthy",
  warning: "Needs attention",
  stale: "Test recommended",
  down: "Down",
  untested: "Not tested",
  unassigned: "Not assigned",
  running: "Running",
  stalled: "Stalled",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  unknown: "Unknown",
};

const modelDisplayNames = new Map([
  ["gpt-6-astra", "GPT-6 Astra"],
  ["gpt-5.6-sol", "GPT Sol"],
  ["gpt-5.6-sol-fast", "GPT Sol Fast"],
  ["gpt-5.6-terra", "GPT Terra"],
  ["claude-opus-5", "Claude Opus 5"],
  ["claude-sonnet-5", "Claude Sonnet 5"],
  ["claude-haiku-4.5", "Claude Haiku 4.5"],
  ["grok-4.6", "Grok 4.6"],
  ["mai-code-1.1-flash", "MAI-Code 1.1 Flash"],
]);

function sameValue<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reconcileList<T>(
  previous: T[],
  next: T[],
  key: (item: T) => string,
): T[] {
  const previousByKey = new Map(previous.map((item) => [key(item), item]));
  let changed = previous.length !== next.length;
  const reconciled = next.map((item) => {
    const existing = previousByKey.get(key(item));
    if (existing && sameValue(existing, item)) return existing;
    changed = true;
    return item;
  });
  return changed ? reconciled : previous;
}

function reconcileDashboard(
  previous: DashboardData | null,
  next: DashboardData,
): DashboardData {
  if (!previous) return next;
  return {
    ...next,
    summary: sameValue(previous.summary, next.summary)
      ? previous.summary
      : next.summary,
    projects: reconcileList(
      previous.projects,
      next.projects,
      (item) => item.repository,
    ),
    stations: reconcileList(previous.stations, next.stations, (item) => item.id),
    models: reconcileList(previous.models, next.models, (item) => item.model),
    processes: reconcileList(
      previous.processes,
      next.processes,
      (item) => item.id,
    ),
    smokeTest: sameValue(previous.smokeTest, next.smokeTest)
      ? previous.smokeTest
      : next.smokeTest,
    activity: reconcileList(previous.activity, next.activity, (item) => item.id),
    handoffs: reconcileList(previous.handoffs, next.handoffs, (item) => item.id),
    sources: sameValue(previous.sources, next.sources)
      ? previous.sources
      : next.sources,
  };
}

function statusIcon(status: HealthStatus) {
  if (status === "healthy") return undefined;
  if (status === "stale") {
    return <Clock16Regular aria-hidden="true" />;
  }
  if (status === "unassigned") return undefined;
  if (status === "completed") {
    return <CheckmarkCircle16Filled aria-hidden="true" />;
  }
  if (status === "down" || status === "failed" || status === "cancelled") {
    return <DismissCircle16Filled aria-hidden="true" />;
  }
  return <Warning16Filled aria-hidden="true" />;
}

function StatusBadge({
  status,
  minimal = false,
}: {
  status: HealthStatus;
  minimal?: boolean;
}) {
  const color =
    status === "healthy" || status === "completed"
      ? "success"
      : status === "down" ||
          status === "failed" ||
          status === "cancelled"
        ? "danger"
        : status === "warning" || status === "stalled" || status === "stale"
          ? "warning"
          : status === "running"
            ? "brand"
          : status === "unassigned"
              || status === "untested"
              || status === "unknown"
            ? "informative"
            : "subtle";
  return (
    <Badge
      appearance={minimal ? "ghost" : "outline"}
      color={color}
      shape="rounded"
      size="medium"
      className={`status-badge status-${status} ${
        minimal ? "status-badge-minimal" : ""
      }`}
      icon={minimal ? undefined : statusIcon(status)}
    >
      {statusLabels[status]}
    </Badge>
  );
}

function relativeTime(value: string | null): string {
  if (!value) return "Never";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Unknown";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function projectIsActive(project: ProjectSummary): boolean {
  return project.activeSessions > 0;
}

function projectMeta(project: ProjectSummary): string {
  if (project.activeSessions > 0) {
    if (!project.activeBranches.length) {
      return `${project.activeSessions} live ${
        project.activeSessions === 1 ? "session" : "sessions"
      } · ${project.runs} fleet runs`;
    }
    const branch =
      project.activeBranches.length === 1
        ? project.activeBranches[0]
        : `${project.activeBranches.length} active branches`;
    return `${branch} · ${project.activeSessions} live ${
      project.activeSessions === 1 ? "session" : "sessions"
    }`;
  }
  return `${project.runs} fleet runs · ${project.heraldPrs} Herald PRs`;
}

function formatCredits(value: number): string {
  return value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatDollars(credits: number): string {
  return (credits * 0.01).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function reasoningMode(reasoningEffort: string | null): string {
  if (!reasoningEffort) return "Inherited";
  if (reasoningEffort === "xhigh") return "Extra high";
  return reasoningEffort.charAt(0).toUpperCase() + reasoningEffort.slice(1);
}

function formatLatency(value: number | null): string {
  if (value === null) return "No data";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function formatMetricProgress(value: string, progress: number): string {
  return value.replace(/\d[\d,]*(?:\.\d+)?/g, (raw) => {
    const target = Number(raw.replaceAll(",", ""));
    if (!Number.isFinite(target)) return raw;
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
    const current = target * progress;
    if (decimals) return current.toFixed(decimals);
    const rounded = Math.round(current);
    return raw.includes(",") ? rounded.toLocaleString("en-US") : String(rounded);
  });
}

function AnimatedMetricValue({
  value,
  animate,
  delay,
}: {
  value: string | number;
  animate: boolean;
  delay: number;
}) {
  const target = String(value);
  const [shouldAnimate] = useState(
    () =>
      animate
      && /\d/.test(target)
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [initialDisplay] = useState(() =>
    shouldAnimate ? formatMetricProgress(target, 0) : target,
  );
  const [completed, setCompleted] = useState(!shouldAnimate);
  const animated = useRef(false);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const valueElement = valueRef.current;
    if (!valueElement) return;
    if (animated.current) {
      valueElement.textContent = target;
      const completionFrame = requestAnimationFrame(() => setCompleted(true));
      return () => cancelAnimationFrame(completionFrame);
    }
    animated.current = true;
    if (!shouldAnimate) {
      valueElement.textContent = target;
      return;
    }

    const duration = 900;
    const startAt = performance.now() + delay;
    let frame = 0;
    let cancelled = false;

    const step = (now: number) => {
      if (cancelled) return;
      if (now < startAt) {
        frame = requestAnimationFrame(step);
        return;
      }
      const elapsed = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      valueElement.textContent = formatMetricProgress(target, eased);
      if (elapsed < 1) {
        frame = requestAnimationFrame(step);
      } else {
        valueElement.textContent = target;
        setCompleted(true);
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [delay, shouldAnimate, target]);

  return (
    <p
      className={`metric-value ${completed ? "" : "is-counting"}`}
      aria-label={target}
      style={
        {
          "--metric-count-delay": `${delay}ms`,
        } as React.CSSProperties
      }
    >
      <span ref={valueRef} aria-hidden="true">
        {initialDisplay}
      </span>
    </p>
  );
}

const MetricCard = memo(function MetricCard({
  label,
  value,
  detail,
  info,
  tone = "neutral",
  animate = false,
  animationDelay = 0,
}: {
  label: string;
  value: string | number;
  detail: string;
  info?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  animate?: boolean;
  animationDelay?: number;
}) {
  return (
    <Card
      appearance="filled"
      role="article"
      className={`metric-card metric-${tone}`}
    >
      <p className="eyebrow">{label}</p>
      <div className="metric-copy">
        <AnimatedMetricValue
          value={value}
          animate={animate}
          delay={animationDelay}
        />
        <div className="metric-detail-row">
          <p className="metric-detail">{detail}</p>
          {info ? (
            <Tooltip
              content={info}
              relationship="description"
              positioning="above"
              withArrow
            >
              <Button
                appearance="subtle"
                className="metric-info-button"
                size="small"
                type="button"
                icon={<Info16Regular aria-hidden="true" />}
                aria-label={`About ${label.toLowerCase()}`}
              />
            </Tooltip>
          ) : null}
        </div>
      </div>
    </Card>
  );
});

const StationCard = memo(function StationCard({
  station,
  smokeEnabled,
  crewConfigurationEnabled,
  modelOverridesEnabled,
  onSmokeTest,
  onConfigureModel,
  onCopyModel,
}: {
  station: StationSummary;
  smokeEnabled: boolean;
  crewConfigurationEnabled: boolean;
  modelOverridesEnabled: boolean;
  onSmokeTest: (station: StationSummary) => void;
  onConfigureModel: (station: StationSummary) => void;
  onCopyModel: (model: string) => void;
}) {
  return (
    <Card
      appearance="outline"
      size="large"
      role="article"
      className="station-card"
    >
      <header className="station-card-header">
        <div className="station-avatar" aria-hidden="true">
          {station.display.slice(0, 1)}
        </div>
        <div className="station-heading">
          <h3>{station.display}</h3>
          <p className="station-subtitle">
            <span className="station-model-name" title={station.model}>
              {modelDisplayNames.get(station.model) ?? station.model}
            </span>
          </p>
        </div>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button
              appearance="subtle"
              size="small"
              className="station-card-menu-button"
              icon={<MoreHorizontal24Regular aria-hidden="true" />}
              aria-label={`Actions for ${station.display}`}
            />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem
                icon={<Pulse24Regular aria-hidden="true" />}
                onClick={() => onSmokeTest(station)}
                disabled={!smokeEnabled}
              >
                Run smoke test
              </MenuItem>
              <MenuItem
                icon={<Settings24Regular aria-hidden="true" />}
                onClick={() => onConfigureModel(station)}
                disabled={!crewConfigurationEnabled}
              >
                {modelOverridesEnabled
                  ? "Change model"
                  : "Configure station names"}
              </MenuItem>
              <MenuItem
                icon={<Copy24Regular aria-hidden="true" />}
                onClick={() => onCopyModel(station.model)}
              >
                Copy model ID
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </header>
      <p className="station-purpose">
        <strong className="station-role">{station.title}</strong>
        {station.purpose}
      </p>
      <dl className="station-stats">
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`station-status-text status-${station.status}`}>
              {statusLabels[station.status]}
            </span>
          </dd>
        </div>
        <div>
          <dt>Model family</dt>
          <dd>{station.family}</dd>
        </div>
        <div>
          <dt>AI credits</dt>
          <dd>
            <Tooltip
              content={{
                children: `${formatDollars(
                  station.aiu,
                )} consumption equivalent. This is not an invoice.`,
                className: "station-credit-tooltip",
              }}
              relationship="description"
              positioning="above"
              withArrow
            >
              <span
                className="station-credit-value"
                tabIndex={0}
                aria-label={`${formatCredits(
                  station.aiu,
                )} AI credits, ${formatDollars(
                  station.aiu,
                )} consumption equivalent`}
              >
                {formatCredits(station.aiu)}
              </span>
            </Tooltip>
          </dd>
        </div>
        <div>
          <dt>Reasoning mode</dt>
          <dd>{reasoningMode(station.reasoningEffort)}</dd>
        </div>
      </dl>
    </Card>
  );
});

const masonryRowHeight = 1;
const masonryRowGap = 0;
const defaultMasonryRowSpan = 372;

function StationMasonryItem({
  id,
  column,
  rowStart,
  rowSpan,
  onMeasure,
  children,
}: {
  id: string;
  column: number;
  rowStart: number;
  rowSpan: number;
  onMeasure: (id: string, rowSpan: number) => void;
  children: React.ReactNode;
}) {
  const itemRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) return;
    const measure = () => {
      const height = item.getBoundingClientRect().height;
      const nextSpan = Math.max(
        1,
        Math.ceil(
          (height + masonryRowGap) / (masonryRowHeight + masonryRowGap),
        ),
      );
      onMeasure(id, nextSpan);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(item);
    return () => observer.disconnect();
  }, [id, onMeasure]);

  return (
    <div
      className="station-grid-item"
      ref={itemRef}
      style={{
        gridColumn: column,
        gridRowStart: rowStart,
        gridRowEnd: `span ${rowSpan}`,
        viewTransitionName: `station-card-${id}`,
      }}
    >
      {children}
    </div>
  );
}

const StationMasonryGrid = memo(function StationMasonryGrid({
  stations,
  smokeEnabled,
  crewConfigurationEnabled,
  modelOverridesEnabled,
  onSmokeTest,
  onConfigureModel,
  onCopyModel,
}: {
  stations: StationSummary[];
  smokeEnabled: boolean;
  crewConfigurationEnabled: boolean;
  modelOverridesEnabled: boolean;
  onSmokeTest: (station: StationSummary) => void;
  onConfigureModel: (station: StationSummary) => void;
  onCopyModel: (model: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [rowSpans, setRowSpans] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const styles = window.getComputedStyle(grid);
      const configuredCount = Number.parseInt(
        styles.getPropertyValue("--station-grid-columns"),
        10,
      );
      const template = styles.gridTemplateColumns;
      const nextCount = Number.isFinite(configuredCount) && configuredCount > 0
        ? configuredCount
        : template === "none"
          ? 1
          : template.split(/\s+/).filter(Boolean).length;
      setColumnCount((current) =>
        current === nextCount ? current : nextCount,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const measureItem = useCallback((id: string, rowSpan: number) => {
    setRowSpans((current) =>
      current[id] === rowSpan ? current : { ...current, [id]: rowSpan },
    );
  }, []);
  const columnRows = Array.from({ length: columnCount }, () => 1);
  const placements = stations.map((station, index) => {
    const columnIndex = index % columnCount;
    const rowSpan = rowSpans[station.id] || defaultMasonryRowSpan;
    const rowStart = columnRows[columnIndex];
    columnRows[columnIndex] += rowSpan;
    return {
      station,
      column: columnIndex + 1,
      rowStart,
      rowSpan,
    };
  });

  return (
    <div className="station-grid station-grid-masonry" ref={gridRef}>
      {placements.map(({ station, column, rowStart, rowSpan }) => (
        <StationMasonryItem
          id={station.id}
          column={column}
          rowStart={rowStart}
          rowSpan={rowSpan}
          onMeasure={measureItem}
          key={station.id}
        >
          <StationCard
            station={station}
            smokeEnabled={smokeEnabled}
            crewConfigurationEnabled={crewConfigurationEnabled}
            modelOverridesEnabled={modelOverridesEnabled}
            onSmokeTest={onSmokeTest}
            onConfigureModel={onConfigureModel}
            onCopyModel={onCopyModel}
          />
        </StationMasonryItem>
      ))}
    </div>
  );
});

const ProcessList = memo(function ProcessList({
  processes,
  emptyMessage,
  minimalStatusBadges = false,
}: {
  processes: ProcessSummary[];
  emptyMessage: string;
  minimalStatusBadges?: boolean;
}) {
  if (!processes.length) {
    return (
      <div className="empty-state">
        <CheckmarkCircle16Filled aria-hidden="true" />
        <p>{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="process-list">
      {processes.map((process) => (
        <article className="process-row" key={process.id}>
          <div className="process-marker" aria-hidden="true" />
          <div className="process-main">
            <div className="process-title-line">
              <strong>{process.title}</strong>
              <StatusBadge
                status={process.status}
                minimal={minimalStatusBadges}
              />
            </div>
            <p>
              {process.station} · {process.project}
            </p>
            <span>
              {process.model || "Model not recorded"} · {process.calls} calls ·{" "}
              {formatCredits(process.aiu)} credits · {formatDollars(process.aiu)}
            </span>
          </div>
          <div className="process-time">
            <span>{relativeTime(process.lastActivity)}</span>
            {process.prUrl ? (
              <a
                href={process.prUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open pull request created by ${process.station}`}
              >
                <Open16Regular aria-hidden="true" />
                PR
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
});

const ProjectButton = memo(function ProjectButton({
  project,
  selected,
  onSelect,
  onRemove,
}: {
  project: ProjectSummary;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="project-nav-item">
      <Button
        appearance="subtle"
        className={`project-button ${selected ? "selected" : ""}`}
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${project.repository}, ${
          projectIsActive(project) ? "active" : "inactive"
        }, ${project.activeSessions} live sessions, ${project.runs} fleet runs, ${
          project.heraldPrs
        } Herald pull requests, active branches ${
          project.activeBranches.join(", ") || "none"
        }, ${
          project.configured ? "fleet configured" : "fleet not configured"
        }`}
        title={project.repository}
      >
        <span className="project-icon" aria-hidden="true">
          <BranchFork24Regular />
        </span>
        <span className="project-copy">
          <span
            className={`project-name ${
              projectIsActive(project) ? "project-name-active" : ""
            }`}
          >
            {project.repository}
          </span>
          <span>{projectMeta(project)}</span>
        </span>
      </Button>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="subtle"
            className="project-menu-button"
            type="button"
            icon={<MoreHorizontal24Regular aria-hidden="true" />}
            aria-label={`Manage ${project.repository}`}
            title={`Manage ${project.repository}`}
          />
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem
              icon={<Dismiss16Regular aria-hidden="true" />}
              onClick={onRemove}
            >
              Remove from navigation
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
});

function ProjectSettingsPanel({
  projects,
  hiddenProjects,
  onHideProject,
  onShowProject,
}: {
  projects: ProjectSummary[];
  hiddenProjects: string[];
  onHideProject: (repository: string) => void;
  onShowProject: (repository: string) => void;
}) {
  const hidden = new Set(hiddenProjects.map(projectKey));
  const visibleProjects = filterVisibleProjects(projects, hiddenProjects);
  const hiddenProjectSummaries = projects.filter((candidate) =>
    hidden.has(projectKey(candidate.repository)),
  );

  function projectRow(candidate: ProjectSummary, isHidden: boolean) {
    return (
      <Card
        appearance="filled"
        className="project-settings-row"
        key={candidate.repository}
      >
        <span className="project-settings-icon" aria-hidden="true">
          <BranchFork24Regular />
        </span>
        <span className="project-settings-copy">
          <strong>{candidate.repository}</strong>
          <small>{projectMeta(candidate)}</small>
        </span>
        <Button
          appearance="secondary"
          className="secondary-button"
          type="button"
          icon={
            isHidden
              ? <Add24Regular aria-hidden="true" />
              : <Dismiss16Regular aria-hidden="true" />
          }
          onClick={() =>
            isHidden
              ? onShowProject(candidate.repository)
              : onHideProject(candidate.repository)
          }
          aria-label={`${
            isHidden ? "Show" : "Remove"
          } ${candidate.repository} ${
            isHidden ? "in" : "from"
          } navigation`}
        >
          {isHidden ? "Show in navigation" : "Remove from navigation"}
        </Button>
      </Card>
    );
  }

  return (
    <>
      <div className="settings-intro">
        <Title1 as="h3">Projects</Title1>
        <p>
          Choose which observed repositories appear in the dashboard navigation.
          Removing a project from navigation does not delete its local telemetry.
        </p>
      </div>
      <section
        className="settings-section"
        aria-labelledby="visible-projects-title"
      >
        <div className="settings-section-heading">
          <div>
            <Title2 as="h4" id="visible-projects-title">
              Visible projects
            </Title2>
            <p>Projects currently available in the left navigation.</p>
          </div>
          <Badge appearance="outline" color="subtle" shape="rounded">
            {visibleProjects.length}
          </Badge>
        </div>
        {visibleProjects.length ? (
          <div className="project-settings-list">
            {visibleProjects.map((candidate) => projectRow(candidate, false))}
          </div>
        ) : (
          <p className="project-settings-empty">No projects are visible.</p>
        )}
      </section>
      <section
        className="settings-section"
        aria-labelledby="hidden-projects-title"
      >
        <div className="settings-section-heading">
          <div>
            <Title2 as="h4" id="hidden-projects-title">
              Hidden projects
            </Title2>
            <p>Restore a project when you want it back in the navigation.</p>
          </div>
          <Badge appearance="outline" color="subtle" shape="rounded">
            {hiddenProjectSummaries.length}
          </Badge>
        </div>
        {hiddenProjectSummaries.length ? (
          <div className="project-settings-list">
            {hiddenProjectSummaries.map((candidate) =>
              projectRow(candidate, true),
            )}
          </div>
        ) : (
          <p className="project-settings-empty">No projects are hidden.</p>
        )}
      </section>
    </>
  );
}

const HandoffBoard = memo(function HandoffBoard({
  stations,
  tasks,
  projects,
  project,
  actionsEnabled,
  refreshInterval,
  onHandoff,
  onRetry,
}: {
  stations: StationSummary[];
  tasks: HandoffTask[];
  projects: ProjectSummary[];
  project: string;
  actionsEnabled: boolean;
  refreshInterval: number;
  onHandoff: (task: HandoffTask, station: StationSummary) => void;
  onRetry: (task: HandoffTask) => void;
}) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropStationId, setDropStationId] = useState<string | null>(null);
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const boardTasks = tasks.filter(
    (task) => showTaskHistory || activityIsLive(task),
  );
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardScroll, setBoardScroll] = useState({ left: false, right: false });
  const stationNames = new Map(
    stations.map((station) => [station.id, station.display]),
  );
  const runnableProjects = new Set(
    projects.map((candidate) => candidate.repository),
  );

  function canRunTask(task: HandoffTask): boolean {
    return (
      actionsEnabled
      && runnableProjects.has(task.project)
      && task.status !== "running"
    );
  }

  function startTaskDrag(
    event: React.DragEvent<HTMLDivElement>,
    task: HandoffTask,
  ) {
    if (!canRunTask(task)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-design-fleet-task", task.id);
    event.dataTransfer.setData("text/plain", task.id);
    setDraggingTaskId(task.id);
  }

  function finishTaskDrag() {
    setDraggingTaskId(null);
    setDropStationId(null);
  }

  function scrollBoard(direction: number) {
    const board = boardRef.current;
    if (!board) return;
    const column = board.firstElementChild;
    board.scrollBy({
      left: direction * (column instanceof HTMLElement ? column.offsetWidth : board.clientWidth),
    });
  }

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const updateScroll = () => {
      const left = board.scrollLeft > 0;
      const right = Math.ceil(board.scrollLeft + board.clientWidth) < board.scrollWidth;
      setBoardScroll((current) =>
        current.left === left && current.right === right ? current : { left, right },
      );
    };
    const observer = new ResizeObserver(updateScroll);
    observer.observe(board);
    board.addEventListener("scroll", updateScroll, { passive: true });
    return () => {
      observer.disconnect();
      board.removeEventListener("scroll", updateScroll);
    };
  }, [stations.length]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const scrollHorizontally = (event: WheelEvent) => {
      // Leave trackpad gestures native; support Shift+wheel for a vertical mouse wheel.
      if (!event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
        || event.ctrlKey || event.metaKey || event.altKey) return;
      const horizontalDelta = event.deltaY;
      if (!horizontalDelta || board.scrollWidth <= board.clientWidth) return;

      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? board.clientWidth
            : 1;
      event.preventDefault();
      board.scrollLeft += horizontalDelta * multiplier;
    };

    board.addEventListener("wheel", scrollHorizontally, { passive: false });
    return () => board.removeEventListener("wheel", scrollHorizontally);
  }, []);

  return (
    <section
      className="handoff-view view-enter"
      aria-labelledby="handoff-title"
    >
      <div className="page-heading">
        <div>
          <Title1 as="h2" id="handoff-title">
            Board
          </Title1>
          <p>
            {project === "all"
              ? "Observed task movement across visible projects."
              : `Observed task movement for ${project}.`}
          </p>
        </div>
        <div className="handoff-controls">
          {boardScroll.left || boardScroll.right ? (
            <div className="handoff-navigation" role="group" aria-label="Board navigation">
              <Button
                appearance="secondary"
                size="small"
                icon={<ChevronLeft20Regular aria-hidden="true" />}
                aria-label="Scroll Board left"
                aria-controls="handoff-board"
                disabled={!boardScroll.left}
                onClick={() => scrollBoard(-1)}
              />
              <Button
                appearance="secondary"
                size="small"
                icon={<ChevronRight20Regular aria-hidden="true" />}
                aria-label="Scroll Board right"
                aria-controls="handoff-board"
                disabled={!boardScroll.right}
                onClick={() => scrollBoard(1)}
              />
            </div>
          ) : null}
          <Checkbox
            label="Show task history"
            checked={showTaskHistory}
            onChange={(_, data) => setShowTaskHistory(data.checked === true)}
          />
          <div className="live-state">
            <span className="live-dot" aria-hidden="true" />
            Updating every {refreshInterval / 1000} seconds
          </div>
        </div>
      </div>
      <p className="handoff-note">
        Running and stalled tasks are shown by default. Show task history to
        revisit finished work. Drag a task to another agent, or use its handoff
        menu. The agent starts after you confirm the guarded run, and the observed
        task history stays attached to the card.
      </p>
      <div
        ref={boardRef}
        id="handoff-board"
        className="handoff-board"
        role="region"
        aria-label="Fleet handoff columns"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || event.altKey || event.ctrlKey
            || event.metaKey || event.shiftKey) return;
          if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            scrollBoard(event.key === "ArrowLeft" ? -1 : 1);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            event.currentTarget.scrollTo({
              left: event.key === "Home" ? 0 : event.currentTarget.scrollWidth,
            });
          }
        }}
      >
        {stations.map((station) => {
          const columnTasks = boardTasks.filter(
            (task) => task.currentStation === station.id,
          );
          const draggedTask = tasks.find(
            (task) => task.id === draggingTaskId,
          );
          const canDrop =
            draggedTask !== undefined
            && canRunTask(draggedTask)
            && draggedTask.currentStation !== station.id;
          return (
            <section
              className="handoff-column"
              aria-labelledby={`handoff-column-${station.id}`}
              data-drop-target={
                canDrop && dropStationId === station.id ? "true" : undefined
              }
              onDragEnter={(event) => {
                if (!canDrop) return;
                event.preventDefault();
                setDropStationId(station.id);
              }}
              onDragOver={(event) => {
                if (!canDrop) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget;
                if (
                  nextTarget instanceof Node
                  && event.currentTarget.contains(nextTarget)
                ) {
                  return;
                }
                if (dropStationId === station.id) setDropStationId(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const taskId =
                  event.dataTransfer.getData(
                    "application/x-design-fleet-task",
                  )
                  || event.dataTransfer.getData("text/plain");
                const task = tasks.find((candidate) => candidate.id === taskId);
                finishTaskDrag();
                if (
                  task
                  && canRunTask(task)
                  && task.currentStation !== station.id
                ) {
                  onHandoff(task, station);
                }
              }}
              key={station.id}
            >
              <header className="handoff-column-header">
                <span className="station-avatar" aria-hidden="true">
                  {station.display.slice(0, 1)}
                </span>
                <span>
                  <strong id={`handoff-column-${station.id}`}>
                    {station.display}
                  </strong>
                  <small>{columnTasks.length} tasks</small>
                </span>
              </header>
              <div className="handoff-column-body">
                {columnTasks.length ? (
                  columnTasks.map((task) => {
                    return (
                      <Card
                        appearance="filled"
                        className="handoff-card"
                        data-dragging={
                          draggingTaskId === task.id ? "true" : undefined
                        }
                        draggable={canRunTask(task)}
                        onDragStart={(event) => startTaskDrag(event, task)}
                        onDragEnd={finishTaskDrag}
                        title={
                          canRunTask(task)
                            ? "Drag this task to another agent"
                            : undefined
                        }
                        key={task.id}
                      >
                      <div className="handoff-card-heading">
                        <span className="handoff-card-title">
                          <Drag20Regular aria-hidden="true" />
                          <strong>{task.title}</strong>
                        </span>
                        <StatusBadge status={task.status} />
                      </div>
                      <p>{task.project}</p>
                      <div className="handoff-trail" aria-label="Observed agent trail">
                        {task.history.map((step, index) => (
                          <span key={`${step.station}:${step.startedAt}`}>
                            {index ? (
                              <span aria-hidden="true">→</span>
                            ) : null}
                            <span
                              className={
                                step.station === task.currentStation
                                  ? "current"
                                  : ""
                              }
                            >
                              {stationNames.get(step.station) || step.station}
                            </span>
                          </span>
                        ))}
                      </div>
                      <div
                        className="handoff-card-actions"
                        onDragStart={(event) => event.stopPropagation()}
                      >
                        <SearchableSelect
                          size="small"
                          value=""
                          ariaLabel={`Hand off ${task.title} to another agent`}
                          placeholder="Hand off to..."
                          searchPlaceholder="Search agents"
                          inlinePopup={false}
                          clearable={false}
                          disabled={!canRunTask(task)}
                          options={stations
                            .filter(
                              (candidate) =>
                                candidate.id !== task.currentStation,
                            )
                            .map((candidate) => ({
                              value: candidate.id,
                              label: candidate.display,
                              keywords: `${candidate.title} ${candidate.model}`,
                            }))}
                          onValueChange={(value) => {
                            const target = stations.find(
                              (candidate) => candidate.id === value,
                            );
                            if (target) onHandoff(task, target);
                          }}
                        />
                        {task.status === "failed"
                        || task.status === "cancelled" ? (
                          <Button
                            appearance="secondary"
                            size="small"
                            type="button"
                            icon={<Replay20Regular aria-hidden="true" />}
                            disabled={
                              !actionsEnabled
                              || !runnableProjects.has(task.project)
                            }
                            onClick={() => onRetry(task)}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </div>
                      <footer className="handoff-card-footer">
                        Updated {relativeTime(task.updatedAt)}
                      </footer>
                      {task.prUrl ? (
                        <a
                          className="handoff-pr-link"
                          href={task.prUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Open16Regular aria-hidden="true" />
                          Open pull request
                        </a>
                      ) : null}
                      </Card>
                    );
                  })
                ) : (
                  <p className="handoff-empty">
                    {showTaskHistory
                      ? "No task history in this range"
                      : "No current tasks. Show task history to see earlier work."}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
});

type PipelineCategory =
  | "design"
  | "check"
  | "writer"
  | "delivery"
  | "operation";

type PipelineStationMeta = {
  category: PipelineCategory;
  role: string;
  icon: React.ReactNode;
};

const pipelineStationMeta = {
  designr: {
    category: "design",
    role: "Design station",
    icon: <DesignIdeas20Regular aria-hidden="true" />,
  },
  engraver: {
    category: "design",
    role: "Optional asset station",
    icon: <PaintBrush20Regular aria-hidden="true" />,
  },
  "design-review": {
    category: "check",
    role: "Independent check",
    icon: <ShieldCheckmark20Regular aria-hidden="true" />,
  },
  shipwright: {
    category: "writer",
    role: "Only code writer",
    icon: <Code20Regular aria-hidden="true" />,
  },
  surveyor: {
    category: "check",
    role: "Independent check",
    icon: <ShieldCheckmark20Regular aria-hidden="true" />,
  },
  lookout: {
    category: "check",
    role: "Independent check",
    icon: <ShieldCheckmark20Regular aria-hidden="true" />,
  },
  herald: {
    category: "delivery",
    role: "Delivery station",
    icon: <BranchFork20Regular aria-hidden="true" />,
  },
  watchkeeper: {
    category: "operation",
    role: "Scheduled monitoring",
    icon: <Clock20Regular aria-hidden="true" />,
  },
  buildr: {
    category: "operation",
    role: "Integration operation",
    icon: <Flowchart20Regular aria-hidden="true" />,
  },
} satisfies Record<string, PipelineStationMeta>;

type PipelineStationId = keyof typeof pipelineStationMeta;

const pipelineRelationships = [
  "DesignR hands work to Design-Review.",
  "DesignR optionally hands work to Engraver when an asset is required.",
  "Engraver hands the approved asset to Design-Review.",
  "Design-Review hands approved design work to Shipwright.",
  "Design-Review returns rejected design work to DesignR.",
  "Shipwright hands implementation work to Surveyor.",
  "Surveyor hands accepted work to Lookout.",
  "Surveyor returns blocking findings to Shipwright.",
  "Lookout hands browser-verified work to Herald.",
  "Lookout returns blocking findings to Shipwright.",
  "Herald delivers the pull request outcome.",
  "Pull request schedules Watchkeeper monitoring.",
  "Watchkeeper routes measurement questions to Surveyor.",
  "Watchkeeper routes code changes to Shipwright.",
  "Pull request hands combined work to BuildR.",
  "BuildR publishes the Preview outcome.",
  "BuildR returns combination breaks to Shipwright.",
] as const;

const pipelineFeedbackRoutes = [
  {
    source: "Design-Review",
    label: "Rejected design",
    target: "DesignR",
  },
  {
    source: "Surveyor / Lookout",
    label: "Blocking finding",
    target: "Shipwright",
  },
  {
    source: "Watchkeeper",
    label: "Needs measurement",
    target: "Surveyor",
  },
  {
    source: "Watchkeeper",
    label: "Needs code change",
    target: "Shipwright",
  },
  {
    source: "BuildR",
    label: "Combination break",
    target: "Shipwright",
  },
] as const;

type PipelinePortName =
  | "input"
  | "output"
  | "top"
  | "bottom"
  | "branch-output"
  | "monitoring-output"
  | "integration-output";

type PipelineConnectorKind = "forward" | "conditional";

type PipelineConnectorDefinition = {
  id: string;
  kind: PipelineConnectorKind;
  sourceNode: PipelineNodeId;
  sourcePort: PipelinePortName;
  sourceSide: PipelinePortSide;
  targetNode: PipelineNodeId;
  targetPort: PipelinePortName;
  targetSide: PipelinePortSide;
  label?: string;
};

type PipelineConnectorPorts = Pick<
  PipelineConnectorDefinition,
  "sourcePort" | "sourceSide" | "targetPort" | "targetSide"
>;

type PipelineConnectorGeometry = PipelineConnectorDefinition & {
  path: string;
  labelPoint?: PipelinePoint;
};

const pipelineStorageKeys: Record<PipelineLayoutMode, string> = {
  wide: "design-fleet.pipeline-layout.wide.v1",
  compact: "design-fleet.pipeline-layout.compact.v1",
};

const pipelineZoomStorageKeys: Record<PipelineLayoutMode, string> = {
  wide: "design-fleet.pipeline-zoom.wide.v1",
  compact: "design-fleet.pipeline-zoom.compact.v1",
};

const pipelineConnectorDefinitions: readonly PipelineConnectorDefinition[] = [
  {
    id: "designr-design-review",
    kind: "forward",
    sourceNode: "designr",
    sourcePort: "output",
    sourceSide: "right",
    targetNode: "design-review",
    targetPort: "input",
    targetSide: "left",
  },
  {
    id: "design-review-shipwright",
    kind: "forward",
    sourceNode: "design-review",
    sourcePort: "output",
    sourceSide: "right",
    targetNode: "shipwright",
    targetPort: "input",
    targetSide: "left",
  },
  {
    id: "shipwright-surveyor",
    kind: "forward",
    sourceNode: "shipwright",
    sourcePort: "output",
    sourceSide: "right",
    targetNode: "surveyor",
    targetPort: "input",
    targetSide: "left",
  },
  {
    id: "surveyor-lookout",
    kind: "forward",
    sourceNode: "surveyor",
    sourcePort: "output",
    sourceSide: "right",
    targetNode: "lookout",
    targetPort: "input",
    targetSide: "left",
  },
  {
    id: "lookout-herald",
    kind: "forward",
    sourceNode: "lookout",
    sourcePort: "output",
    sourceSide: "right",
    targetNode: "herald",
    targetPort: "input",
    targetSide: "left",
  },
  {
    id: "herald-pull-request",
    kind: "forward",
    sourceNode: "herald",
    sourcePort: "output",
    sourceSide: "right",
    targetNode: "pull-request",
    targetPort: "input",
    targetSide: "left",
  },
  {
    id: "buildr-preview",
    kind: "forward",
    sourceNode: "buildr",
    sourcePort: "output",
    sourceSide: "right",
    targetNode: "preview",
    targetPort: "input",
    targetSide: "left",
  },
  {
    id: "designr-engraver",
    kind: "conditional",
    sourceNode: "designr",
    sourcePort: "top",
    sourceSide: "top",
    targetNode: "engraver",
    targetPort: "input",
    targetSide: "left",
    label: "Asset required",
  },
  {
    id: "engraver-design-review",
    kind: "conditional",
    sourceNode: "engraver",
    sourcePort: "branch-output",
    sourceSide: "bottom",
    targetNode: "design-review",
    targetPort: "top",
    targetSide: "top",
  },
  {
    id: "pull-request-watchkeeper",
    kind: "conditional",
    sourceNode: "pull-request",
    sourcePort: "monitoring-output",
    sourceSide: "bottom",
    targetNode: "watchkeeper",
    targetPort: "top",
    targetSide: "top",
    label: "Scheduled",
  },
  {
    id: "pull-request-buildr",
    kind: "conditional",
    sourceNode: "pull-request",
    sourcePort: "integration-output",
    sourceSide: "bottom",
    targetNode: "buildr",
    targetPort: "top",
    targetSide: "top",
  },
];

const compactPipelineConnectorOverrides: Partial<
  Record<string, PipelineConnectorPorts>
> = {
  "surveyor-lookout": {
    sourcePort: "bottom",
    sourceSide: "bottom",
    targetPort: "top",
    targetSide: "top",
  },
  "lookout-herald": {
    sourcePort: "input",
    sourceSide: "left",
    targetPort: "output",
    targetSide: "right",
  },
  "herald-pull-request": {
    sourcePort: "input",
    sourceSide: "left",
    targetPort: "output",
    targetSide: "right",
  },
};

const pipelinePhaseLabels: Record<
  PipelineLayoutMode,
  ReadonlyArray<{ label: string; x: number; y: number }>
> = {
  wide: [
    { label: "DESIGN", x: 4, y: 174 },
    { label: "BUILD", x: 358, y: 174 },
    { label: "VERIFY", x: 535, y: 174 },
    { label: "DELIVER", x: 889, y: 174 },
    { label: "OPERATE", x: 624, y: 314 },
  ],
  compact: [
    { label: "DESIGN", x: 10, y: 126 },
    { label: "BUILD", x: 500, y: 126 },
    { label: "VERIFY", x: 745, y: 126 },
    { label: "DELIVER", x: 500, y: 251 },
    { label: "OPERATE", x: 10, y: 386 },
  ],
};

const PipelineView = memo(function PipelineView({
  stations,
}: {
  stations: StationSummary[];
}) {
  const stationById = new Map(stations.map((station) => [station.id, station]));
  const [pipelinePositions, setPipelinePositions] = useState<
    Record<PipelineLayoutMode, PipelinePositionMap>
  >(() => ({
    wide: parsePipelinePositions(
      window.localStorage.getItem(pipelineStorageKeys.wide),
      PIPELINE_LAYOUTS.wide,
    ),
    compact: parsePipelinePositions(
      window.localStorage.getItem(pipelineStorageKeys.compact),
      PIPELINE_LAYOUTS.compact,
    ),
  }));
  const pipelinePositionsRef = useRef(pipelinePositions);
  const [pipelineZoom, setPipelineZoom] = useState<
    Record<PipelineLayoutMode, number>
  >(() => ({
    wide: parsePipelineZoom(
      window.localStorage.getItem(pipelineZoomStorageKeys.wide),
    ),
    compact: parsePipelineZoom(
      window.localStorage.getItem(pipelineZoomStorageKeys.compact),
    ),
  }));
  const pipelineZoomRef = useRef(pipelineZoom);
  const layoutRefs = useRef<Record<PipelineLayoutMode, HTMLDivElement | null>>({
    wide: null,
    compact: null,
  });
  const [connectorGeometry, setConnectorGeometry] = useState<
    Record<PipelineLayoutMode, PipelineConnectorGeometry[]>
  >({
    wide: [],
    compact: [],
  });
  const [activeLayoutMode, setActiveLayoutMode] =
    useState<PipelineLayoutMode>(() =>
      window.matchMedia("(min-width: 1180px)").matches ? "wide" : "compact",
    );
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [pipelineAnnouncement, setPipelineAnnouncement] = useState("");
  const dragStateRef = useRef<{
    pointerId: number;
    mode: PipelineLayoutMode;
    nodeId: PipelineNodeId;
    label: string;
    startClientX: number;
    startClientY: number;
    startPosition: PipelinePoint;
    zoom: number;
  } | null>(null);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1180px)");
    const updateMode = () =>
      setActiveLayoutMode(wide.matches ? "wide" : "compact");
    updateMode();
    wide.addEventListener("change", updateMode);
    return () => wide.removeEventListener("change", updateMode);
  }, []);

  useEffect(
    () => () => {
      document.body.classList.remove("pipeline-drag-active");
    },
    [],
  );

  function pipelineNodeLabel(nodeId: PipelineNodeId): string {
    if (nodeId === "pull-request") return "Pull request";
    if (nodeId === "preview") return "Preview";
    return stationById.get(nodeId)?.display || nodeId;
  }

  function setPipelineNodePosition(
    mode: PipelineLayoutMode,
    nodeId: PipelineNodeId,
    position: PipelinePoint,
    persist: boolean,
  ) {
    const nextModePositions = {
      ...pipelinePositionsRef.current[mode],
      [nodeId]: clampPipelinePosition(
        position,
        PIPELINE_LAYOUTS[mode],
        pipelineZoomRef.current[mode],
      ),
    };
    const nextPositions = {
      ...pipelinePositionsRef.current,
      [mode]: nextModePositions,
    };
    pipelinePositionsRef.current = nextPositions;
    setPipelinePositions(nextPositions);
    if (persist) {
      window.localStorage.setItem(
        pipelineStorageKeys[mode],
        serializePipelinePositions(nextModePositions),
      );
    }
  }

  function setPipelineLayoutZoom(
    mode: PipelineLayoutMode,
    zoom: number,
    announcement: string,
  ) {
    const nextZoom = clampPipelineZoom(zoom);
    const nextZooms = {
      ...pipelineZoomRef.current,
      [mode]: nextZoom,
    };
    pipelineZoomRef.current = nextZooms;
    setPipelineZoom(nextZooms);
    window.localStorage.setItem(
      pipelineZoomStorageKeys[mode],
      serializePipelineZoom(nextZoom),
    );
    setPipelineAnnouncement(announcement);
  }

  function changePipelineZoom(delta: number) {
    const nextZoom = clampPipelineZoom(
      pipelineZoomRef.current[activeLayoutMode] + delta,
    );
    setPipelineLayoutZoom(
      activeLayoutMode,
      nextZoom,
      `Topology zoom ${Math.round(nextZoom * 100)} percent.`,
    );
  }

  function fitPipelineLayout() {
    const layout = layoutRefs.current[activeLayoutMode];
    if (!layout) return;
    const rect = layout.getBoundingClientRect();
    const zoom = calculatePipelineFitZoom(
      { width: rect.width, height: rect.height },
      pipelinePositionsRef.current[activeLayoutMode],
      PIPELINE_LAYOUTS[activeLayoutMode],
    );
    setPipelineLayoutZoom(
      activeLayoutMode,
      zoom,
      `Topology fit to ${Math.round(zoom * 100)} percent.`,
    );
  }

  function startPipelineDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    mode: PipelineLayoutMode,
    nodeId: PipelineNodeId,
  ) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const label = pipelineNodeLabel(nodeId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      mode,
      nodeId,
      label,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: pipelinePositionsRef.current[mode][nodeId],
      zoom: pipelineZoomRef.current[mode],
    };
    setDraggingNode(`${mode}:${nodeId}`);
    document.body.classList.add("pipeline-drag-active");
  }

  function movePipelineDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const layout = layoutRefs.current[drag.mode];
    if (!layout) return;
    const rect = layout.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.preventDefault();
    const config = PIPELINE_LAYOUTS[drag.mode];
    const delta = screenDeltaToPipelineWorld(
      {
        x: event.clientX - drag.startClientX,
        y: event.clientY - drag.startClientY,
      },
      drag.zoom,
      { width: rect.width, height: rect.height },
      { width: config.width, height: config.height },
    );
    setPipelineNodePosition(
      drag.mode,
      drag.nodeId,
      {
        x: drag.startPosition.x + delta.x,
        y: drag.startPosition.y + delta.y,
      },
      false,
    );
  }

  function finishPipelineDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.localStorage.setItem(
      pipelineStorageKeys[drag.mode],
      serializePipelinePositions(pipelinePositionsRef.current[drag.mode]),
    );
    setPipelineAnnouncement(
      `${drag.label} moved. The workflow order remains unchanged.`,
    );
    dragStateRef.current = null;
    setDraggingNode(null);
    document.body.classList.remove("pipeline-drag-active");
  }

  function movePipelineNodeWithKeyboard(
    event: React.KeyboardEvent<HTMLButtonElement>,
    mode: PipelineLayoutMode,
    nodeId: PipelineNodeId,
  ) {
    const current = pipelinePositionsRef.current[mode][nodeId];
    const next = movePipelinePositionByKey(
      current,
      event.key,
      event.shiftKey,
      PIPELINE_LAYOUTS[mode],
      pipelineZoomRef.current[mode],
    );
    if (next === current) return;
    event.preventDefault();
    setPipelineNodePosition(mode, nodeId, next, true);
    setPipelineAnnouncement(
      `${pipelineNodeLabel(nodeId)} moved ${event.key.replace("Arrow", "").toLowerCase()}. The workflow order remains unchanged.`,
    );
  }

  function resetPipelineLayout() {
    const positions = clonePipelinePositions(
      PIPELINE_LAYOUTS[activeLayoutMode].positions,
    );
    const nextPositions = {
      ...pipelinePositionsRef.current,
      [activeLayoutMode]: positions,
    };
    pipelinePositionsRef.current = nextPositions;
    setPipelinePositions(nextPositions);
    const nextZooms = {
      ...pipelineZoomRef.current,
      [activeLayoutMode]: PIPELINE_ZOOM_DEFAULT,
    };
    pipelineZoomRef.current = nextZooms;
    setPipelineZoom(nextZooms);
    window.localStorage.setItem(
      pipelineStorageKeys[activeLayoutMode],
      serializePipelinePositions(positions),
    );
    window.localStorage.setItem(
      pipelineZoomStorageKeys[activeLayoutMode],
      serializePipelineZoom(PIPELINE_ZOOM_DEFAULT),
    );
    setPipelineAnnouncement(
      `${activeLayoutMode === "wide" ? "Wide" : "Compact"} pipeline layout and zoom reset.`,
    );
  }

  const measurePipelineConnectors = useCallback(
    (mode: PipelineLayoutMode) => {
      const layout = layoutRefs.current[mode];
      if (!layout) return;
      const rect = layout.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const connectorSvg =
        layout.querySelector<SVGSVGElement>(".pipeline-connectors");
      const screenMatrix = connectorSvg?.getScreenCTM();
      if (!screenMatrix) return;
      const screenToWorld = screenMatrix.inverse();
      const pointForPort = (
        nodeId: PipelineNodeId,
        port: PipelinePortName,
      ): PipelinePoint | null => {
        const element = layout.querySelector<HTMLElement>(
          `[data-node-id="${nodeId}"] [data-port="${port}"]`,
        );
        if (!element) return null;
        const portRect = element.getBoundingClientRect();
        const point = new DOMPoint(
          portRect.left + portRect.width / 2,
          portRect.top + portRect.height / 2,
        ).matrixTransform(screenToWorld);
        return { x: point.x, y: point.y };
      };
      const geometry = pipelineConnectorDefinitions.flatMap((baseDefinition) => {
        const definition = {
          ...baseDefinition,
          ...(mode === "compact"
            ? compactPipelineConnectorOverrides[baseDefinition.id]
            : undefined),
        };
        const source = pointForPort(
          definition.sourceNode,
          definition.sourcePort,
        );
        const target = pointForPort(
          definition.targetNode,
          definition.targetPort,
        );
        if (!source || !target) return [];
        const path = buildPipelinePath({
          source,
          target,
          sourceSide: definition.sourceSide,
          targetSide: definition.targetSide,
        });
        let labelPoint: PipelinePoint | undefined;
        if (definition.label) {
          labelPoint = {
            x: (source.x + target.x) / 2,
            y: (source.y + target.y) / 2 - 12,
          };
        }
        return [{ ...definition, path, labelPoint }];
      });
      setConnectorGeometry((current) =>
        sameValue(current[mode], geometry)
          ? current
          : { ...current, [mode]: geometry },
      );
    },
    [],
  );

  useLayoutEffect(() => {
    measurePipelineConnectors("wide");
    measurePipelineConnectors("compact");
  }, [pipelinePositions, pipelineZoom, measurePipelineConnectors]);

  useEffect(() => {
    const observers = (["wide", "compact"] as const).flatMap((mode) => {
      const layout = layoutRefs.current[mode];
      if (!layout) return [];
      const observer = new ResizeObserver(() =>
        measurePipelineConnectors(mode),
      );
      observer.observe(layout);
      return [observer];
    });
    return () => observers.forEach((observer) => observer.disconnect());
  }, [measurePipelineConnectors]);

  function stationNode(
    stationId: PipelineStationId,
    mode?: PipelineLayoutMode,
  ) {
    const station = stationById.get(stationId);
    const meta = pipelineStationMeta[stationId];
    const position = mode ? pipelinePositions[mode][stationId] : undefined;
    const style = position && mode
      ? {
          left: `${(position.x / PIPELINE_LAYOUTS[mode].width) * 100}%`,
          top: position.y,
        }
      : undefined;

    return (
      <article
        className="pipeline-node-card"
        data-category={meta.category}
        data-health={station?.status}
        data-node-id={mode ? stationId : undefined}
        data-dragging={
          mode && draggingNode === `${mode}:${stationId}` ? "true" : undefined
        }
        style={style}
      >
        <span
          className="pipeline-port pipeline-port-input"
          data-port="input"
          aria-hidden="true"
        />
        <span
          className="pipeline-port pipeline-port-output"
          data-port="output"
          aria-hidden="true"
        />
        {stationId === "designr" ||
        stationId === "design-review" ||
        stationId === "watchkeeper" ||
        stationId === "buildr" ||
        (mode === "compact" && stationId === "lookout") ? (
          <span
            className="pipeline-port pipeline-port-top"
            data-port="top"
            aria-hidden="true"
          />
        ) : null}
        {mode === "compact" && stationId === "surveyor" ? (
          <span
            className="pipeline-port pipeline-port-bottom"
            data-port="bottom"
            aria-hidden="true"
          />
        ) : null}
        {stationId === "engraver" ? (
          <span
            className="pipeline-port pipeline-port-bottom pipeline-port-branch-output"
            data-port="branch-output"
            aria-hidden="true"
          />
        ) : null}
        {mode && mode === activeLayoutMode ? (
          <Button
            appearance="subtle"
            size="small"
            className="pipeline-drag-handle"
            type="button"
            icon={<Drag20Regular aria-hidden="true" />}
            aria-label={`Move ${station?.display || stationId}`}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            title={`Move ${station?.display || stationId}`}
            onPointerDown={(event) =>
              startPipelineDrag(event, mode, stationId)
            }
            onPointerMove={movePipelineDrag}
            onPointerUp={finishPipelineDrag}
            onPointerCancel={finishPipelineDrag}
            onLostPointerCapture={finishPipelineDrag}
            onKeyDown={(event) =>
              movePipelineNodeWithKeyboard(event, mode, stationId)
            }
          />
        ) : null}
        <div className="pipeline-node-role">
          {meta.icon}
          <span>{meta.role}</span>
        </div>
        <h3>{station?.display || stationId}</h3>
        <p className="pipeline-node-model">
          <span className="sr-only">Model: </span>
          {station?.model || "Model not configured"}
        </p>
      </article>
    );
  }

  function outcomeNode(
    label: "Pull request" | "Preview",
    detail: string,
    icon: React.ReactNode,
    mode?: PipelineLayoutMode,
  ) {
    const nodeId: PipelineNodeId =
      label === "Pull request" ? "pull-request" : "preview";
    const position = mode ? pipelinePositions[mode][nodeId] : undefined;
    const style = position && mode
      ? {
          left: `${(position.x / PIPELINE_LAYOUTS[mode].width) * 100}%`,
          top: position.y,
        }
      : undefined;
    return (
      <article
        className="pipeline-node-card pipeline-outcome"
        data-category="outcome"
        data-node-id={mode ? nodeId : undefined}
        data-dragging={
          mode && draggingNode === `${mode}:${nodeId}` ? "true" : undefined
        }
        style={style}
      >
        <span
          className="pipeline-port pipeline-port-input"
          data-port="input"
          aria-hidden="true"
        />
        {label === "Pull request" ? (
          <>
            <span
              className="pipeline-port pipeline-port-output"
              data-port="output"
              aria-hidden="true"
            />
            <span
              className="pipeline-port pipeline-port-bottom pipeline-port-monitoring-output"
              data-port="monitoring-output"
              aria-hidden="true"
            />
            <span
              className="pipeline-port pipeline-port-bottom pipeline-port-integration-output"
              data-port="integration-output"
              aria-hidden="true"
            />
          </>
        ) : null}
        {mode && mode === activeLayoutMode ? (
          <Button
            appearance="subtle"
            size="small"
            className="pipeline-drag-handle"
            type="button"
            icon={<Drag20Regular aria-hidden="true" />}
            aria-label={`Move ${label}`}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            title={`Move ${label}`}
            onPointerDown={(event) => startPipelineDrag(event, mode, nodeId)}
            onPointerMove={movePipelineDrag}
            onPointerUp={finishPipelineDrag}
            onPointerCancel={finishPipelineDrag}
            onLostPointerCapture={finishPipelineDrag}
            onKeyDown={(event) =>
              movePipelineNodeWithKeyboard(event, mode, nodeId)
            }
          />
        ) : null}
        <div className="pipeline-node-role">
          {icon}
          <span className="pipeline-outcome-caption">Outcome</span>
        </div>
        <h3>{label}</h3>
        <p className="pipeline-outcome-detail">{detail}</p>
      </article>
    );
  }

  function pipelineCanvasLayers(mode: PipelineLayoutMode) {
    const config = PIPELINE_LAYOUTS[mode];
    const markerId = `pipeline-arrow-${mode}`;
    const geometry = connectorGeometry[mode];

    return (
      <svg
        className="pipeline-connectors" aria-hidden="true"
        viewBox={`0 0 ${config.width} ${config.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path className="pipeline-arrow-fill" d="M1 1 L7 4 L1 7 Z" />
          </marker>
        </defs>

        <g className="pipeline-phases">
          {pipelinePhaseLabels[mode].map((phase) => (
            <text x={phase.x} y={phase.y} key={phase.label}>
              {phase.label}
            </text>
          ))}
        </g>

        {(["forward", "conditional"] as const).map((kind) => (
          <g className={`pipeline-${kind}-paths`} key={kind}>
            {geometry
              .filter((connector) => connector.kind === kind)
              .map((connector) => (
                <path
                  d={connector.path}
                  data-connector-id={connector.id}
                  markerEnd={`url(#${markerId})`}
                  key={connector.id}
                />
              ))}
          </g>
        ))}

        <g className="pipeline-connector-labels">
          {geometry
            .filter(
              (
                connector,
              ): connector is PipelineConnectorGeometry & {
                label: string;
                labelPoint: PipelinePoint;
              } => Boolean(connector.label && connector.labelPoint),
            )
            .map((connector) => (
              <text
                x={connector.labelPoint.x}
                y={connector.labelPoint.y}
                key={connector.id}
              >
                {connector.label}
              </text>
            ))}
        </g>
      </svg>
    );
  }

  return (
    <section className="pipeline-view view-enter" aria-labelledby="pipeline-title">
      <div className="page-heading">
        <div>
          <Title1 as="h2" id="pipeline-title">
            Pipeline
          </Title1>
          <p>
            Prototype operational topology for forward delivery and independent
            checks, with exception routes listed separately below.
          </p>
        </div>
      </div>

      <div className="pipeline-frame">
        <header className="pipeline-toolbar">
          <div className="pipeline-toolbar-title">
            <strong>Delivery topology</strong>
            <span className="pipeline-prototype-label">Prototype</span>
          </div>
          <span className="pipeline-workflow-label">
            <Flowchart20Regular aria-hidden="true" />
            Canonical fleet workflow
          </span>
        </header>

        <div
          className="pipeline-layout pipeline-layout-wide"
          data-layout-mode="wide"
          ref={(node) => {
            layoutRefs.current.wide = node;
          }}
        >
          <div
            className="pipeline-world"
            data-world-mode="wide"
            style={{ transform: `scale(${pipelineZoom.wide})` }}
          >
            {pipelineCanvasLayers("wide")}
            {stationNode("designr", "wide")}
            {stationNode("engraver", "wide")}
            {stationNode("design-review", "wide")}
            {stationNode("shipwright", "wide")}
            {stationNode("surveyor", "wide")}
            {stationNode("lookout", "wide")}
            {stationNode("herald", "wide")}
            {outcomeNode(
              "Pull request",
              "Upstream delivery",
              <BranchFork20Regular aria-hidden="true" />,
              "wide",
            )}
            {stationNode("watchkeeper", "wide")}
            {stationNode("buildr", "wide")}
            {outcomeNode(
              "Preview",
              "Combined pull requests",
              <Desktop20Regular aria-hidden="true" />,
              "wide",
            )}
          </div>
        </div>

        <div
          className="pipeline-layout pipeline-layout-compact"
          data-layout-mode="compact"
          ref={(node) => {
            layoutRefs.current.compact = node;
          }}
        >
          <div
            className="pipeline-world"
            data-world-mode="compact"
            style={{ transform: `scale(${pipelineZoom.compact})` }}
          >
            {pipelineCanvasLayers("compact")}
            {stationNode("designr", "compact")}
            {stationNode("engraver", "compact")}
            {stationNode("design-review", "compact")}
            {stationNode("shipwright", "compact")}
            {stationNode("surveyor", "compact")}
            {stationNode("lookout", "compact")}
            {stationNode("herald", "compact")}
            {outcomeNode(
              "Pull request",
              "Upstream delivery",
              <BranchFork20Regular aria-hidden="true" />,
              "compact",
            )}
            {stationNode("watchkeeper", "compact")}
            {stationNode("buildr", "compact")}
            {outcomeNode(
              "Preview",
              "Combined pull requests",
              <Desktop20Regular aria-hidden="true" />,
              "compact",
            )}
          </div>
        </div>

        <section
          className="pipeline-feedback-panel"
          aria-labelledby="pipeline-feedback-title"
        >
          <div className="pipeline-feedback-heading">
            <span className="pipeline-feedback-heading-icon" aria-hidden="true">
              <ArrowReset20Regular />
            </span>
            <div>
              <h3 id="pipeline-feedback-title">Feedback routes</h3>
              <p>
                Exceptions are listed by destination so work returns to the
                station that can resolve them without long loops.
              </p>
            </div>
          </div>
          <div className="pipeline-feedback-grid">
            {pipelineFeedbackRoutes.map((route) => (
              <article
                className="pipeline-feedback-route"
                key={`${route.source}-${route.target}-${route.label}`}
              >
                <span className="pipeline-feedback-reason">{route.label}</span>
                <div className="pipeline-feedback-flow">
                  <strong className="pipeline-feedback-source">
                    {route.source}
                  </strong>
                  <span className="pipeline-feedback-arrow" aria-hidden="true">
                    <ArrowReset20Regular />
                  </span>
                  <strong className="pipeline-feedback-target">
                    {route.target}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="pipeline-mobile-workflow">
          <section aria-labelledby="pipeline-mobile-primary-title">
            <h3 id="pipeline-mobile-primary-title">Primary delivery path</h3>
            <ol className="pipeline-mobile-primary">
              <li className="pipeline-mobile-step">
                {stationNode("designr")}
                <aside className="pipeline-mobile-optional" aria-label="Optional branch">
                  <span className="pipeline-mobile-branch-label">Optional branch</span>
                  {stationNode("engraver")}
                  <p>Asset required <span aria-hidden="true">→</span> Design-Review</p>
                </aside>
              </li>
              <li className="pipeline-mobile-step">{stationNode("design-review")}</li>
              <li className="pipeline-mobile-step">{stationNode("shipwright")}</li>
              <li className="pipeline-mobile-step">{stationNode("surveyor")}</li>
              <li className="pipeline-mobile-step">{stationNode("lookout")}</li>
              <li className="pipeline-mobile-step">{stationNode("herald")}</li>
              <li className="pipeline-mobile-step">
                {outcomeNode(
                  "Pull request",
                  "Upstream delivery",
                  <BranchFork20Regular aria-hidden="true" />,
                )}
              </li>
            </ol>
          </section>

          <section
            className="pipeline-mobile-operations"
            aria-labelledby="pipeline-mobile-operations-title"
          >
            <h3 id="pipeline-mobile-operations-title">Operations</h3>
            <p>Pull request branches into monitoring and combined preview delivery.</p>
            <div className="pipeline-mobile-operation-list">
              <div className="pipeline-mobile-operation">
                <span className="pipeline-mobile-relation-label">Scheduled</span>
                {stationNode("watchkeeper")}
              </div>
              <div className="pipeline-mobile-operation">
                <span className="pipeline-mobile-relation-label">Conditional</span>
                {stationNode("buildr")}
              </div>
              <div className="pipeline-mobile-operation">
                <span className="pipeline-mobile-relation-label">Handoff</span>
                {outcomeNode(
                  "Preview",
                  "Combined pull requests",
                  <Desktop20Regular aria-hidden="true" />,
                )}
              </div>
            </div>
          </section>

          <footer className="pipeline-mobile-returns">
            <h3>Returns work</h3>
            {pipelineFeedbackRoutes.map((route) => (
              <div
                className="pipeline-mobile-return-row"
                key={`${route.source}-${route.target}-${route.label}`}
              >
                <span>
                  {route.source}: {route.label}
                </span>
                <span aria-hidden="true">→</span>
                <strong>{route.target}</strong>
              </div>
            ))}
          </footer>
        </div>

        <footer className="pipeline-canvas-footer">
          <div className="pipeline-key" aria-label="Connector key">
            <span><i className="pipeline-key-solid" /> Solid Handoff</span>
            <span><i className="pipeline-key-conditional" /> Dashed Conditional</span>
          </div>
          <div className="pipeline-canvas-actions">
            <div
              className="pipeline-zoom-controls"
              role="group"
              aria-label="Topology zoom"
            >
              <Button
                appearance="subtle"
                size="small"
                className="pipeline-zoom-button"
                type="button"
                icon={<ZoomOut20Regular aria-hidden="true" />}
                aria-label="Zoom out"
                title="Zoom out"
                disabled={
                  pipelineZoom[activeLayoutMode] <= PIPELINE_ZOOM_MIN
                }
                onClick={() => changePipelineZoom(-PIPELINE_ZOOM_STEP)}
              />
              <output
                className="pipeline-zoom-readout"
                aria-label={`Current zoom ${Math.round(
                  pipelineZoom[activeLayoutMode] * 100,
                )} percent`}
                aria-live="polite"
              >
                {Math.round(pipelineZoom[activeLayoutMode] * 100)}%
              </output>
              <Button
                appearance="subtle"
                size="small"
                className="pipeline-zoom-button"
                type="button"
                icon={<ZoomIn20Regular aria-hidden="true" />}
                aria-label="Zoom in"
                title="Zoom in"
                disabled={
                  pipelineZoom[activeLayoutMode] >= PIPELINE_ZOOM_MAX
                }
                onClick={() => changePipelineZoom(PIPELINE_ZOOM_STEP)}
              />
              <Button
                appearance="subtle"
                size="small"
                className="pipeline-zoom-button"
                type="button"
                icon={<ScaleFit20Regular aria-hidden="true" />}
                aria-label="Fit to view"
                title="Fit to view"
                onClick={fitPipelineLayout}
              />
            </div>
            <Button
              appearance="subtle"
              size="small"
              className="pipeline-reset-button"
              type="button"
              icon={<ArrowReset20Regular aria-hidden="true" />}
              aria-label="Reset layout"
              title={`Reset ${activeLayoutMode} layout and zoom`}
              onClick={resetPipelineLayout}
            />
          </div>
        </footer>

        <p className="sr-only" aria-live="polite">
          {pipelineAnnouncement}
        </p>
        <ul className="sr-only" aria-label="Pipeline relationships">
          {pipelineRelationships.map((relationship) => (
            <li key={relationship}>{relationship}</li>
          ))}
        </ul>
      </div>
    </section>
  );
});

const ActivityView = memo(function ActivityView({
  activity,
  project,
  onClear,
}: {
  activity: ProcessSummary[];
  project: string;
  onClear: (project: string) => void;
}) {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const clearButtonRef = useRef<HTMLButtonElement>(null);
  const clearableCount = activity.filter(
    (item) => !activityIsLive(item),
  ).length;
  const scopeLabel =
    project === "all" ? "all projects" : project;

  function closeClearDialog() {
    setConfirmClearOpen(false);
    window.setTimeout(() => clearButtonRef.current?.focus(), 0);
  }

  return (
    <section className="activity-view view-enter" aria-labelledby="activity-title">
      <div className="page-heading">
        <div>
          <Title1 as="h2" id="activity-title">
            Activity
          </Title1>
          <p>
            {project === "all"
              ? "Recent station runs across every project."
              : `Recent station runs for ${project}.`}
          </p>
        </div>
        <div className="activity-heading-actions">
          <div className="live-state">
            <span className="live-dot" aria-hidden="true" />
            Updating every 5 seconds
          </div>
          <Button
            ref={clearButtonRef}
            appearance="secondary"
            className="secondary-button activity-clear-button"
            type="button"
            icon={<Delete24Regular aria-hidden="true" />}
            aria-label={`Clear completed activity for ${scopeLabel}`}
            disabled={clearableCount === 0}
            onClick={() => setConfirmClearOpen(true)}
          >
            Clear activity
          </Button>
        </div>
      </div>
      <p className="handoff-note">
        Only activity metadata is shown. Historical prompts and response content
        remain private.
      </p>
      <Card appearance="filled" className="panel activity-panel">
        <ProcessList
          processes={activity}
          emptyMessage="No fleet activity was found in this range."
          minimalStatusBadges
        />
      </Card>
      <Dialog
        open={confirmClearOpen}
        modalType="modal"
        onOpenChange={(_, data) => {
          if (!data.open) closeClearDialog();
        }}
      >
        <DialogSurface className="dialog activity-clear-dialog">
          <DialogBody>
            <DialogTitle>Clear activity?</DialogTitle>
            <DialogContent>
              <p>
                Remove {clearableCount} completed activity{" "}
                {clearableCount === 1 ? "entry" : "entries"} from the dashboard
                view for {scopeLabel}?
              </p>
              <p className="activity-clear-copy">
                Active runs remain visible. Copilot session, event, and usage
                source records are not deleted.
              </p>
            </DialogContent>
            <div className="dialog-actions">
              <Button
                appearance="secondary"
                className="secondary-button"
                type="button"
                onClick={closeClearDialog}
              >
                Cancel
              </Button>
              <Button
                appearance="secondary"
                className="danger-button"
                type="button"
                icon={<Delete24Regular aria-hidden="true" />}
                aria-label={`Confirm clearing ${clearableCount} completed activity ${
                  clearableCount === 1 ? "entry" : "entries"
                } for ${scopeLabel}`}
                onClick={() => {
                  onClear(project);
                  closeClearDialog();
                }}
              >
                Clear activity
              </Button>
            </div>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </section>
  );
});

function DashboardSkeleton() {
  return (
    <section className="dashboard-skeleton" aria-label="Loading fleet dashboard">
      <div className="skeleton-heading">
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line skeleton-medium" />
      </div>
      <div className="metrics-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <Card
            appearance="filled"
            className="metric-card skeleton-card"
            key={index}
          >
            <span className="skeleton-line skeleton-short" />
            <span className="skeleton-copy">
              <span className="skeleton-line skeleton-value" />
              <span className="skeleton-line skeleton-medium" />
            </span>
          </Card>
        ))}
      </div>
      <div className="skeleton-section-heading">
        <span className="skeleton-line skeleton-title" />
      </div>
      <div className="station-grid">
        {Array.from({ length: 9 }, (_, index) => (
          <Card
            appearance="filled"
            size="large"
            className={`station-card skeleton-card skeleton-station ${
              index % 3 === 1 ? "skeleton-tall" : ""
            }`}
            key={index}
          >
            <span className="skeleton-line skeleton-medium" />
            <span className="skeleton-line skeleton-wide" />
            <span className="skeleton-line skeleton-wide" />
            <span className="skeleton-line skeleton-medium" />
          </Card>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading fleet activity
      </span>
    </section>
  );
}

function CreateFleetDialog({
  providers,
  onClose,
  onCreated,
}: {
  providers: FleetProvider[];
  onClose: () => void;
  onCreated: (fleet: FleetInstance) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [providerId, setProviderId] = useState(providers[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = providers.find((candidate) => candidate.id === providerId);

  async function submit() {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("Enter a fleet name.");
      return;
    }
    if (!providerId) {
      setError("Select an available fleet provider.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createFleet({
        name: normalizedName,
        providerId,
      });
      await onCreated(created);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : String(createError),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      modalType="modal"
      onOpenChange={(_, data) => {
        if (!data.open && !saving) onClose();
      }}
    >
      <DialogSurface className="dialog create-fleet-dialog">
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger disableButtonEnhancement>
                <Button
                  appearance="subtle"
                  className="icon-button"
                  type="button"
                  icon={<Dismiss24Regular aria-hidden="true" />}
                  aria-label="Close"
                  disabled={saving}
                />
              </DialogTrigger>
            }
          >
            Create new fleet
          </DialogTitle>
          <DialogContent className="command-content">
            <p className="dialog-intro">
              Create another named dashboard instance from an installed fleet
              provider. Provider files stay read-only; the instance is stored in
              your Copilot home.
            </p>
            <div className="command-grid">
              <label>
                Fleet name
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  autoFocus
                  disabled={saving}
                />
              </label>
              <div className="control-field">
                <span>Provider</span>
                <SearchableSelect
                  value={providerId}
                  onValueChange={setProviderId}
                  ariaLabel="Fleet provider"
                  searchPlaceholder="Search providers"
                  options={providers.map((candidate) => ({
                    value: candidate.id,
                    label: candidate.displayName,
                    keywords: `${candidate.id} ${candidate.root}`,
                  }))}
                  disabled={saving}
                  clearable
                  clearValue=""
                />
              </div>
            </div>
            {provider ? (
              <div className="provider-source">
                <strong>{provider.displayName}</strong>
                <span>{provider.id}</span>
                <code>{provider.root}</code>
              </div>
            ) : null}
            {saving ? (
              <div className="notice notice-running" role="status">
                Creating fleet…
              </div>
            ) : null}
            {error ? (
              <div className="notice notice-failed" role="alert">
                {error}
              </div>
            ) : null}
            <div className="dialog-actions">
              <Button
                appearance="secondary"
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                className="primary-button"
                type="button"
                icon={<Add24Regular aria-hidden="true" />}
                disabled={saving || !name.trim() || !providerId}
                onClick={() => void submit()}
              >
                Create fleet
              </Button>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function RenameFleetDialog({
  fleet,
  onClose,
  onRenamed,
}: {
  fleet: FleetInstance;
  onClose: () => void;
  onRenamed: (fleet: FleetInstance) => Promise<void>;
}) {
  const [name, setName] = useState(fleet.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("Enter a fleet name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onRenamed(await renameFleet({ id: fleet.id, name: normalizedName }));
    } catch (renameError) {
      setError(
        renameError instanceof Error ? renameError.message : String(renameError),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      modalType="modal"
      onOpenChange={(_, data) => {
        if (!data.open && !saving) onClose();
      }}
    >
      <DialogSurface className="dialog rename-fleet-dialog">
        <DialogBody>
          <DialogTitle>Rename fleet</DialogTitle>
          <DialogContent className="command-content">
            <label>
              Fleet name
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                autoFocus
                disabled={saving}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
            </label>
            {error ? (
              <div className="notice notice-failed" role="alert">
                {error}
              </div>
            ) : null}
            <div className="dialog-actions">
              <Button
                appearance="secondary"
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                className="primary-button"
                type="button"
                disabled={saving || !name.trim() || name.trim() === fleet.name}
                onClick={() => void submit()}
              >
                Save name
              </Button>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function DeleteFleetDialog({
  fleet,
  onClose,
  onDeleted,
}: {
  fleet: FleetInstance;
  onClose: () => void;
  onDeleted: (fleets: FleetsData) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await onDeleted(await deleteFleet(fleet.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : String(deleteError),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open
      modalType="modal"
      onOpenChange={(_, data) => {
        if (!data.open && !deleting) onClose();
      }}
    >
      <DialogSurface className="dialog delete-fleet-dialog">
        <DialogBody>
          <DialogTitle>Delete fleet?</DialogTitle>
          <DialogContent className="command-content">
            <p>
              Delete <strong>{fleet.name}</strong> from this dashboard?
            </p>
            <p className="dialog-intro">
              The fleet provider and its files are not deleted. This only removes
              the named dashboard instance from your Copilot home.
            </p>
            {error ? (
              <div className="notice notice-failed" role="alert">
                {error}
              </div>
            ) : null}
            <div className="dialog-actions">
              <Button
                appearance="secondary"
                className="secondary-button"
                type="button"
                disabled={deleting}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                appearance="secondary"
                className="danger-button"
                type="button"
                icon={<Delete24Regular aria-hidden="true" />}
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                Delete fleet
              </Button>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function CommandDialog({
  fleetId,
  stations,
  projects,
  availableModels,
  selectedProject,
  preset,
  onClose,
  onStarted,
}: {
  fleetId: string;
  stations: StationSummary[];
  projects: ProjectSummary[];
  availableModels: string[];
  selectedProject: string;
  preset?: CommandPreset | null;
  onClose: () => void;
  onStarted?: (job: CommandJob) => void;
}) {
  const initialProject =
    preset?.project
    || (selectedProject !== "all"
      ? selectedProject
      : projects[0]?.repository || "");
  const initialStation =
    stations.find((station) => station.id === preset?.stationId)
    || stations.find((station) => station.id === "shipwright")
    || stations[0];
  const [project, setProject] = useState(initialProject);
  const [stationId, setStationId] = useState(initialStation?.id || "");
  const [model, setModel] = useState(
    preset?.model || initialStation?.model || "",
  );
  const [prompt, setPrompt] = useState(preset?.prompt || "");
  const [maxCredits, setMaxCredits] = useState(30);
  const [confirmed, setConfirmed] = useState(false);
  const [job, setJob] = useState<CommandJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const timer = window.setInterval(async () => {
      try {
        const current = await getCommandJob(fleetId, job.id);
        setJob(current);
      } catch (jobError) {
        setError(jobError instanceof Error ? jobError.message : String(jobError));
      }
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [fleetId, job]);

  function changeStation(nextStationId: string) {
    setStationId(nextStationId);
    const station = stations.find((candidate) => candidate.id === nextStationId);
    if (station) setModel(station.model);
  }

  async function runAgent() {
    setError(null);
    try {
      const started = await startAgentCommand(fleetId, {
        project,
        station: stationId,
        model,
        prompt,
        maxCredits,
        confirmed,
        taskId: preset?.taskId,
        kind: preset?.kind,
      });
      onStarted?.(started);
      if (isSmokeTest) {
        onClose();
        return;
      }
      setJob(started);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    }
  }

  const models = Array.from(
    new Set([
      model,
      ...stations.map((station) => station.model),
      ...availableModels,
    ]),
  ).filter(Boolean);
  const action = preset?.action || "run";
  const isSmokeTest = preset?.kind === "smoke";
  const dialogTitle =
    action === "handoff"
      ? "Hand off task"
      : action === "retry"
        ? "Retry task"
        : isSmokeTest
          ? "Run model smoke test"
          : "Run a fleet agent";
  const actionLabel =
    action === "handoff"
      ? "Hand off and run"
      : action === "retry"
        ? "Retry agent"
        : isSmokeTest
          ? "Run smoke test"
          : "Run agent";

  return (
    <Dialog
      open
      modalType="modal"
      onOpenChange={(_, data) => {
        if (!data.open && job?.status !== "running") onClose();
      }}
    >
      <DialogSurface className="dialog command-dialog">
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger disableButtonEnhancement>
                <Button
                  appearance="subtle"
                  className="icon-button"
                  type="button"
                  icon={<Dismiss24Regular aria-hidden="true" />}
                  aria-label="Close"
                  disabled={job?.status === "running"}
                />
              </DialogTrigger>
            }
          >
            {dialogTitle}
          </DialogTitle>
          <DialogContent className="command-content">
            <p className="dialog-intro">
              {action === "handoff"
                ? `Prepare ${preset?.taskTitle || "this task"} for the selected agent. The new run will remain attached to the task's board history.`
                : action === "retry"
                  ? `Restart ${preset?.taskTitle || "this task"} with the current agent and preserve its earlier attempts.`
                  : isSmokeTest
                    ? "Run one minimal no-write availability check for this model. The result updates model health after local telemetry records the call."
                    : "Start a Copilot CLI agent in a known local checkout. The dashboard applies the selected AI-credit limit and records the run in live fleet activity."}
            </p>
            <div className="command-grid">
              <div className="control-field">
                <span>Project</span>
                <SearchableSelect
                  value={project}
                  onValueChange={setProject}
                  ariaLabel="Project"
                  searchPlaceholder="Search projects"
                  options={projects.map((candidate) => ({
                    value: candidate.repository,
                    label: candidate.repository,
                  }))}
                  disabled={
                    job?.status === "running" || Boolean(preset?.taskId)
                  }
                  clearable
                  clearValue=""
                />
              </div>
              <div className="control-field">
                <span>Agent</span>
                <SearchableSelect
                  value={stationId}
                  onValueChange={changeStation}
                  ariaLabel="Agent"
                  searchPlaceholder="Search agents"
                  options={stations.map((station) => ({
                    value: station.id,
                    label: station.display,
                    keywords: `${station.title} ${station.model}`,
                  }))}
                  disabled={
                    job?.status === "running" || Boolean(preset?.taskId)
                  }
                  clearable
                  clearValue=""
                />
              </div>
              <div className="control-field">
                <span>Model for this run</span>
                <SearchableSelect
                  value={model}
                  onValueChange={setModel}
                  ariaLabel="Model for this run"
                  searchPlaceholder="Search models"
                  options={models.map((candidate) => ({
                    value: candidate,
                    label: candidate,
                  }))}
                  disabled={job?.status === "running"}
                  clearable
                  clearValue=""
                />
              </div>
              <label>
                Maximum AI credits
                <Input
                  type="number"
                  min={30}
                  max={1000}
                  step={1}
                  value={String(maxCredits)}
                  onChange={(event) => setMaxCredits(Number(event.target.value))}
                  disabled={job?.status === "running"}
                />
              </label>
            </div>
            <label className="command-prompt">
              Command
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the task for the selected agent."
                resize="vertical"
                disabled={job?.status === "running"}
              />
            </label>
            <Checkbox
              checked={confirmed}
              onChange={(_, data) => setConfirmed(data.checked === true)}
              disabled={job?.status === "running"}
              label="I understand this non-interactive run auto-approves the selected agent's tools and may modify files or run commands from the chosen checkout."
            />
            {job ? (
              <div className={`notice notice-${job.status}`} aria-live="polite">
                <strong>{job.message}</strong>
                <span>
                  {job.agent} · {job.model} · max {job.maxCredits} credits
                </span>
              </div>
            ) : null}
            {job?.output ? (
              <pre className="command-output">{job.output}</pre>
            ) : null}
            {error ? (
              <div className="notice notice-failed" role="alert">
                {error}
              </div>
            ) : null}
            <div className="dialog-actions">
              <Button
                appearance="primary"
                className="primary-button"
                icon={
                  action === "retry"
                    ? <Replay20Regular aria-hidden="true" />
                    : <Play24Regular aria-hidden="true" />
                }
                onClick={runAgent}
                disabled={
                  job?.status === "running"
                  || !project
                  || !stationId
                  || !model
                  || !prompt.trim()
                  || !confirmed
                }
              >
                {job?.status === "running" ? "Agent running" : actionLabel}
              </Button>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function SmokeSuiteDialog({
  fleetId,
  stations,
  projects,
  selectedProject,
  onClose,
  onCompleted,
  onStarted,
}: {
  fleetId: string;
  stations: StationSummary[];
  projects: ProjectSummary[];
  selectedProject: string;
  onClose: () => void;
  onCompleted: () => void;
  onStarted: (job: SmokeSuiteJob) => void;
}) {
  const initialProject =
    selectedProject !== "all"
      ? selectedProject
      : projects.find(projectIsActive)?.repository
        || projects[0]?.repository
        || "";
  const previewTargets = useMemo(() => {
    const seen = new Set<string>();
    return stations.filter((station) => {
      if (seen.has(station.model)) return false;
      seen.add(station.model);
      return true;
    });
  }, [stations]);
  const [project, setProject] = useState(initialProject);
  const [confirmed, setConfirmed] = useState(false);
  const [job, setJob] = useState<SmokeSuiteJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completionHandledRef = useRef<string | null>(null);

  useEffect(() => {
    void getCurrentSmokeSuite(fleetId).then(
      ({ job: current }) => {
        if (current?.status === "running") setJob(current);
      },
      () => undefined,
    );
  }, [fleetId]);

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const timer = window.setInterval(async () => {
      try {
        const current = await getSmokeSuiteJob(fleetId, job.id);
        setJob(current);
        if (
          current.status !== "running"
          && completionHandledRef.current !== current.id
        ) {
          completionHandledRef.current = current.id;
          onCompleted();
        }
      } catch (jobError) {
        setError(jobError instanceof Error ? jobError.message : String(jobError));
      }
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [fleetId, job, onCompleted]);

  async function runSuite() {
    setError(null);
    try {
      const started = await startSmokeSuite(fleetId, { project, confirmed });
      completionHandledRef.current = null;
      onStarted(started);
      onClose();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    }
  }

  const targets = job?.targets || previewTargets.map((station) => ({
    station: station.id,
    agent: station.display,
    model: station.model,
    status: "pending" as const,
    message: "Waiting",
    commandJobId: null,
  }));
  const running = job?.status === "running";
  const totalCreditLimit =
    (job?.total || previewTargets.length) * (job?.maxCreditsPerModel || 30);

  return (
    <Dialog open modalType="modal" onOpenChange={(_, data) => {
      if (!data.open) onClose();
    }}>
      <DialogSurface className="dialog command-dialog">
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger disableButtonEnhancement>
                <Button
                  appearance="subtle"
                  className="icon-button"
                  type="button"
                  icon={<Dismiss24Regular aria-hidden="true" />}
                  aria-label="Close"
                />
              </DialogTrigger>
            }
          >
            Run model smoke suite
          </DialogTitle>
          <DialogContent className="command-content">
            <p className="dialog-intro">
              Test each configured model once, sequentially, using a representative
              fleet station. Every check is instructed not to inspect files, call
              tools, or modify the selected checkout.
            </p>
            <div className="smoke-suite-project control-field">
              <span>Project</span>
              <SearchableSelect
                value={project}
                onValueChange={setProject}
                ariaLabel="Project"
                searchPlaceholder="Search projects"
                options={projects.map((candidate) => ({
                  value: candidate.repository,
                  label: candidate.repository,
                }))}
                disabled={running}
                clearable
                clearValue=""
              />
            </div>
            <div className="smoke-suite-list" aria-label="Configured model tests">
              {targets.map((target) => (
                <div className="smoke-suite-row" key={target.model}>
                  <span>
                    <strong>{target.model}</strong>
                    <small>{target.agent}</small>
                  </span>
                  <Badge
                    appearance="outline"
                    color={
                      target.status === "completed"
                        ? "success"
                        : target.status === "failed"
                          ? "danger"
                          : target.status === "running"
                            ? "warning"
                            : "subtle"
                    }
                    shape="rounded"
                  >
                    {target.status === "pending"
                      ? "Waiting"
                      : target.status === "running"
                        ? "Running"
                        : target.status === "completed"
                          ? "Passed"
                          : "Failed"}
                  </Badge>
                </div>
              ))}
            </div>
            {job ? (
              <div
                className={`notice notice-${job.status}`}
                aria-live="polite"
              >
                <strong>{job.message}</strong>
                <span>
                  {job.completed} passed · {job.failed} failed · {job.total} total
                </span>
              </div>
            ) : null}
            {!running ? (
              <Checkbox
                checked={confirmed}
                onChange={(_, data) => setConfirmed(data.checked === true)}
                label={`I understand this launches ${previewTargets.length} sequential agent checks with a 30-credit limit each (${totalCreditLimit} credits maximum).`}
              />
            ) : (
              <p className="dialog-intro">
                The suite is running sequentially in the background. Progress is
                also visible in the model table.
              </p>
            )}
            {error ? (
              <div className="notice notice-failed" role="alert">
                {error}
              </div>
            ) : null}
            <div className="dialog-actions">
              <Button
                appearance="primary"
                className="primary-button"
                type="button"
                icon={<Pulse24Regular aria-hidden="true" />}
                onClick={() => {
                  if (job && job.status !== "running") {
                    setJob(null);
                    setConfirmed(false);
                    return;
                  }
                  void runSuite();
                }}
                disabled={running || !project || !confirmed}
              >
                {job && job.status !== "running" ? "Run again" : "Run smoke suite"}
              </Button>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function SettingsView({
  fleetId,
  section,
  refreshInterval,
  onRefreshIntervalChange,
  focusedStationId,
  mode,
  resolvedMode,
  onModeChange,
  crews,
  stations,
  projects,
  hiddenProjects,
  onCrewsSaved,
  onHideProject,
  onShowProject,
  onSectionChange,
  canManageCrews,
  canOverrideModels,
}: {
  fleetId: string;
  section: SettingsSection;
  refreshInterval: number;
  onRefreshIntervalChange: (interval: number) => void;
  focusedStationId: string | null;
  mode: AppearanceMode;
  resolvedMode: "light" | "dark";
  onModeChange: (mode: AppearanceMode) => void;
  crews: CrewsData | null;
  stations: StationSummary[];
  projects: ProjectSummary[];
  hiddenProjects: string[];
  onCrewsSaved: () => Promise<void>;
  onHideProject: (repository: string) => void;
  onShowProject: (repository: string) => void;
  onSectionChange: (section: SettingsSection) => void;
  canManageCrews: boolean;
  canOverrideModels: boolean;
}) {
  return (
    <section
      className="settings-view view-enter"
      aria-labelledby="settings-title"
    >
      <div className="page-heading settings-page-heading">
        <div>
          <Title1 as="h2" id="settings-title">
            Settings
          </Title1>
          <p>Personalize the fleet dashboard and your installed agent crew.</p>
        </div>
      </div>
      <Card appearance="filled" className="settings-surface">
            <div className="settings-layout">
              <nav className="settings-nav" aria-label="Settings sections">
                <Button
                  appearance="subtle"
                  className={`settings-nav-button ${
                    section === "general" ? "selected" : ""
                  }`}
                  icon={<Settings24Regular aria-hidden="true" />}
                  onClick={() => onSectionChange("general")}
                  aria-current={section === "general" ? "page" : undefined}
                >
                  General
                </Button>
                <Button
                  appearance="subtle"
                  className={`settings-nav-button ${
                    section === "appearance" ? "selected" : ""
                  }`}
                  icon={<PaintBrush24Regular aria-hidden="true" />}
                  onClick={() => onSectionChange("appearance")}
                  aria-current={section === "appearance" ? "page" : undefined}
                >
                  Appearance
                </Button>
                <Button
                  appearance="subtle"
                  className={`settings-nav-button ${
                    section === "projects" ? "selected" : ""
                  }`}
                  icon={<BranchFork24Regular aria-hidden="true" />}
                  onClick={() => onSectionChange("projects")}
                  aria-current={section === "projects" ? "page" : undefined}
                >
                  Projects
                </Button>
                <Button
                  appearance="subtle"
                  className={`settings-nav-button ${
                    section === "agents" ? "selected" : ""
                  }`}
                  icon={<PeopleTeam24Regular aria-hidden="true" />}
                  onClick={() => onSectionChange("agents")}
                  aria-current={section === "agents" ? "page" : undefined}
                  disabled={!canManageCrews}
                >
                  Agents
                </Button>
              </nav>
              <div
                className="settings-panel settings-panel-enter"
                key={section}
              >
                {section === "general" ? (
                  <section className="settings-section" aria-labelledby="auto-refresh-title">
                    <div className="settings-section-heading">
                      <div>
                        <Title2 as="h3" id="auto-refresh-title">Auto-refresh</Title2>
                        <p id="auto-refresh-description">
                          Choose how often visible dashboard telemetry updates.
                          Saved in this browser. Range changes refresh immediately.
                        </p>
                      </div>
                    </div>
                    <SearchableSelect
                      value={String(refreshInterval)}
                      onValueChange={(value) => onRefreshIntervalChange(Number(value))}
                      ariaLabel="Auto-refresh interval"
                      ariaDescribedBy="auto-refresh-description"
                      options={refreshIntervals.map((interval) => ({
                        value: String(interval),
                        label: `${interval / 1000} seconds`,
                      }))}
                      clearable={false}
                    />
                  </section>
                ) : section === "appearance" ? (
                  <>
                    <div className="settings-intro">
                      <Title1 as="h3">Themes</Title1>
                      <p>
                        The fleet dashboard uses Fluent components and the
                        standard Fluent light and dark themes.
                      </p>
                    </div>

                    <section
                      className="settings-section"
                      aria-labelledby="color-mode-title"
                    >
                      <div className="settings-section-heading">
                        <div>
                          <Title2 as="h4" id="color-mode-title">
                            Color mode
                          </Title2>
                          <p>Use your device setting or keep one mode active.</p>
                        </div>
                        <Badge
                          appearance="outline"
                          color="informative"
                          shape="rounded"
                        >
                          {mode === "system"
                            ? `System is ${resolvedMode}`
                            : `${resolvedMode} mode`}
                        </Badge>
                      </div>
                      <fieldset className="theme-mode-fieldset">
                        <legend className="sr-only">Color mode</legend>
                        <div className="theme-mode-grid">
                          {appearanceModes.map((option) => (
                            <label className="theme-mode-option" key={option.id}>
                              <input
                                type="radio"
                                name="appearance-mode"
                                value={option.id}
                                checked={mode === option.id}
                                onChange={() => onModeChange(option.id)}
                              />
                              <Card
                                appearance="filled"
                                className={`theme-mode-card ${
                                  mode === option.id ? "selected" : ""
                                }`}
                              >
                                <span
                                  className="theme-mode-icon"
                                  aria-hidden="true"
                                >
                                  {option.icon}
                                </span>
                                <span className="theme-mode-copy">
                                  <strong>{option.label}</strong>
                                  <small>{option.detail}</small>
                                </span>
                                {mode === option.id ? (
                                  <Checkmark20Regular
                                    className="theme-mode-check"
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </Card>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </section>

                  </>
                ) : section === "projects" ? (
                  <ProjectSettingsPanel
                    projects={projects}
                    hiddenProjects={hiddenProjects}
                    onHideProject={onHideProject}
                    onShowProject={onShowProject}
                  />
                ) : (
                  canManageCrews ? (
                    <CrewSettingsPanel
                      fleetId={fleetId}
                      crews={crews}
                      stations={stations}
                      canOverrideModels={canOverrideModels}
                      focusedStationId={focusedStationId}
                      onSaved={onCrewsSaved}
                    />
                  ) : (
                    <div className="notice notice-warning" role="status">
                      This provider does not support crew or model configuration.
                    </div>
                  )
                )}
              </div>
            </div>
      </Card>
    </section>
  );
}

function GitHubLoginControls({
  autoFocus = false,
  inputId,
  onAuthenticated,
  submitLabel = "Add account",
}: {
  autoFocus?: boolean;
  inputId: string;
  onAuthenticated: () => Promise<void>;
  submitLabel?: string;
}) {
  const [hostname, setHostname] = useState("github.com");
  const [job, setJob] = useState<AuthJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const timer = window.setInterval(async () => {
      try {
        const current = await getAuthJob(job.id);
        setJob(current);
        if (current.status === "completed") {
          await onAuthenticated();
        }
      } catch (jobError) {
        setError(jobError instanceof Error ? jobError.message : String(jobError));
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job, onAuthenticated]);

  async function login() {
    setError(null);
    try {
      setJob(await startLogin(hostname));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : String(loginError));
    }
  }

  return (
    <>
      <div className="login-box">
        <label htmlFor={inputId}>GitHub hostname</label>
        <div className="input-action">
          <Input
            id={inputId}
            autoFocus={autoFocus}
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            placeholder="github.com or company.ghe.com"
          />
          <Button
            appearance="primary"
            className="primary-button"
            type="button"
            onClick={login}
            disabled={job?.status === "running"}
            icon={<Add24Regular aria-hidden="true" />}
          >
            {job?.status === "running" ? "Waiting for sign-in" : submitLabel}
          </Button>
        </div>
        <p className="field-help">
          GitHub.com Enterprise Managed Users authenticate through your
          organization's identity provider. For data residency, enter the
          enterprise's GHE.com hostname. If a browser does not open, follow the
          device instructions shown below.
        </p>
      </div>
      {job ? (
        <div
          className={`notice auth-job-notice notice-${job.status}`}
          aria-live="polite"
        >
          {job.message}
        </div>
      ) : null}
      {error ? (
        <div className="notice notice-failed" role="alert">
          {error}
        </div>
      ) : null}
    </>
  );
}

function AuthenticationGate({
  auth,
  onAuthenticated,
}: {
  auth: AuthStatus | null;
  onAuthenticated: () => Promise<void>;
}) {
  return (
    <main className="auth-gate">
      <Card appearance="filled" className="auth-gate-card">
        <Title1 as="h1">
          {auth === null ? "Getting things ready" : "Sign in to continue"}
        </Title1>
        {auth !== null ? (
          <p>
            Sign in with GitHub to view local fleet activity and run agents.
          </p>
        ) : null}
        {auth === null ? (
          <div className="notice auth-check-status" role="status">
            <Spinner size="small" aria-hidden="true" />
            <span>Checking your GitHub sign-in...</span>
          </div>
        ) : auth.available ? (
          <>
            {auth.error ? (
              <div className="notice notice-failed" role="alert">
                {auth.error}
              </div>
            ) : null}
            <GitHubLoginControls
              autoFocus
              inputId="github-hostname-gate"
              onAuthenticated={onAuthenticated}
              submitLabel="Sign in"
            />
          </>
        ) : (
          <div className="notice notice-failed" role="alert">
            {auth.error || "GitHub CLI is required to sign in."}
          </div>
        )}
      </Card>
    </main>
  );
}

function AccountDialog({
  auth,
  onClose,
  onRefresh,
  onAuthChange,
  onAccountChanging,
}: {
  auth: AuthStatus | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onAuthChange: (auth: AuthStatus) => void;
  onAccountChanging: () => void;
}) {
  const [logoutTarget, setLogoutTarget] = useState<GitHubAccount | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const logoutCancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!logoutTarget) return;
    const focusConfirmation = window.setTimeout(
      () => logoutCancelRef.current?.focus(),
      0,
    );
    return () => window.clearTimeout(focusConfirmation);
  }, [logoutTarget]);

  async function activate(host: string, loginName: string) {
    setError(null);
    setSwitching(true);
    onAccountChanging();
    try {
      await switchAccount(host, loginName);
      window.location.reload();
    } catch (switchError) {
      setError(
        switchError instanceof Error ? switchError.message : String(switchError),
      );
      await onRefresh();
    } finally {
      setSwitching(false);
    }
  }

  async function confirmLogout() {
    if (!logoutTarget) return;
    setLoggingOut(true);
    setError(null);
    onAccountChanging();
    try {
      const nextAuth = await logoutAccount(
        logoutTarget.host,
        logoutTarget.login,
      );
      setLogoutTarget(null);
      onAuthChange(nextAuth);
      if (hasAuthenticatedAccount(nextAuth)) {
        window.setTimeout(
          () => document.getElementById("github-hostname-dialog")?.focus(),
          0,
        );
      }
    } catch (logoutError) {
      setError(
        logoutError instanceof Error ? logoutError.message : String(logoutError),
      );
      await onRefresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Dialog
      open
      modalType="modal"
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      <DialogSurface className="dialog">
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger disableButtonEnhancement>
                <Button
                  appearance="subtle"
                  className="icon-button"
                  type="button"
                  icon={<Dismiss24Regular aria-hidden="true" />}
                  aria-label="Close"
                />
              </DialogTrigger>
            }
          >
            <span id="account-dialog-title">GitHub and EMU accounts</span>
          </DialogTitle>
          <DialogContent>
            <p className="dialog-intro">
              Authentication is handled by the official GitHub CLI browser flow.
              The dashboard never reads or stores your token or password.
            </p>
            <div className="account-list" inert={Boolean(logoutTarget) || switching}>
              {auth?.accounts.length ? (
                auth.accounts.map((account) => (
                  <article className="account-row" key={`${account.host}:${account.login}`}>
                    <div className="account-avatar" aria-hidden="true">
                      {account.avatarUrl ? (
                        <img src={account.avatarUrl} alt="" />
                      ) : (
                        <Person24Regular />
                      )}
                    </div>
                    <div>
                      <strong>{account.login}</strong>
                      <p>{account.host}</p>
                    </div>
                    <span className="account-state">
                      {account.active ? "Active" : account.state}
                    </span>
                    <div className="account-actions">
                      {!account.active ? (
                        <Button
                          appearance="secondary"
                          className="secondary-button"
                          type="button"
                          onClick={() => activate(account.host, account.login)}
                        >
                          Use account
                        </Button>
                      ) : null}
                      <Button
                        appearance="subtle"
                        className="account-signout-button"
                        type="button"
                        icon={<SignOut24Regular aria-hidden="true" />}
                        onClick={(event) => {
                          setError(null);
                          logoutTriggerRef.current = event.currentTarget;
                          setLogoutTarget(account);
                        }}
                        disabled={loggingOut}
                      >
                        Sign out
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state compact">
                  <Key24Regular aria-hidden="true" />
                  <p>No authenticated GitHub account found.</p>
                </div>
              )}
            </div>
            {logoutTarget ? (
              <div
                className="account-logout-confirmation"
                role="group"
                aria-live="polite"
                aria-label={`Confirm sign out for ${logoutTarget.login}`}
              >
                <div>
                  <strong>
                    Sign out {logoutTarget.login} from {logoutTarget.host}?
                  </strong>
                  <p>
                    This removes the account from GitHub CLI on this machine.
                    It does not revoke the token.
                  </p>
                </div>
                <div className="account-logout-actions">
                  <Button
                    appearance="secondary"
                    className="secondary-button"
                    type="button"
                    ref={logoutCancelRef}
                    onClick={() => {
                      setLogoutTarget(null);
                      window.setTimeout(
                        () => logoutTriggerRef.current?.focus(),
                        0,
                      );
                    }}
                    disabled={loggingOut}
                  >
                    Cancel
                  </Button>
                  <Button
                    appearance="secondary"
                    className="danger-button"
                    type="button"
                    icon={<SignOut24Regular aria-hidden="true" />}
                    onClick={() => void confirmLogout()}
                    disabled={loggingOut}
                  >
                    {loggingOut ? "Signing out" : "Sign out"}
                  </Button>
                </div>
              </div>
            ) : null}
            <div
              className="account-login-region"
              inert={Boolean(logoutTarget)}
            >
              <GitHubLoginControls
                inputId="github-hostname-dialog"
                onAuthenticated={onRefresh}
              />
            </div>
            {error ? (
              <div className="notice notice-failed" role="alert">
                {error}
              </div>
            ) : null}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function CrewSettingsPanel({
  fleetId,
  crews,
  stations,
  canOverrideModels,
  focusedStationId,
  onSaved,
}: {
  fleetId: string;
  crews: CrewsData | null;
  stations: StationSummary[];
  canOverrideModels: boolean;
  focusedStationId: string | null;
  onSaved: () => Promise<void>;
}) {
  const initialCrew =
    crews?.crews.find((crew) => crew.yours) || crews?.crews[0] || null;
  const [crewId, setCrewId] = useState(initialCrew?.name || "my-fleet");
  const [label, setLabel] = useState(initialCrew?.label || "My fleet");
  const [names, setNames] = useState<Record<string, string>>(
    initialCrew?.names || Object.fromEntries(
      (crews?.roles || []).map((role) => [role.id, role.display]),
    ),
  );
  const [models, setModels] = useState<Record<string, string>>(
    Object.fromEntries(
      (crews?.roles || []).map((role) => [
        role.id,
        initialCrew?.models?.[role.id] || role.model,
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stationsById = useMemo(
    () => new Map(stations.map((station) => [station.id, station])),
    [stations],
  );
  useEffect(() => {
    if (!focusedStationId || !crews) return;
    const frame = window.requestAnimationFrame(() => {
      const field = document.getElementById(
        `${canOverrideModels ? "station-model" : "station-name"}-${focusedStationId}`,
      );
      field?.focus();
      field?.scrollIntoView({ block: "center", behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedStationId, canOverrideModels, crews]);

  function loadCrew(name: string) {
    const crew = crews?.crews.find((candidate) => candidate.name === name);
    if (!crew) {
      setCrewId("my-fleet");
      setLabel("My fleet");
      setNames(
        Object.fromEntries(
          (crews?.roles || []).map((role) => [role.id, role.display]),
        ),
      );
      setModels(
        Object.fromEntries(
          (crews?.roles || []).map((role) => [role.id, role.model]),
        ),
      );
      setMessage(null);
      setError(null);
      return;
    }
    setCrewId(crew.name);
    setLabel(crew.label);
    setNames(crew.names);
    setModels(
      Object.fromEntries(
        (crews?.roles || []).map((role) => [
          role.id,
          crew.models?.[role.id] || role.model,
        ]),
      ),
    );
    setMessage(null);
    setError(null);
  }

  async function save(install: boolean) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const result = await saveCrew(fleetId, {
        name: crewId,
        label,
        names,
        models,
        install,
      });
      setMessage(result.message);
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-agents">
      <div className="settings-intro">
        <Title1 as="h3">Rename your fleet</Title1>
        <p>
          A crew changes display names without changing station roles, models,
          or handoff rules. GitHub sign-in is not required.
        </p>
        <p id="model-smoke-description">
          Smoke tests run only when you choose Run smoke test and confirm its
          credit controls. Changing or saving a model does not run a smoke test.
        </p>
        {!canOverrideModels ? (
          <p className="capability-note" role="status">
            This provider keeps station models fixed. You can still rename and
            install the crew.
          </p>
        ) : null}
      </div>
            <div className="crew-toolbar">
              <div className="control-field">
                <span>Start from</span>
                <SearchableSelect
                  value={
                    crews?.crews.some((crew) => crew.name === crewId)
                      ? crewId
                      : ""
                  }
                  onValueChange={loadCrew}
                  ariaLabel="Start from crew"
                  searchPlaceholder="Search crews"
                  options={[
                    { value: "", label: "New crew" },
                    ...(crews?.crews.map((crew) => ({
                      value: crew.name,
                      label: `${crew.label}${crew.yours ? " (yours)" : ""}`,
                    })) || []),
                  ]}
                  clearable
                  clearValue=""
                />
              </div>
              <label>
                Crew id
                <Input
                  value={crewId}
                  onChange={(event) => setCrewId(event.target.value)}
                  placeholder="my-fleet"
                />
              </label>
              <label>
                Display label
                <Input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="My fleet"
                />
              </label>
            </div>
            <div className="crew-grid">
              {crews?.roles.map((role) => {
                const station = stationsById.get(role.id);
                return (
                  <div className="crew-field" key={role.id}>
                    <span>
                      <strong>{role.display}</strong>
                      <small>
                        {role.title} · {role.model}
                      </small>
                      {station ? (
                        <small className="crew-field-metrics">
                          {station.runs} runs · {formatLatency(station.averageTtftMs)} avg. first token
                        </small>
                      ) : null}
                    </span>
                    <Input
                      id={`station-name-${role.id}`}
                      value={names[role.id] || ""}
                      onChange={(event) =>
                        setNames((current) => ({
                          ...current,
                          [role.id]: event.target.value,
                        }))
                      }
                      aria-label={`Name for ${role.display}`}
                    />
                    <SearchableSelect
                      id={`station-model-${role.id}`}
                      ariaDescribedBy="model-smoke-description"
                      value={models[role.id] || role.model}
                      onValueChange={(value) =>
                        setModels((current) => ({
                          ...current,
                          [role.id]: value,
                        }))
                      }
                      ariaLabel={`Model for ${role.display}`}
                      searchPlaceholder="Search models"
                      disabled={!canOverrideModels}
                      clearable
                      clearValue={role.model}
                      options={Array.from(
                        new Set([
                          role.model,
                          models[role.id],
                          ...(crews?.availableModels || []),
                        ]),
                      )
                        .filter(Boolean)
                        .map((model) => ({
                          value: model,
                          label: model,
                        }))}
                    />
                  </div>
                );
              })}
            </div>
            {message ? (
              <div className="notice notice-completed" role="status">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="notice notice-failed" role="alert">
                {error}
              </div>
            ) : null}
          <div className="dialog-actions">
            <Button
              appearance="secondary"
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={() => save(false)}
              icon={<Save24Regular aria-hidden="true" />}
            >
              Save crew
            </Button>
            <Button
              appearance="primary"
              className="primary-button"
              type="button"
              disabled={saving}
              onClick={() => save(true)}
              icon={<PeopleTeam24Regular aria-hidden="true" />}
            >
              Save and install
            </Button>
          </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<DashboardView>("overview");
  const [days, setDays] = useState(loadTelemetryRange);
  const [refreshInterval, setRefreshInterval] = useState(loadRefreshInterval);
  const [focusedStationId, setFocusedStationId] = useState<string | null>(null);
  const [project, setProject] = useState("all");
  const [fleetsData, setFleetsData] = useState<FleetsData | null>(null);
  const [activeFleetId, setActiveFleetId] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [crews, setCrews] = useState<CrewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [createFleetOpen, setCreateFleetOpen] = useState(false);
  const [renameFleetTarget, setRenameFleetTarget] =
    useState<FleetInstance | null>(null);
  const [deleteFleetTarget, setDeleteFleetTarget] =
    useState<FleetInstance | null>(null);
  const [smokeSuiteOpen, setSmokeSuiteOpen] = useState(false);
  const [smokeSuiteJob, setSmokeSuiteJob] = useState<SmokeSuiteJob | null>(null);
  const [animateSummaryMetrics, setAnimateSummaryMetrics] = useState(true);
  const [commandPreset, setCommandPreset] = useState<CommandPreset | null>(null);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("appearance");
  const [showUnusedModels, setShowUnusedModels] = useState(false);
  const [modelActionMessage, setModelActionMessage] = useState<string | null>(
    null,
  );
  const [stationSearch, setStationSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [hiddenProjects, setHiddenProjects] = useState(loadHiddenProjects);
  const [clearedActivity, setClearedActivity] = useState(loadClearedActivity);
  const [stationFamily, setStationFamily] = useState("all");
  const [stationHealth, setStationHealth] =
    useState<StationHealthFilter>("all");
  const [stationSort, setStationSort] = useState<StationSortKey>("fleet");
  const [stationSortDirection, setStationSortDirection] =
    useState<"asc" | "desc">("asc");
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(() => {
    const mode = document.documentElement.dataset.themeMode;
    return mode === "light" || mode === "dark" ? mode : "system";
  });
  const [appearancePalette] = useState<PaletteId>(() =>
    isPaletteId(document.documentElement.dataset.palette)
      ? document.documentElement.dataset.palette
      : defaultPalette,
  );
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem("design-fleet.sidebar-collapsed") === "true",
  );
  const [compactNavigation, setCompactNavigation] = useState(
    () => window.matchMedia("(max-width: 1180px)").matches,
  );
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const telemetryRequest = useRef(0);
  const fleetRequest = useRef(0);
  const telemetryAbortRef = useRef<AbortController | null>(null);
  const fleetAbortRef = useRef<AbortController | null>(null);
  const dashboardReadyRef = useRef(false);
  const initialAuthenticationStartedRef = useRef(false);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const commandButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const fleetSelectorRef = useRef<HTMLDivElement>(null);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);
  const smokeSuiteStatusRef = useRef<string | null>(null);
  const activeFleet = fleetsData?.fleets.find(
    (fleet) => fleet.id === activeFleetId,
  ) || null;
  const activeProvider = fleetsData?.providers.find(
    (provider) => provider.id === activeFleet?.providerId,
  ) || null;

  const refreshCrews = useCallback(async () => {
    if (!activeFleetId) return;
    setCrews(await getCrews(activeFleetId));
  }, [activeFleetId]);

  const completeAuthentication = useCallback(async () => {
    setLoading(true);
    setError(null);
    let nextAuth: AuthStatus;
    try {
      nextAuth = await getAuthStatus();
    } catch (authError) {
      setLoading(false);
      throw authError;
    }

    if (!hasAuthenticatedAccount(nextAuth)) {
      runUiTransition(() => {
        setAuth(nextAuth);
        setLoading(false);
      });
      return;
    }

    try {
      const nextFleets = await getFleets();
      const savedFleetId = window.localStorage.getItem(accountStorageKey(activeFleetStorageKey));
      const selectedFleetId = (
        savedFleetId
        && nextFleets.fleets.some(
          (fleet) => fleet.id === savedFleetId && fleet.available,
        )
          ? savedFleetId
          : nextFleets.defaultFleetId
      );
      if (!selectedFleetId) {
        setAuth(nextAuth);
        setFleetsData(nextFleets);
        setActiveFleetId("");
        setDashboard(null);
        setCrews(null);
        setHiddenProjects([]);
        setClearedActivity({ all: null, projects: {} });
        setLoading(false);
        return;
      }
      const [nextDashboard, nextCrews] = await Promise.all([
        getDashboard(days, project, selectedFleetId),
        getCrews(selectedFleetId),
      ]);
      runUiTransition(() => {
        dashboardReadyRef.current = true;
        setFleetsData(nextFleets);
        setActiveFleetId(selectedFleetId);
        window.localStorage.setItem(accountStorageKey(activeFleetStorageKey), selectedFleetId);
        setDashboard((current) =>
          reconcileDashboard(current, nextDashboard),
        );
        setAuth(nextAuth);
        setCrews(nextCrews);
        setHiddenProjects(loadHiddenProjects());
        setClearedActivity(loadClearedActivity());
        setLoading(false);
      });
    } catch (loadError) {
      runUiTransition(() => {
        setAuth(nextAuth);
        setFleetsData(null);
        setActiveFleetId("");
        setDashboard(null);
        setCrews(null);
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
        setLoading(false);
      });
    }
  }, [days, project]);

  const refreshTelemetry = useCallback(async (showLoading = false) => {
    if (!activeFleetId || fleetAbortRef.current) return;
    // Polls wait; explicit query changes replace an obsolete request immediately.
    if (
      telemetryAbortRef.current
      && !telemetryAbortRef.current.signal.aborted
      && !showLoading
    ) return;
    const requestId = telemetryRequest.current + 1;
    telemetryRequest.current = requestId;
    telemetryAbortRef.current?.abort();
    const controller = new AbortController();
    telemetryAbortRef.current = controller;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const nextDashboard = await getDashboard(
        days,
        project,
        activeFleetId,
        controller.signal,
      );
      if (requestId === telemetryRequest.current) {
        const updateDashboard = () => {
          dashboardReadyRef.current = true;
          setDashboard((current) =>
            reconcileDashboard(current, nextDashboard),
          );
        };
        if (dashboardReadyRef.current) {
          updateDashboard();
        } else {
          runUiTransition(updateDashboard);
        }
      }
    } catch (refreshError) {
      if (refreshError instanceof DOMException && refreshError.name === "AbortError") {
        return;
      }
      if (requestId === telemetryRequest.current) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError),
        );
      }
    } finally {
      if (requestId === telemetryRequest.current) {
        telemetryAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [activeFleetId, days, project]);

  const handleCrewsSaved = useCallback(async () => {
    await refreshCrews();
    await refreshTelemetry(true);
  }, [refreshCrews, refreshTelemetry]);

  const switchFleet = useCallback(async (
    nextFleetId: string,
    registryData = fleetsData,
  ) => {
    if (!registryData || nextFleetId === activeFleetId) return false;
    const nextFleet = registryData.fleets.find(
      (candidate) => candidate.id === nextFleetId,
    );
    if (!nextFleet?.available) {
      setError(nextFleet?.error || "Select an available fleet.");
      return false;
    }

    const requestId = fleetRequest.current + 1;
    fleetRequest.current = requestId;
    telemetryRequest.current += 1;
    telemetryAbortRef.current?.abort();
    fleetAbortRef.current?.abort();
    const controller = new AbortController();
    fleetAbortRef.current = controller;
    setLoading(true);
    setError(null);
    setSmokeSuiteJob(null);
    smokeSuiteStatusRef.current = null;
    try {
      const [allProjectsDashboard, nextCrews] = await Promise.all([
        getDashboard(days, "all", nextFleetId, controller.signal),
        getCrews(nextFleetId, controller.signal),
      ]);
      if (requestId !== fleetRequest.current) return false;
      const nextProject = (
        project !== "all"
        && allProjectsDashboard.projects.some(
          (candidate) => candidate.repository === project,
        )
          ? project
          : "all"
      );
      const nextDashboard = nextProject === "all"
        ? allProjectsDashboard
        : await getDashboard(
            days,
            nextProject,
            nextFleetId,
            controller.signal,
          );
      if (requestId !== fleetRequest.current) return false;
      runUiTransition(() => {
        dashboardReadyRef.current = true;
        setFleetsData(registryData);
        setActiveFleetId(nextFleetId);
        setProject(nextProject);
        setDashboard(nextDashboard);
        setCrews(nextCrews);
        setLoading(false);
        const nextProvider = registryData.providers.find(
          (provider) => provider.id === nextFleet.providerId,
        );
        if (
          settingsSection === "agents"
          && !nextProvider?.capabilities.crewManagement
        ) {
          setSettingsSection("appearance");
        }
        if (compactNavigation) setMobileNavigationOpen(false);
      });
      window.localStorage.setItem(accountStorageKey(activeFleetStorageKey), nextFleetId);
      if (fleetAbortRef.current === controller) {
        fleetAbortRef.current = null;
      }
      return true;
    } catch (switchError) {
      if (fleetAbortRef.current === controller) {
        fleetAbortRef.current = null;
      }
      if (switchError instanceof DOMException && switchError.name === "AbortError") {
        return false;
      }
      if (requestId === fleetRequest.current) {
        setError(
          switchError instanceof Error ? switchError.message : String(switchError),
        );
        setLoading(false);
      }
      return false;
    }
  }, [
    activeFleetId,
    compactNavigation,
    days,
    fleetsData,
    project,
    settingsSection,
  ]);

  const focusFleetPicker = useCallback(() => {
    window.setTimeout(() => {
      const selector = fleetSelectorRef.current?.querySelector<HTMLElement>(
        '[data-fleet-picker-trigger="true"]',
      );
      if (selector?.offsetParent !== null) {
        selector?.focus();
      } else {
        mobileMenuButtonRef.current?.focus();
      }
    }, 0);
  }, []);

  const closeCreateFleet = useCallback(() => {
    setCreateFleetOpen(false);
    focusFleetPicker();
  }, [focusFleetPicker]);

  const closeRenameFleet = useCallback(() => {
    setRenameFleetTarget(null);
    focusFleetPicker();
  }, [focusFleetPicker]);

  const closeDeleteFleet = useCallback(() => {
    setDeleteFleetTarget(null);
    focusFleetPicker();
  }, [focusFleetPicker]);

  const handleFleetCreated = useCallback(async (fleet: FleetInstance) => {
    const nextFleets = await getFleets();
    setFleetsData(nextFleets);
    if (await switchFleet(fleet.id, nextFleets)) {
      closeCreateFleet();
    }
  }, [closeCreateFleet, switchFleet]);

  const handleFleetRenamed = useCallback(async () => {
    setFleetsData(await getFleets());
    closeRenameFleet();
  }, [closeRenameFleet]);

  const handleFleetDeleted = useCallback(async (nextFleets: FleetsData) => {
    const deletedFleetId = deleteFleetTarget?.id;
    setFleetsData(nextFleets);
    if (deletedFleetId === activeFleetId) {
      const nextFleetId =
        nextFleets.defaultFleetId
        || nextFleets.fleets.find((fleet) => fleet.available)?.id;
      if (!nextFleetId) {
        throw new Error("No available fleet remains after deletion.");
      }
      if (!(await switchFleet(nextFleetId, nextFleets))) return;
    }
    closeDeleteFleet();
  }, [
    activeFleetId,
    closeDeleteFleet,
    deleteFleetTarget?.id,
    switchFleet,
  ]);

  const authenticated = hasAuthenticatedAccount(auth);

  useEffect(() => {
    if (initialAuthenticationStartedRef.current) return;
    initialAuthenticationStartedRef.current = true;
    const initialMetadata = window.setTimeout(() => {
      void completeAuthentication().catch((authError) => {
        runUiTransition(() => {
          setAuth({
            available: false,
            accounts: [],
            error:
              authError instanceof Error
                ? authError.message
                : String(authError),
          });
          setLoading(false);
        });
      });
    }, 0);
    return () => window.clearTimeout(initialMetadata);
  }, [completeAuthentication]);

  useEffect(() => {
    if (!authenticated || accountOpen) return;
    const refreshVisibleDashboard = () => {
      if (document.visibilityState === "visible") void refreshTelemetry();
    };
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed && document.visibilityState === "visible") {
        void refreshTelemetry(true);
      }
    });
    const timer = window.setInterval(refreshVisibleDashboard, refreshInterval);
    document.addEventListener("visibilitychange", refreshVisibleDashboard);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisibleDashboard);
      telemetryRequest.current += 1;
      telemetryAbortRef.current?.abort();
    };
  }, [accountOpen, authenticated, refreshInterval, refreshTelemetry]);

  useEffect(() => {
    if (!authenticated || activeFleetId || loading || accountOpen) return;
    let pending = false;
    const timer = window.setInterval(async () => {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        await getAuthStatus();
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : String(authError));
      } finally {
        pending = false;
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [accountOpen, activeFleetId, authenticated, loading]);

  useEffect(() => {
    if (!authenticated || !activeFleetId) return;
    let active = true;
    const refresh = async () => {
      try {
        const { job } = await getCurrentSmokeSuite(activeFleetId);
        if (!active) return;
        setSmokeSuiteJob(job);
        if (
          job
          && job.status !== "running"
          && smokeSuiteStatusRef.current === "running"
        ) {
          void refreshTelemetry();
        }
        smokeSuiteStatusRef.current = job?.status || null;
      } catch {
        if (active) setSmokeSuiteJob(null);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeFleetId, authenticated, refreshTelemetry]);

  useEffect(() => {
    if (!dashboard || !animateSummaryMetrics) return;
    const timer = window.setTimeout(
      () => setAnimateSummaryMetrics(false),
      1_500,
    );
    return () => window.clearTimeout(timer);
  }, [animateSummaryMetrics, dashboard]);

  useEffect(() => {
    window.localStorage.setItem(telemetryRangeStorageKey, String(days));
  }, [days]);

  useEffect(() => {
    window.localStorage.setItem(refreshIntervalStorageKey, String(refreshInterval));
  }, [refreshInterval]);

  useEffect(() => {
    window.localStorage.setItem(
      "design-fleet.sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1180px)");
    const updateNavigationMode = () => {
      setCompactNavigation(query.matches);
      if (!query.matches) setMobileNavigationOpen(false);
    };
    query.addEventListener("change", updateNavigationMode);
    return () => query.removeEventListener("change", updateNavigationMode);
  }, []);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), [role="combobox"]:not([aria-disabled="true"])';
    const drawer = sidebarRef.current;
    const menuButton = mobileMenuButtonRef.current;
    const initialFocus = window.requestAnimationFrame(() => {
      drawer
        ?.querySelector<HTMLElement>('.nav-button[aria-current="page"]')
        ?.focus();
    });
    const containFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", containFocus);
    return () => {
      window.cancelAnimationFrame(initialFocus);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", containFocus);
      window.setTimeout(() => menuButton?.focus(), 0);
    };
  }, [mobileNavigationOpen]);

  useEffect(() => {
    window.localStorage.setItem(
      accountStorageKey(hiddenProjectsStorageKey),
      JSON.stringify(hiddenProjects),
    );
  }, [hiddenProjects]);

  useEffect(() => {
    window.localStorage.setItem(
      accountStorageKey(clearedActivityStorageKey),
      JSON.stringify(clearedActivity),
    );
  }, [clearedActivity]);

  useEffect(() => {
    if (!projectSearchOpen) return;
    projectSearchInputRef.current?.focus();
  }, [projectSearchOpen]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyMode = () => {
      const nextResolved =
        appearanceMode === "system"
          ? media.matches
            ? "dark"
            : "light"
          : appearanceMode;
      window.localStorage.setItem(
        "design-fleet:appearance:v1",
        JSON.stringify({
          mode: appearanceMode,
          palette: appearancePalette,
        }),
      );
      document.documentElement.dataset.themeMode = appearanceMode;
      document.documentElement.dataset.theme = nextResolved;
      document.documentElement.dataset.palette = appearancePalette;
      document.documentElement.style.colorScheme = nextResolved;
      setResolvedMode(nextResolved);
      window.dispatchEvent(
        new CustomEvent("design-fleet:theme-change", {
          detail: {
            resolvedMode: nextResolved,
            palette: appearancePalette,
          },
        }),
      );
    };
    applyMode();
    if (appearanceMode !== "system") return;
    media.addEventListener("change", applyMode);
    return () => media.removeEventListener("change", applyMode);
  }, [appearanceMode, appearancePalette]);

  const selectedProject = useMemo(
    () =>
      dashboard?.projects.find((candidate) => candidate.repository === project) ||
      null,
    [dashboard, project],
  );
  const visibleProjects = useMemo(
    () => filterVisibleProjects(dashboard?.projects || [], hiddenProjects),
    [dashboard, hiddenProjects],
  );
  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) return visibleProjects;
    return visibleProjects.filter((candidate) =>
      candidate.repository.toLowerCase().includes(query),
    );
  }, [projectSearch, visibleProjects]);
  const visibleHandoffs = useMemo(
    () => filterProjectItems(dashboard?.handoffs || [], visibleProjects),
    [dashboard, visibleProjects],
  );
  const visibleActivity = useMemo(
    () => filterClearedActivity(
      filterProjectItems(dashboard?.activity || [], visibleProjects),
      clearedActivity,
    ),
    [clearedActivity, dashboard, visibleProjects],
  );
  const visibleProcesses = useMemo(
    () => filterProjectItems(dashboard?.processes || [], visibleProjects),
    [dashboard, visibleProjects],
  );
  const activeProjects = useMemo(
    () => filteredProjects.filter(projectIsActive),
    [filteredProjects],
  );
  const inactiveProjects = useMemo(
    () => filteredProjects.filter((candidate) => !projectIsActive(candidate)),
    [filteredProjects],
  );
  const stationFamilies = useMemo(
    () =>
      Array.from(
        new Set((dashboard?.stations || []).map((station) => station.family)),
      ).sort((left, right) => left.localeCompare(right)),
    [dashboard],
  );
  const filteredStations = useMemo(() => {
    const source = dashboard?.stations || [];
    const query = stationSearch.trim().toLowerCase();
    const fleetOrder = new Map(
      source.map((station, index) => [station.id, index]),
    );
    const visible = source.filter((station) => {
      if (
        query
        && !`${station.display} ${station.title} ${station.purpose} ${station.model} ${station.family}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      if (stationFamily !== "all" && station.family !== stationFamily) {
        return false;
      }
      if (stationHealth === "issues") {
        if (station.status === "healthy") return false;
      } else if (
        stationHealth !== "all"
        && station.status !== stationHealth
      ) {
        return false;
      }
      return true;
    });

    const value = (station: StationSummary): string | number => {
      switch (stationSort) {
        case "name":
          return station.display;
        case "model":
          return station.model;
        case "family":
          return station.family;
        case "health":
          return healthRank[station.status];
        case "cost":
          return station.aiu;
        case "runs":
          return station.runs;
        case "success":
          return station.successRate ?? -1;
        case "latency":
          return station.averageTtftMs ?? Number.MAX_SAFE_INTEGER;
        case "recent":
          return station.lastRun ? new Date(station.lastRun).getTime() : 0;
        default:
          return fleetOrder.get(station.id) ?? 0;
      }
    };

    return visible.sort((left, right) => {
      const leftValue = value(left);
      const rightValue = value(right);
      const comparison =
        typeof leftValue === "string" && typeof rightValue === "string"
          ? leftValue.localeCompare(rightValue)
          : Number(leftValue) - Number(rightValue);
      return stationSortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    dashboard,
    stationFamily,
    stationHealth,
    stationSearch,
    stationSort,
    stationSortDirection,
  ]);
  const stationFiltersActive =
    stationSearch !== ""
    || stationFamily !== "all"
    || stationHealth !== "all"
    || stationSort !== "fleet"
    || stationSortDirection !== "asc";
  const visibleModels = useMemo(
    () =>
      (dashboard?.models || []).filter(
        (model) =>
          showUnusedModels || model.calls > 0 || model.stations.length > 0,
      ),
    [dashboard, showUnusedModels],
  );
  const unusedModelCount = (dashboard?.models.length || 0) - visibleModels.length;
  const canLaunchAgents =
    activeProvider?.capabilities.commandLaunch === true;
  const canRunSmokeSuite =
    activeProvider?.capabilities.smokeSuite === true;
  const canManageCrews =
    activeProvider?.capabilities.crewManagement === true;
  const canOverrideModels =
    activeProvider?.capabilities.modelOverrides === true;
  const activeBranchCount = new Set(
    visibleProjects.flatMap((candidate) => candidate.activeBranches),
  ).size;

  const activeAccount = auth?.accounts.find(
    (account) => account.active && account.state === "success",
  );
  const activeAccountLabel =
    activeAccount?.name || activeAccount?.login || "Connect GitHub";
  const activeAccountDetail = activeAccount
    ? activeAccount.name
      ? `@${activeAccount.login}`
      : "Signed in"
    : "Personal or EMU account";
  const healthTone =
    dashboard?.summary.downStations
      ? "danger"
      : dashboard?.summary.warningStations
        ? "warning"
        : "success";

  const closeAccount = useCallback(() => {
    setAccountOpen(false);
    window.setTimeout(() => accountButtonRef.current?.focus(), 0);
  }, []);

  const closeCommand = useCallback(() => {
    setCommandOpen(false);
    setCommandPreset(null);
    window.setTimeout(() => commandButtonRef.current?.focus(), 0);
  }, []);

  const clearAccountView = useCallback(() => {
    clearAccountContext();
    telemetryRequest.current += 1;
    fleetRequest.current += 1;
    telemetryAbortRef.current?.abort();
    fleetAbortRef.current?.abort();
    fleetAbortRef.current = null;
    dashboardReadyRef.current = false;
    flushSync(() => {
      setFleetsData(null);
      setActiveFleetId("");
      setDashboard(null);
      setCrews(null);
      setSmokeSuiteJob(null);
      setSmokeSuiteOpen(false);
      setCommandOpen(false);
      setCommandPreset(null);
      setCreateFleetOpen(false);
      setRenameFleetTarget(null);
      setDeleteFleetTarget(null);
      setModelActionMessage(null);
      setProject("all");
      setProjectSearch("");
      setHiddenProjects([]);
      setClearedActivity({ all: null, projects: {} });
      setView("overview");
      setLoading(true);
      setError(null);
    });
  }, []);

  const handleAuthChange = useCallback(() => {
    clearAccountView();
    window.location.reload();
  }, [clearAccountView]);

  useEffect(() => {
    const reloadAccount = () => {
      clearAccountView();
      window.location.reload();
    };
    window.addEventListener("design-fleet-account-changed", reloadAccount);
    return () => window.removeEventListener("design-fleet-account-changed", reloadAccount);
  }, [clearAccountView]);

  const navigateToView = useCallback((nextView: DashboardView) => {
    runUiTransition(() => {
      setView(nextView);
      if (compactNavigation) setMobileNavigationOpen(false);
    });
  }, [compactNavigation]);

  const closeMobileNavigation = useCallback(() => {
    setMobileNavigationOpen(false);
  }, []);

  const changeSettingsSection = useCallback((section: SettingsSection) => {
    runUiTransition(() => setSettingsSection(section));
  }, []);

  function runModelSmokeTest(model: ModelSummary) {
    if (!canRunSmokeSuite) {
      setModelActionMessage(
        `${activeProvider?.displayName || "This provider"} does not support smoke tests.`,
      );
      return;
    }
    const station =
      dashboard?.stations.find((candidate) =>
        model.stations.includes(candidate.display),
      )
      || dashboard?.stations.find((candidate) => candidate.id === "contrarian")
      || dashboard?.stations[0];
    if (!station) return;
    openStationSmokeTest(station, model.model);
  }

  function openStationSmokeTest(
    station: StationSummary,
    model = station.model,
  ) {
    if (!canRunSmokeSuite || !canLaunchAgents) return;
    setCommandPreset({
      kind: "smoke",
      stationId: station.id,
      model,
      prompt:
        "Run a minimal no-write smoke test. Confirm that this model can start the selected station and produce a short response. Do not modify files.",
    });
    setCommandOpen(true);
  }

  function handoffTask(task: HandoffTask, station: StationSummary) {
    if (!canLaunchAgents) return;
    const stationNames = new Map(
      (dashboard?.stations || []).map((candidate) => [
        candidate.id,
        candidate.display,
      ]),
    );
    const trail = task.history
      .map((step) => stationNames.get(step.station) || step.station)
      .join(" -> ");
    const source = stationNames.get(task.currentStation) || task.currentStation;
    setCommandPreset({
      action: "handoff",
      project: task.project,
      stationId: station.id,
      model: station.model,
      taskId: task.id,
      taskTitle: task.title,
      prompt:
        `Continue the existing fleet task "${task.title}" in ${task.project}. `
        + `This is a handoff from ${source} to ${station.display}. `
        + "Inspect the current repository state, review the work already completed, "
        + `and perform the ${station.display} station's responsibilities. `
        + `Preserve valid existing work and report any blocker clearly. Observed trail: ${trail}.`,
    });
    setCommandOpen(true);
  }

  function retryTask(task: HandoffTask) {
    if (!canLaunchAgents) return;
    const station = dashboard?.stations.find(
      (candidate) => candidate.id === task.currentStation,
    );
    if (!station) return;
    const previousModel = task.history.at(-1)?.model;
    setCommandPreset({
      action: "retry",
      project: task.project,
      stationId: station.id,
      model: previousModel || station.model,
      taskId: task.id,
      taskTitle: task.title,
      prompt:
        `Retry the failed fleet task "${task.title}" in ${task.project}. `
        + `The previous ${station.display} attempt did not complete successfully. `
        + "Inspect the current repository state and the prior work, determine what "
        + `blocked the attempt, then resume the ${station.display} station's responsibilities. `
        + "Do not discard valid existing work, and report any remaining blocker clearly.",
    });
    setCommandOpen(true);
  }

  function openModelSettings(station?: StationSummary) {
    if (!canManageCrews) return;
    runUiTransition(() => {
      setFocusedStationId(station?.id || null);
      setSettingsSection("agents");
      setView("settings");
    });
  }

  function copyModelId(model: string) {
    void navigator.clipboard.writeText(model).then(
      () => setModelActionMessage(`Copied ${model}`),
      () => setModelActionMessage(`Could not copy ${model}`),
    );
  }

  function clearActivity(scope: string) {
    const clearedAt = new Date().toISOString();
    setClearedActivity((current) =>
      scope === "all"
        ? { ...current, all: clearedAt }
        : {
            ...current,
            projects: {
              ...current.projects,
              [scope]: clearedAt,
            },
          },
    );
  }

  const selectProject = useCallback((repository: string) => {
    runUiTransition(() => {
      setProject(repository);
      if (compactNavigation) setMobileNavigationOpen(false);
    });
  }, [compactNavigation]);

  const hideProject = useCallback((repository: string) => {
    setHiddenProjects((current) =>
      current.some((candidate) => projectKey(candidate) === projectKey(repository))
        ? current : [...current, repository],
    );
    if (projectKey(project) === projectKey(repository)) selectProject("all");
  }, [project, selectProject]);

  const showProject = useCallback((repository: string) => {
    setHiddenProjects((current) =>
      current.filter(
        (candidate) => projectKey(candidate) !== projectKey(repository),
      ),
    );
  }, []);

  function toggleProjectSearch() {
    setProjectSearchOpen((current) => {
      if (current) setProjectSearch("");
      return !current;
    });
  }

  if (!authenticated) {
    return (
      <AuthenticationGate
        auth={auth}
        onAuthenticated={completeAuthentication}
      />
    );
  }

  return (
    <div
      className={`app-shell ${
        sidebarCollapsed && !compactNavigation ? "sidebar-collapsed" : ""
      } ${mobileNavigationOpen ? "mobile-navigation-open" : ""}`}
    >
      <aside
        className="sidebar"
        aria-label="Fleet dashboard navigation"
        ref={sidebarRef}
      >
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            <img src="/icon-24.svg" alt="" />
          </span>
          <div className="brand-copy">
            <Title2 as="h1">Fleet dashboard</Title2>
          </div>
          <Button
            appearance="subtle"
            className="collapse-button desktop-collapse-button"
            type="button"
            icon={
              <span className="sidebar-toggle-icons" aria-hidden="true">
                <PanelLeft24Regular className="sidebar-toggle-regular" />
                <PanelLeft24Filled className="sidebar-toggle-filled" />
              </span>
            }
            aria-label={
              sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
            }
            title={
              sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
            }
            onClick={() => {
              setSidebarCollapsed((current) => !current);
            }}
          />
          <Button
            appearance="subtle"
            className="collapse-button mobile-menu-button"
            type="button"
            icon={
              mobileNavigationOpen ? (
                <Dismiss24Regular aria-hidden="true" />
              ) : (
                <Navigation24Regular aria-hidden="true" />
              )
            }
            aria-label={
              mobileNavigationOpen ? "Close navigation menu" : "Open navigation menu"
            }
            title={
              mobileNavigationOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={mobileNavigationOpen}
            aria-controls="fleet-navigation-content"
            ref={mobileMenuButtonRef}
            onClick={() => setMobileNavigationOpen((current) => !current)}
          />
        </div>
        <div className="sidebar-scroll" id="fleet-navigation-content">
          <section className="fleet-nav-section" aria-label="Fleet">
            <p className="nav-label">Fleet</p>
            <div className="fleet-selector" ref={fleetSelectorRef}>
              <div className="fleet-selector-control">
                <FleetPicker
                  fleets={fleetsData?.fleets || []}
                  providers={fleetsData?.providers || []}
                  value={activeFleetId}
                  disabled={!activeFleetId || loading}
                  onValueChange={(value) => void switchFleet(value)}
                  onCreate={() => setCreateFleetOpen(true)}
                  onRename={setRenameFleetTarget}
                  onDelete={setDeleteFleetTarget}
                />
              </div>
            </div>
            {fleetsData?.providerErrors.length ? (
              <small
                className="fleet-provider-warning"
                role="status"
                title={fleetsData.providerErrors
                  .map((providerError) =>
                    `${providerError.root}: ${providerError.error}`
                  )
                  .join("\n")}
              >
                {fleetsData.providerErrors.length} provider manifest
                {fleetsData.providerErrors.length === 1 ? "" : "s"} unavailable
              </small>
            ) : null}
          </section>
          <nav aria-label="Dashboard views">
            <p className="nav-label">Views</p>
            <Button
              appearance="subtle"
              className={`nav-button ${view === "overview" ? "selected" : ""}`}
              type="button"
              icon={<AppsListDetail24Regular aria-hidden="true" />}
              aria-label="Overview"
              title="Overview"
              onClick={() => navigateToView("overview")}
              aria-current={view === "overview" ? "page" : undefined}
            >
              <span className="nav-text">Overview</span>
            </Button>
            <Button
              appearance="subtle"
              className={`nav-button ${view === "handoffs" ? "selected" : ""}`}
              type="button"
              icon={<Board24Regular aria-hidden="true" />}
              aria-label="Board"
              title="Board"
              onClick={() => navigateToView("handoffs")}
              aria-current={view === "handoffs" ? "page" : undefined}
            >
              <span className="nav-text">Board</span>
            </Button>
            <Button
              appearance="subtle"
              className={`nav-button ${
                view === "activity" ? "selected" : ""
              }`}
              type="button"
              icon={<History24Regular aria-hidden="true" />}
              aria-label="Activity"
              title="Activity"
              onClick={() => navigateToView("activity")}
              aria-current={view === "activity" ? "page" : undefined}
            >
              <span className="nav-text">Activity</span>
            </Button>
            <Button
              appearance="subtle"
              className={`nav-button ${view === "pipeline" ? "selected" : ""}`}
              type="button"
              icon={<Flowchart24Regular aria-hidden="true" />}
              aria-label="Pipeline"
              title="Pipeline"
              onClick={() => navigateToView("pipeline")}
              aria-current={view === "pipeline" ? "page" : undefined}
            >
              <span className="nav-text">Pipeline</span>
            </Button>
            <Button
              appearance="subtle"
              className={`nav-button ${view === "settings" ? "selected" : ""}`}
              type="button"
              onClick={() => navigateToView("settings")}
              icon={<Settings24Regular aria-hidden="true" />}
              aria-label="Settings"
              title="Settings"
              aria-current={view === "settings" ? "page" : undefined}
            >
              <span className="nav-text">Settings</span>
            </Button>
          </nav>

          <div className="projects-nav">
            <div className="project-heading">
              <p className="nav-label">Projects</p>
              <Button
                appearance="subtle"
                className="project-search-toggle"
                type="button"
                icon={
                  projectSearchOpen
                    ? <Dismiss24Regular aria-hidden="true" />
                    : <Search24Regular aria-hidden="true" />
                }
                onClick={toggleProjectSearch}
                aria-label={
                  projectSearchOpen
                    ? "Close project search"
                    : "Search projects"
                }
                aria-expanded={projectSearchOpen}
                title={
                  projectSearchOpen
                    ? "Close project search"
                    : "Search projects"
                }
              />
            </div>
            {projectSearchOpen ? (
              <Input
                ref={projectSearchInputRef}
                className="project-search"
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") toggleProjectSearch();
                }}
                contentBefore={<Search24Regular aria-hidden="true" />}
                placeholder="Search projects"
                aria-label="Search projects"
              />
            ) : null}
            <Button
              appearance="subtle"
              className={`project-button ${project === "all" ? "selected" : ""}`}
              type="button"
              onClick={() => selectProject("all")}
              aria-pressed={project === "all"}
              aria-label={`All projects, ${visibleProjects.length} repositories`}
              title="All projects"
            >
              <span className="project-icon" aria-hidden="true">
                <DataUsage24Regular />
              </span>
              <span className="project-copy">
                <span className="project-name">All projects</span>
                <span>{visibleProjects.length} repositories</span>
              </span>
            </Button>
            {activeProjects.length ? (
              <>
                <p className="project-group-label">
                  Active
                </p>
                {activeProjects.map((candidate) => (
                  <ProjectButton
                    project={candidate}
                    selected={project === candidate.repository}
                    onSelect={() => selectProject(candidate.repository)}
                    onRemove={() => hideProject(candidate.repository)}
                    key={candidate.repository}
                  />
                ))}
              </>
            ) : null}
            {inactiveProjects.length ? (
              <>
                <p className="project-group-label">
                  Inactive
                </p>
                {inactiveProjects.map((candidate) => (
                  <ProjectButton
                    project={candidate}
                    selected={project === candidate.repository}
                    onSelect={() => selectProject(candidate.repository)}
                    onRemove={() => hideProject(candidate.repository)}
                    key={candidate.repository}
                  />
                ))}
              </>
            ) : null}
            {projectSearch.trim()
            && !activeProjects.length
            && !inactiveProjects.length ? (
              <p className="project-search-empty">No matching projects</p>
            ) : null}
          </div>
        </div>
        <div className="sidebar-account-divider" aria-hidden="true" />
        <Button
          appearance="subtle"
          className="account-button sidebar-account"
          type="button"
          onClick={() => setAccountOpen(true)}
          ref={accountButtonRef}
          aria-label={`${activeAccountLabel}, ${activeAccountDetail}`}
          title={activeAccountLabel}
        >
          <span className="account-button-icon" aria-hidden="true">
            {activeAccount?.avatarUrl ? (
              <img src={activeAccount.avatarUrl} alt="" />
            ) : (
              <Person24Regular />
            )}
          </span>
          <span className="account-copy">
            <strong>{activeAccountLabel}</strong>
            <small>{activeAccountDetail}</small>
          </span>
        </Button>
      </aside>
      {mobileNavigationOpen ? (
        <button
          className="mobile-navigation-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={closeMobileNavigation}
        />
      ) : null}

      <div className="content-shell" inert={mobileNavigationOpen || undefined}>
        <main
          className={`main-content ${
            view === "pipeline" ? "main-content-pipeline" : ""
          } ${view === "handoffs" ? "main-content-handoffs" : ""}`}
        >
          {view === "pipeline" ? (
            <svg className="pipeline-page-grid" aria-hidden="true">
              <defs>
                <pattern
                  id="pipeline-page-grid-pattern"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r="1" />
                </pattern>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="url(#pipeline-page-grid-pattern)"
              />
            </svg>
          ) : null}
          {error ? (
            <div className="notice notice-failed dashboard-error" role="alert">
              <span>{error}</span>
              <Button
                appearance="secondary"
                className="secondary-button"
                type="button"
                onClick={() => void refreshTelemetry(true)}
              >
                Try again
              </Button>
            </div>
          ) : null}
          {dashboard && loading && view !== "overview" ? (
            <p className="dashboard-refresh-status" role="status">
              Updating the last {days} {days === 1 ? "day" : "days"} of activity...
            </p>
          ) : null}
          {!dashboard && loading ? (
            <DashboardSkeleton />
          ) : fleetsData && !fleetsData.fleets.length ? (
            <Card className="empty-state" role="status">
              <h2>No fleet for this account</h2>
              <p>{fleetsData.emptyReason || "Install and configure a fleet for the active account to see its agents and projects."}</p>
              <Button appearance="primary" onClick={() => setAccountOpen(true)}>
                Switch account
              </Button>
            </Card>
          ) : view === "pipeline" ? (
            <PipelineView stations={dashboard?.stations || []} />
          ) : view === "handoffs" ? (
            <HandoffBoard
              stations={dashboard?.stations || []}
              tasks={visibleHandoffs}
              projects={visibleProjects}
              project={project}
              actionsEnabled={canLaunchAgents}
              refreshInterval={refreshInterval}
              onHandoff={handoffTask}
              onRetry={retryTask}
            />
          ) : view === "activity" ? (
            <ActivityView
              activity={visibleActivity}
              project={project}
              onClear={clearActivity}
            />
          ) : view === "settings" ? (
            <SettingsView
              key={activeFleetId}
              fleetId={activeFleetId}
              section={settingsSection}
              refreshInterval={refreshInterval}
              onRefreshIntervalChange={setRefreshInterval}
              focusedStationId={focusedStationId}
              mode={appearanceMode}
              resolvedMode={resolvedMode}
              onModeChange={setAppearanceMode}
              crews={crews}
              stations={dashboard?.stations || []}
              projects={dashboard?.projects || []}
              hiddenProjects={hiddenProjects}
              onCrewsSaved={handleCrewsSaved}
              onHideProject={hideProject}
              onShowProject={showProject}
              onSectionChange={changeSettingsSection}
              canManageCrews={canManageCrews}
              canOverrideModels={canOverrideModels}
            />
          ) : (
            <div className="overview-view view-enter">
          <header className="page-heading overview-heading">
            <div className="overview-heading-copy">
              <Title1 as="h2">
                {project === "all" ? "All fleet activity" : project}
              </Title1>
              <p className="overview-subtitle" role="status" aria-live="polite" aria-atomic="true">
                <span className="overview-subtitle-description" aria-hidden={loading}>
                  {selectedProject
                    ? `${selectedProject.runs} runs, ${selectedProject.calls} model calls, ${formatCredits(selectedProject.aiu)} credits (${formatDollars(selectedProject.aiu)} equivalent) in the selected range.`
                    : "Health, activity, delivery, and model signals from local Copilot telemetry."}
                </span>
                <span className="overview-subtitle-loading" aria-hidden={!loading}>
                  Updating the last {days} {days === 1 ? "day" : "days"} of activity...
                </span>
              </p>
            </div>
            <div className="overview-heading-tools">
              <div className="topbar-actions">
                <Button
                  appearance="primary"
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setCommandPreset(null);
                    setCommandOpen(true);
                  }}
                  icon={<Play24Regular aria-hidden="true" />}
                  ref={commandButtonRef}
                  disabled={
                    !canLaunchAgents
                    || !dashboard?.stations.length
                    || !dashboard?.projects.length
                  }
                  title={
                    canLaunchAgents
                      ? "Run a fleet agent"
                      : "This provider does not support dashboard agent launches"
                  }
                >
                  Run agent
                </Button>
                <div className="range-picker">
                  <span>Range</span>
                  <Dropdown
                    className="range-select"
                    value={ranges.find((range) => range.value === days)?.label}
                    selectedOptions={[String(days)]}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue !== undefined) setDays(Number(data.optionValue));
                    }}
                    aria-label="Telemetry range"
                    inlinePopup
                    listbox={{ className: "searchable-select-listbox" }}
                    clearable={false}
                  >
                    {ranges.map((range) => (
                      <Option key={range.value} value={String(range.value)}>
                        {range.label}
                      </Option>
                    ))}
                  </Dropdown>
                </div>
              </div>
              <div className="live-state">
                <span className="live-dot" aria-hidden="true" />
                Auto-refreshing every {refreshInterval / 1000} seconds
              </div>
            </div>
          </header>

          <section className="metrics-grid" aria-label="Fleet summary">
            <MetricCard
              label="Fleet health"
              value={
                dashboard
                  ? `${dashboard.summary.healthyStations}/${dashboard.summary.stationCount}`
                  : "-"
              }
              detail={`${dashboard?.summary.downStations || 0} down · ${
                dashboard?.summary.warningStations || 0
              } need a test`}
              tone={healthTone}
              animate={animateSummaryMetrics}
              animationDelay={0}
            />
            <MetricCard
              label="Active sessions"
              value={dashboard?.summary.activeSessions ?? "-"}
              detail={`${dashboard?.summary.activeProcesses || 0} attributed fleet ${
                dashboard?.summary.activeProcesses === 1
                  ? "process"
                  : "processes"
              } · ${activeBranchCount} active ${
                activeBranchCount === 1 ? "branch" : "branches"
              }`}
              tone={
                dashboard?.processes.some((process) => process.status === "stalled")
                  ? "warning"
                  : "neutral"
              }
              animate={animateSummaryMetrics}
              animationDelay={90}
            />
            <MetricCard
              label="Last smoke test"
              value={
                dashboard?.smokeTest
                  ? `${dashboard.smokeTest.passed}/${dashboard.smokeTest.total}`
                  : "No test"
              }
              detail={
                dashboard?.smokeTest
                  ? `${dashboard.smokeTest.project} · ${relativeTime(
                      dashboard.smokeTest.startedAt,
                    )}`
                  : "No smoke-test task found in this range"
              }
              tone={
                dashboard?.smokeTest?.failed
                  ? "danger"
                  : dashboard?.smokeTest
                    ? "success"
                    : "warning"
              }
              animate={animateSummaryMetrics}
              animationDelay={180}
            />
            <MetricCard
              label="Herald delivery"
              value={dashboard?.summary.heraldPrs ?? "-"}
              detail="Pull requests created by Herald"
              animate={animateSummaryMetrics}
              animationDelay={270}
            />
            <MetricCard
              label="AI credit usage"
              value={formatCredits(dashboard?.summary.totalAiu || 0)}
              detail={`${formatDollars(
                dashboard?.summary.totalAiu || 0,
              )} consumption equivalent`}
              info="Dollar equivalents use $0.01 per AI credit. They show consumption, not the final invoice. Included enterprise or organization credit pools are applied before overage billing."
              animate={animateSummaryMetrics}
              animationDelay={360}
            />
          </section>

          <section className="section-block">
            <div className="section-heading station-heading-row">
              <div>
                <Title2 as="h2">What is working</Title2>
              </div>
              <div className="station-filter-bar" role="group" aria-label="Filter stations">
                <Input
                  className="station-search"
                  size="small"
                  value={stationSearch}
                  onChange={(event) => setStationSearch(event.target.value)}
                  placeholder="Search stations or models"
                  aria-label="Search stations"
                  contentBefore={<Search24Regular aria-hidden="true" />}
                />
                <SearchableSelect
                  size="small"
                  value={stationFamily}
                  onValueChange={(value) =>
                    runStationTransition(() => setStationFamily(value))
                  }
                  ariaLabel="Filter by model family"
                  inlinePopup={false}
                  searchPlaceholder="Search families"
                  options={[
                    { value: "all", label: "All families" },
                    ...stationFamilies.map((family) => ({
                      value: family,
                      label: family,
                    })),
                  ]}
                  clearable
                  clearValue="all"
                />
                <SearchableSelect
                  size="small"
                  value={stationHealth}
                  onValueChange={(value) =>
                    runStationTransition(() =>
                      setStationHealth(value as StationHealthFilter),
                    )
                  }
                  ariaLabel="Filter by health"
                  inlinePopup={false}
                  searchPlaceholder="Search health states"
                  options={[
                    { value: "all", label: "Health: All" },
                    { value: "healthy", label: "Healthy" },
                    { value: "issues", label: "Issues only" },
                    { value: "warning", label: "Needs attention" },
                    { value: "down", label: "Down" },
                    { value: "untested", label: "Not tested" },
                  ]}
                  clearable
                  clearValue="all"
                />
                <SearchableSelect
                  size="small"
                  value={stationSort}
                  onValueChange={(value) =>
                    runStationTransition(() =>
                      setStationSort(value as StationSortKey),
                    )
                  }
                  ariaLabel="Sort stations by"
                  inlinePopup={false}
                  searchPlaceholder="Search sort options"
                  options={stationSortOptions}
                  clearable
                  clearValue="fleet"
                />
                <Button
                  appearance="secondary"
                  className="secondary-button station-sort-direction"
                  type="button"
                  size="small"
                  icon={
                    stationSortDirection === "asc" ? (
                      <ArrowSortUp24Regular aria-hidden="true" />
                    ) : (
                      <ArrowSortDown24Regular aria-hidden="true" />
                    )
                  }
                  onClick={() =>
                    runStationTransition(() =>
                      setStationSortDirection((current) =>
                        current === "asc" ? "desc" : "asc",
                      ),
                    )
                  }
                  aria-label={`Sort ${
                    stationSortDirection === "asc" ? "descending" : "ascending"
                  }`}
                  title={
                    stationSortDirection === "asc"
                      ? "Currently ascending; switch to descending"
                      : "Currently descending; switch to ascending"
                  }
                />
                <Button
                  appearance="subtle"
                  className="station-filter-reset"
                  type="button"
                  size="small"
                  icon={
                    stationFiltersActive ? (
                      <Dismiss16Regular aria-hidden="true" />
                    ) : (
                      <Filter24Regular aria-hidden="true" />
                    )
                  }
                  disabled={!stationFiltersActive}
                  aria-label="Reset station filters"
                  title="Reset station filters"
                  onClick={() => {
                    runStationTransition(() => {
                      setStationSearch("");
                      setStationFamily("all");
                      setStationHealth("all");
                      setStationSort("fleet");
                      setStationSortDirection("asc");
                    });
                  }}
                />
              </div>
            </div>
            <div className="station-filter-summary" aria-live="polite">
              Showing {filteredStations.length} of{" "}
              {dashboard?.stations.length || 0} stations
            </div>
            {filteredStations.length ? (
              <StationMasonryGrid
                stations={filteredStations}
                smokeEnabled={canRunSmokeSuite && canLaunchAgents}
                crewConfigurationEnabled={canManageCrews}
                modelOverridesEnabled={canOverrideModels}
                onSmokeTest={openStationSmokeTest}
                onConfigureModel={openModelSettings}
                onCopyModel={copyModelId}
              />
            ) : (
              <div className="station-grid">
                <Card appearance="filled" className="station-filter-empty">
                  <Filter24Regular aria-hidden="true" />
                  <strong>No stations match these filters</strong>
                  <span>Reset the filters or broaden the search.</span>
                  <Button
                    appearance="secondary"
                    className="secondary-button"
                    onClick={() => {
                      runStationTransition(() => {
                        setStationSearch("");
                        setStationFamily("all");
                        setStationHealth("all");
                        setStationSort("fleet");
                        setStationSortDirection("asc");
                      });
                    }}
                  >
                    Reset filters
                  </Button>
                </Card>
              </div>
            )}
          </section>

          <div className="two-column">
            <Card appearance="filled" role="region" className="panel">
              <div className="panel-heading">
                <div>
                  <Title2 as="h2">Fleet processes in motion</Title2>
                </div>
                <Clock16Regular aria-hidden="true" />
              </div>
              <ProcessList
                processes={visibleProcesses}
                emptyMessage="No active run is currently attributed to a fleet station. Active top-level Copilot sessions may still be running."
              />
            </Card>

            <Card appearance="filled" role="region" className="panel">
              <div className="panel-heading">
                <div>
                  <Title2 as="h2">Latest smoke test</Title2>
                </div>
                <Pulse24Regular aria-hidden="true" />
              </div>
              {dashboard?.smokeTest ? (
                <>
                  <div className="smoke-summary">
                    <div>
                      <strong>
                        {dashboard.smokeTest.passed}/{dashboard.smokeTest.total}
                      </strong>
                      <span>stations passed</span>
                    </div>
                    <div className="smoke-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${
                            (dashboard.smokeTest.passed /
                              dashboard.smokeTest.total) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="smoke-list">
                    {dashboard.smokeTest.stations.map((station) => (
                      <div className="smoke-row" key={station.station}>
                        <StatusBadge status={station.status} />
                        <strong>{station.station}</strong>
                        <span>{station.model || "Model not recorded"}</span>
                        <small>{station.calls} calls</small>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <Warning16Filled aria-hidden="true" />
                  <p>No smoke-test task was found for this project and range.</p>
                </div>
              )}
            </Card>
          </div>

          <section className="section-block">
            <div className="section-heading">
              <div className="model-heading-title">
                <Title2 as="h2">Model health and responsiveness</Title2>
                <Tooltip
                  content="Run one minimal availability check for every configured fleet model."
                  relationship="description"
                >
                  <Button
                    appearance="subtle"
                    className={`model-smoke-button ${
                      smokeSuiteJob?.status === "running" ? "is-running" : ""
                    }`}
                    type="button"
                    icon={<Pulse24Regular aria-hidden="true" />}
                    onClick={() => setSmokeSuiteOpen(true)}
                    disabled={!canRunSmokeSuite || !canLaunchAgents}
                    aria-label={
                      smokeSuiteJob?.status === "running"
                        ? `View model smoke suite, ${
                            smokeSuiteJob.completed + smokeSuiteJob.failed
                          } of ${smokeSuiteJob.total} tested`
                        : "Run model smoke suite"
                    }
                  />
                </Tooltip>
              </div>
              <div className="model-section-actions">
                <span className="section-note">
                  Completion and latency come from local Copilot usage.
                </span>
                <Checkbox
                  checked={showUnusedModels}
                  onChange={(_, data) =>
                    setShowUnusedModels(data.checked === true)
                  }
                  label={
                    unusedModelCount
                      ? `Show ${unusedModelCount} unused models`
                      : "Show unused models"
                  }
                  disabled={unusedModelCount === 0 && !showUnusedModels}
                />
              </div>
            </div>
            {modelActionMessage ? (
              <div className="model-action-message" role="status">
                {modelActionMessage}
              </div>
            ) : null}
            <Card appearance="filled" className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Model</th>
                    <th scope="col">Status</th>
                    <th scope="col">Stations</th>
                    <th scope="col">Calls</th>
                    <th scope="col">Credits</th>
                    <th scope="col">$ equivalent</th>
                    <th scope="col">Completion</th>
                    <th scope="col">Avg. first token</th>
                    <th scope="col">Last call</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleModels.map((model) => (
                    <tr key={model.model}>
                      <th scope="row">{model.model}</th>
                      <td data-label="Status">
                        {smokeSuiteJob?.status === "running"
                        && smokeSuiteJob.targets.some(
                          (target) => target.model === model.model,
                        ) ? (
                          (() => {
                            const target = smokeSuiteJob.targets.find(
                              (candidate) => candidate.model === model.model,
                            );
                            if (!target) return null;
                            return (
                              <Tooltip
                                content={target.message}
                                relationship="description"
                              >
                                <Badge
                                  appearance="outline"
                                  color={
                                    target.status === "completed"
                                      ? "success"
                                      : target.status === "failed"
                                        ? "danger"
                                        : target.status === "running"
                                          ? "warning"
                                          : "subtle"
                                  }
                                  shape="rounded"
                                  size="medium"
                                  className={`status-badge smoke-status-${target.status}`}
                                  icon={
                                    target.status === "running"
                                      ? <Pulse24Regular aria-hidden="true" />
                                      : target.status === "completed"
                                        ? <CheckmarkCircle16Filled aria-hidden="true" />
                                        : target.status === "failed"
                                          ? <DismissCircle16Filled aria-hidden="true" />
                                          : <Clock16Regular aria-hidden="true" />
                                  }
                                >
                                  {target.status === "pending"
                                    ? "Queued"
                                    : target.status === "running"
                                      ? "Running"
                                      : target.status === "completed"
                                        ? "Passed"
                                        : "Failed"}
                                </Badge>
                              </Tooltip>
                            );
                          })()
                        ) : (
                          <Tooltip
                            content={model.statusReason}
                            relationship="description"
                          >
                            <span className="model-status-trigger">
                              <StatusBadge status={model.status} />
                            </span>
                          </Tooltip>
                        )}
                      </td>
                      <td data-label="Stations">
                        {model.stations.join(", ") || "Other activity"}
                      </td>
                      <td data-label="Calls">{model.calls.toLocaleString()}</td>
                      <td data-label="Credits">{formatCredits(model.aiu)}</td>
                      <td data-label="$ equivalent">{formatDollars(model.aiu)}</td>
                      <td data-label="Completion">
                        {model.completionRate === null
                          ? "No data"
                          : `${model.completionRate}%`}
                      </td>
                      <td data-label="Avg. first token">
                        {formatLatency(model.averageTtftMs)}
                      </td>
                      <td data-label="Last call">
                        {relativeTime(model.lastCall)}
                      </td>
                      <td
                        className="model-actions-cell"
                        data-label="Actions"
                      >
                        <Menu>
                          <MenuTrigger disableButtonEnhancement>
                            <Button
                              appearance="subtle"
                              size="small"
                              icon={
                                <MoreHorizontal24Regular aria-hidden="true" />
                              }
                              aria-label={`Actions for ${model.model}`}
                            />
                          </MenuTrigger>
                          <MenuPopover>
                            <MenuList>
                              <MenuItem
                                icon={<Pulse24Regular aria-hidden="true" />}
                                onClick={() => runModelSmokeTest(model)}
                                disabled={!canRunSmokeSuite || !canLaunchAgents}
                              >
                                Run smoke test
                              </MenuItem>
                              <MenuItem
                                icon={<Settings24Regular aria-hidden="true" />}
                                onClick={() => openModelSettings()}
                                disabled={!canManageCrews}
                              >
                                {canOverrideModels
                                  ? model.status === "down"
                                    || model.status === "warning"
                                    ? "Change affected station models"
                                    : "Configure station models"
                                  : "Configure station names"}
                              </MenuItem>
                              <MenuItem
                                icon={<Copy24Regular aria-hidden="true" />}
                                onClick={() => copyModelId(model.model)}
                              >
                                Copy model ID
                              </MenuItem>
                            </MenuList>
                          </MenuPopover>
                        </Menu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <footer className="data-footer">
            <span>
              <span
                className={`source-dot ${
                  dashboard?.sources.sessionStore ? "available" : "missing"
                }`}
              />
              Usage store
            </span>
            <span>
              <span
                className={`source-dot ${
                  dashboard?.sources.eventLogs ? "available" : "missing"
                }`}
              />
              Agent event logs
            </span>
            <span>
              <span
                className={`source-dot ${
                  dashboard?.sources.githubCli ? "available" : "missing"
                }`}
              />
              GitHub CLI
            </span>
            <span>
              Updated {relativeTime(dashboard?.generatedAt || null)}
            </span>
          </footer>
            </div>
          )}
        </main>
      </div>

      {accountOpen ? (
        <AccountDialog
          auth={auth}
          onClose={closeAccount}
          onRefresh={completeAuthentication}
          onAuthChange={handleAuthChange}
          onAccountChanging={clearAccountView}
        />
      ) : null}
      {commandOpen ? (
        <CommandDialog
          fleetId={activeFleetId}
          stations={dashboard?.stations || []}
          projects={visibleProjects}
          availableModels={crews?.availableModels || []}
          selectedProject={project}
          preset={commandPreset}
          onClose={closeCommand}
          onStarted={(job) => {
            if (job.kind === "smoke") {
              setModelActionMessage(
                `${job.model} smoke test is running in the background.`,
              );
              void refreshTelemetry();
            }
          }}
        />
      ) : null}
      {smokeSuiteOpen ? (
        <SmokeSuiteDialog
          fleetId={activeFleetId}
          stations={dashboard?.stations || []}
          projects={visibleProjects}
          selectedProject={project}
          onClose={() => setSmokeSuiteOpen(false)}
          onCompleted={() => void refreshTelemetry()}
          onStarted={(job) => {
            setSmokeSuiteJob(job);
            smokeSuiteStatusRef.current = job.status;
            setModelActionMessage(
              `Smoke suite is running in the background for ${job.total} configured models.`,
            );
          }}
        />
      ) : null}
      {createFleetOpen ? (
        <CreateFleetDialog
          providers={fleetsData?.providers || []}
          onClose={closeCreateFleet}
          onCreated={handleFleetCreated}
        />
      ) : null}
      {renameFleetTarget ? (
        <RenameFleetDialog
          fleet={renameFleetTarget}
          onClose={closeRenameFleet}
          onRenamed={handleFleetRenamed}
        />
      ) : null}
      {deleteFleetTarget ? (
        <DeleteFleetDialog
          fleet={deleteFleetTarget}
          onClose={closeDeleteFleet}
          onDeleted={handleFleetDeleted}
        />
      ) : null}
    </div>
  );
}
