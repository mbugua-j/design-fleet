export type HealthStatus =
  | "healthy"
  | "warning"
  | "stale"
  | "down"
  | "untested"
  | "unassigned"
  | "running"
  | "stalled"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown";

export interface Summary {
  stationCount: number;
  healthyStations: number;
  warningStations: number;
  downStations: number;
  activeSessions: number;
  activeProcesses: number;
  heraldPrs: number;
  totalRuns: number;
  totalAiu: number;
}

export interface ProjectSummary {
  repository: string;
  runs: number;
  calls: number;
  aiu: number;
  heraldPrs: number;
  activeSessions: number;
  activeBranches: string[];
  lastActivity: string | null;
  configured: boolean;
}

export interface StationSummary {
  id: string;
  display: string;
  title: string;
  purpose: string;
  model: string;
  reasoningEffort: string | null;
  family: string;
  group: string;
  status: HealthStatus;
  lastRun: string | null;
  lastSmoke: string | null;
  runs: number;
  successRate: number | null;
  calls: number;
  aiu: number;
  averageTtftMs: number | null;
}

export interface ModelSummary {
  model: string;
  status: HealthStatus;
  statusReason: string;
  lastCall: string | null;
  calls: number;
  completionRate: number | null;
  averageTtftMs: number | null;
  averageDurationMs: number | null;
  aiu: number;
  stations: string[];
}

export interface ProcessSummary {
  id: string;
  station: string;
  title: string;
  description: string;
  project: string;
  status: HealthStatus;
  startedAt: string;
  completedAt: string | null;
  lastActivity: string;
  model: string | null;
  calls: number;
  aiu: number;
  prUrl: string | null;
}

export interface SmokeStation {
  station: string;
  model: string | null;
  status: HealthStatus;
  calls: number;
}

export interface SmokeTestSummary {
  startedAt: string;
  project: string;
  total: number;
  passed: number;
  failed: number;
  unknown: number;
  stations: SmokeStation[];
}

export interface DashboardData {
  fleetId: string;
  providerId: string;
  generatedAt: string;
  rangeDays: number;
  selectedProject: string;
  summary: Summary;
  projects: ProjectSummary[];
  stations: StationSummary[];
  models: ModelSummary[];
  processes: ProcessSummary[];
  smokeTest: SmokeTestSummary | null;
  activity: ProcessSummary[];
  handoffs: HandoffTask[];
  sources: {
    sessionStore: boolean;
    eventLogs: boolean;
    githubCli: boolean;
  };
}

export interface FleetProviderCapabilities {
  telemetry: boolean;
  commandLaunch: boolean;
  smokeSuite: boolean;
  crewManagement: boolean;
  modelOverrides: boolean;
}

export interface FleetProvider {
  id: string;
  displayName: string;
  agentNamespace: string;
  root: string;
  agentsDirectory: string;
  stationManifest: string;
  crewsDirectory: string;
  capabilities: FleetProviderCapabilities;
}

export interface FleetInstance {
  id: string;
  name: string;
  providerId: string;
  providerRoot: string;
  crew?: string;
  config?: Record<string, unknown>;
  available: boolean;
  error: string | null;
}

export interface FleetProviderError {
  root: string;
  error: string;
}

export interface FleetsData {
  schemaVersion: number;
  defaultFleetId: string | null;
  providers: FleetProvider[];
  fleets: FleetInstance[];
  providerErrors: FleetProviderError[];
  emptyReason?: string;
}

export interface HandoffStep {
  station: string;
  title: string;
  status: HealthStatus;
  model: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface HandoffTask {
  id: string;
  title: string;
  project: string;
  currentStation: string;
  status: HealthStatus;
  updatedAt: string;
  credits: number;
  prUrl: string | null;
  history: HandoffStep[];
}

export interface GitHubAccount {
  host: string;
  login: string;
  active: boolean;
  state: string;
  scopes: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthStatus {
  available: boolean;
  accounts: GitHubAccount[];
  error: string | null;
}

export interface StationRole {
  id: string;
  display: string;
  model: string;
  title: string;
}

export interface SmokeSuiteTarget {
  station: string;
  agent: string;
  model: string;
  status: "pending" | "running" | "completed" | "failed";
  message: string;
  commandJobId: string | null;
}

export interface SmokeSuiteJob {
  id: string;
  fleetId: string;
  providerId: string;
  status: "running" | "completed" | "failed";
  project: string;
  total: number;
  completed: number;
  failed: number;
  maxCreditsPerModel: number;
  message: string;
  targets: SmokeSuiteTarget[];
}

export interface CrewSummary {
  name: string;
  label: string;
  yours: boolean;
  names: Record<string, string>;
  models: Record<string, string>;
}

export interface CrewsData {
  roles: StationRole[];
  crews: CrewSummary[];
  availableModels: string[];
}

export interface AuthJob {
  id: string;
  status: "running" | "completed" | "failed";
  message: string;
}

export interface CommandJob {
  id: string;
  fleetId: string;
  providerId: string;
  status: "running" | "completed" | "failed";
  station: string;
  agent: string;
  project: string;
  model: string;
  maxCredits: number;
  message: string;
  output: string;
  kind: "command" | "smoke";
}
