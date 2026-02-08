import { resolveOpenConfig } from "../lib/config.js";
import { isMissingExecutableError } from "../lib/errors.js";
import { pathExists } from "../lib/fs-utils.js";
import { createOutput, type Output } from "../lib/output.js";
import { resolveRepoContext, resolveWorktreePath } from "../lib/repo.js";
import { buildBranchName, toTaskSlug } from "../lib/task-utils.js";
import { openInVSCode } from "../lib/vscode.js";

export interface OpenCommandOptions {
  dir?: string;
  branchPrefix?: string;
  open?: boolean;
}

export async function runOpenCommand(
  task: string,
  options: OpenCommandOptions,
  output: Output = createOutput()
): Promise<void> {
  const repoContext = await resolveRepoContext();
  const resolved = await resolveOpenConfig(repoContext.repoRoot, options);
  const taskSlug = toTaskSlug(task);
  const branchName = buildBranchName(resolved.branchPrefix, taskSlug);
  const worktreePath = resolveWorktreePath(
    repoContext.repoRoot,
    repoContext.repoName,
    taskSlug,
    resolved.dir
  );

  if (!(await pathExists(worktreePath))) {
    throw new Error(`Worktree does not exist: ${worktreePath}`);
  }

  let opened = false;

  if (resolved.open) {
    try {
      await openInVSCode(worktreePath);
      opened = true;
      output.info(`Opened VS Code at ${worktreePath}`);
    } catch (error) {
      if (isMissingExecutableError(error)) {
        output.warn(
          "VS Code CLI `code` was not found in PATH. Install it from VS Code command palette: 'Shell Command: Install code command in PATH'."
        );
      } else {
        throw error;
      }
    }
  }

  output.info(`Worktree path: ${worktreePath}`);
  output.info(`Expected branch: ${branchName}`);
  output.event("worktree.opened", {
    path: worktreePath,
    branch: branchName,
    opened
  });
}
