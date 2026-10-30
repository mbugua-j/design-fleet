import type { HealthStatus } from "./types";

export function projectKey(repository: string): string {
  return repository.trim().toLowerCase();
}

export function filterVisibleProjects<T extends { repository: string }>(
  projects: T[],
  hiddenProjects: string[],
): T[] {
  const hidden = new Set(hiddenProjects.map(projectKey));
  return projects.filter((project) => !hidden.has(projectKey(project.repository)));
}

export function filterProjectItems<T extends { project: string }>(
  items: T[],
  projects: { repository: string }[],
): T[] {
  const visible = new Set(projects.map((project) => projectKey(project.repository)));
  return items.filter((item) => visible.has(projectKey(item.project)));
}

export function activityIsLive(activity: { status: HealthStatus }): boolean {
  return activity.status === "running" || activity.status === "stalled";
}
