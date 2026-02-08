const UNSAFE_TASK_CHARACTERS = /[^a-zA-Z0-9._-]+/g;

export function toTaskSlug(task: string): string {
  const normalized = task
    .trim()
    .toLowerCase()
    .replace(UNSAFE_TASK_CHARACTERS, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  if (!normalized) {
    throw new Error("Task cannot be empty");
  }

  return normalized;
}

export function normalizeBranchPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function buildBranchName(prefix: string, taskSlug: string): string {
  return `${normalizeBranchPrefix(prefix)}${taskSlug}`;
}
