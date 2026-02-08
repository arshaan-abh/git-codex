import { resolveListConfig } from "../lib/config.js";
import { runGitCapture } from "../lib/git.js";
import { createOutput, type Output } from "../lib/output.js";
import { resolveRepoContext } from "../lib/repo.js";
import { parseWorktreeListPorcelain, stripHeadsRef } from "../lib/worktrees.js";

export interface ListCommandOptions {
  pretty?: boolean;
  branchPrefix?: string;
}

export async function runListCommand(
  options: ListCommandOptions,
  output: Output = createOutput(),
): Promise<void> {
  const repoContext = await resolveRepoContext();
  const resolved = await resolveListConfig(repoContext.repoRoot, options);

  if (!resolved.pretty && !output.json) {
    const text = await runGitCapture(
      ["worktree", "list"],
      repoContext.repoRoot,
    );
    output.print(text);
    return;
  }

  const listOutput = await runGitCapture(
    ["worktree", "list", "--porcelain"],
    repoContext.repoRoot,
  );
  const entries = parseWorktreeListPorcelain(listOutput);
  if (output.json) {
    const normalizedPrefix = normalizePrefix(resolved.branchPrefix);
    const filteredEntries = resolved.pretty
      ? entries.filter((entry) =>
          entry.branch
            ? entry.branch.startsWith(`refs/heads/${normalizedPrefix}`)
            : false,
        )
      : entries;
    output.event("worktree.list", {
      pretty: resolved.pretty,
      branchPrefix: normalizedPrefix,
      entries: filteredEntries.map((entry) => ({
        path: entry.worktree,
        branch: entry.branch ? stripHeadsRef(entry.branch) : undefined,
        head: entry.head,
      })),
    });
    return;
  }

  const normalizedPrefix = normalizePrefix(resolved.branchPrefix);
  const targetRefPrefix = `refs/heads/${normalizedPrefix}`;
  const filtered = entries.filter((entry) =>
    entry.branch ? entry.branch.startsWith(targetRefPrefix) : false,
  );

  if (filtered.length === 0) {
    output.info(`No worktrees found for branch prefix "${normalizedPrefix}".`);
    return;
  }

  const rows = filtered.map((entry) => ({
    path: entry.worktree,
    branch: stripHeadsRef(entry.branch ?? "(detached)"),
    head: (entry.head ?? "").slice(0, 7),
  }));

  const pathWidth = Math.max(
    "Path".length,
    ...rows.map((row) => row.path.length),
  );
  const branchWidth = Math.max(
    "Branch".length,
    ...rows.map((row) => row.branch.length),
  );

  output.print(
    `${padRight("Path", pathWidth)}  ${padRight("Branch", branchWidth)}  HEAD`,
  );
  output.print(`${"-".repeat(pathWidth)}  ${"-".repeat(branchWidth)}  -------`);

  for (const row of rows) {
    output.print(
      `${padRight(row.path, pathWidth)}  ${padRight(row.branch, branchWidth)}  ${row.head}`,
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
