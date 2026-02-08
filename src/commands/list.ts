import { runGitCapture } from "../lib/git.js";
import { resolveRepoContext } from "../lib/repo.js";
import {
  parseWorktreeListPorcelain,
  stripHeadsRef
} from "../lib/worktrees.js";

export interface ListCommandOptions {
  pretty: boolean;
  branchPrefix: string;
}

export async function runListCommand(options: ListCommandOptions): Promise<void> {
  const repoContext = await resolveRepoContext();

  if (!options.pretty) {
    const output = await runGitCapture(["worktree", "list"], repoContext.repoRoot);
    console.log(output);
    return;
  }

  const output = await runGitCapture(
    ["worktree", "list", "--porcelain"],
    repoContext.repoRoot
  );
  const entries = parseWorktreeListPorcelain(output);
  const normalizedPrefix = normalizePrefix(options.branchPrefix);
  const targetRefPrefix = `refs/heads/${normalizedPrefix}`;
  const filtered = entries.filter((entry) =>
    entry.branch ? entry.branch.startsWith(targetRefPrefix) : false
  );

  if (filtered.length === 0) {
    console.log(`No worktrees found for branch prefix "${normalizedPrefix}".`);
    return;
  }

  const rows = filtered.map((entry) => ({
    path: entry.worktree,
    branch: stripHeadsRef(entry.branch ?? "(detached)"),
    head: (entry.head ?? "").slice(0, 7)
  }));

  const pathWidth = Math.max("Path".length, ...rows.map((row) => row.path.length));
  const branchWidth = Math.max(
    "Branch".length,
    ...rows.map((row) => row.branch.length)
  );

  console.log(
    `${padRight("Path", pathWidth)}  ${padRight("Branch", branchWidth)}  HEAD`
  );
  console.log(`${"-".repeat(pathWidth)}  ${"-".repeat(branchWidth)}  -------`);

  for (const row of rows) {
    console.log(
      `${padRight(row.path, pathWidth)}  ${padRight(row.branch, branchWidth)}  ${row.head}`
    );
  }
}

function padRight(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}
