import type {
  AuthJob,
  AuthStatus,
  CommandJob,
  CrewsData,
  DashboardData,
  FleetInstance,
  FleetsData,
  SmokeSuiteJob,
} from "./types";

const requestHeaders = {
  "X-Design-Fleet-Dashboard": "1",
};
let activeAccountKey: string | null = null;
let accountRevision = 0;

export function clearAccountContext(): void {
  activeAccountKey = null;
  accountRevision += 1;
}

export function accountStorageKey(key: string): string {
  return `${key}:${activeAccountKey || "signed-out"}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const accountScoped = typeof input === "string"
    && input.startsWith("/api/")
    && !input.startsWith("/api/auth/");
  const revision = accountRevision;
  const headers = new Headers(init?.headers);
  if (accountScoped) {
    if (!activeAccountKey) {
      throw new DOMException("Account context is not ready", "AbortError");
    }
    headers.set("X-Design-Fleet-Account", activeAccountKey);
  }
  let response: Response;
  try {
    response = await fetch(input, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Couldn't reach the local dashboard server. It may be stopped or restarting. Confirm the fleet dashboard is running, then try again.",
      );
    }
    throw error;
  }

  if (accountScoped && revision !== accountRevision) {
    throw new DOMException("Account changed during request", "AbortError");
  }
  if (accountScoped && (response.status === 401 || response.status === 409)) {
    clearAccountContext();
    window.dispatchEvent(new Event("design-fleet-account-changed"));
    throw new DOMException("Active account changed", "AbortError");
  }
  try {
    const result = await readJson<T>(response);
    if (accountScoped && revision !== accountRevision) {
      throw new DOMException("Account changed during response", "AbortError");
    }
    return result;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        "The local dashboard server returned an unreadable response, which can happen during a restart. Wait a moment, then try again.",
      );
    }
    throw error;
  }
}

export async function getDashboard(
  days: number,
  project: string,
  fleetId: string,
  signal?: AbortSignal,
): Promise<DashboardData> {
  const params = new URLSearchParams({
    days: String(days),
    project,
  });
  params.set("fleet", fleetId);
  return requestJson<DashboardData>(`/api/dashboard?${params}`, {
    headers: requestHeaders,
    signal,
  });
}

export async function getFleets(signal?: AbortSignal): Promise<FleetsData> {
  return requestJson<FleetsData>("/api/fleets", {
    headers: requestHeaders,
    signal,
  });
}

export async function createFleet(input: {
  name: string;
  providerId: string;
}): Promise<FleetInstance> {
  return requestJson<FleetInstance>("/api/fleets", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function renameFleet(input: {
  id: string;
  name: string;
}): Promise<FleetInstance> {
  return requestJson<FleetInstance>("/api/fleets/rename", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function deleteFleet(id: string): Promise<FleetsData> {
  return requestJson<FleetsData>("/api/fleets/delete", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const auth = await requestJson<AuthStatus>("/api/auth/status", {
    headers: requestHeaders,
  });
  const accounts = auth.accounts.filter(
    (account) => account.active && account.state === "success",
  );
  const nextKey = accounts.length === 1
    ? `${accounts[0].host}/${accounts[0].login}`.toLowerCase()
    : null;
  if (nextKey !== activeAccountKey) {
    const changed = activeAccountKey !== null;
    activeAccountKey = nextKey;
    accountRevision += 1;
    if (changed) window.dispatchEvent(new Event("design-fleet-account-changed"));
  }
  return auth;
}

export async function startLogin(hostname: string): Promise<AuthJob> {
  return requestJson<AuthJob>("/api/auth/login", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hostname }),
  });
}

export async function getAuthJob(id: string): Promise<AuthJob> {
  const params = new URLSearchParams({ id });
  return requestJson<AuthJob>(`/api/auth/job?${params}`, {
    headers: requestHeaders,
  });
}

export async function switchAccount(
  hostname: string,
  login: string,
): Promise<AuthStatus> {
  return requestJson<AuthStatus>("/api/auth/switch", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hostname, login }),
  });
}

export async function logoutAccount(
  hostname: string,
  login: string,
): Promise<AuthStatus> {
  return requestJson<AuthStatus>("/api/auth/logout", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hostname, login }),
  });
}

export async function getCrews(
  fleetId: string,
  signal?: AbortSignal,
): Promise<CrewsData> {
  const params = new URLSearchParams();
  params.set("fleet", fleetId);
  return requestJson<CrewsData>(`/api/crews?${params}`, {
    headers: requestHeaders,
    signal,
  });
}

export async function saveCrew(fleetId: string, input: {
  name: string;
  label: string;
  names: Record<string, string>;
  models: Record<string, string>;
  install: boolean;
}): Promise<{ message: string; output: string }> {
  return requestJson<{ message: string; output: string }>("/api/crews", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...input, fleetId }),
  });
}

export async function startAgentCommand(fleetId: string, input: {
  project: string;
  station: string;
  model: string;
  prompt: string;
  maxCredits: number;
  confirmed: boolean;
  taskId?: string;
  kind?: "command" | "smoke";
}): Promise<CommandJob> {
  return requestJson<CommandJob>("/api/commands", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...input, fleetId }),
  });
}

export async function getCommandJob(
  fleetId: string,
  id: string,
): Promise<CommandJob> {
  const params = new URLSearchParams({ id });
  params.set("fleet", fleetId);
  return requestJson<CommandJob>(`/api/commands/job?${params}`, {
    headers: requestHeaders,
  });
}

export async function startSmokeSuite(fleetId: string, input: {
  project: string;
  confirmed: boolean;
}): Promise<SmokeSuiteJob> {
  return requestJson<SmokeSuiteJob>("/api/smoke-suite", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...input, fleetId }),
  });
}

export async function getSmokeSuiteJob(
  fleetId: string,
  id: string,
): Promise<SmokeSuiteJob> {
  const params = new URLSearchParams({ id });
  params.set("fleet", fleetId);
  return requestJson<SmokeSuiteJob>(`/api/smoke-suite/job?${params}`, {
    headers: requestHeaders,
  });
}

export async function getCurrentSmokeSuite(fleetId: string): Promise<{
  job: SmokeSuiteJob | null;
}> {
  const params = new URLSearchParams();
  params.set("fleet", fleetId);
  return requestJson<{ job: SmokeSuiteJob | null }>(
    `/api/smoke-suite/current?${params}`,
    { headers: requestHeaders },
  );
}
