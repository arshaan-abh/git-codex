import { resolveFinishConfig } from "../lib/config.js";
import { pathExists } from "../lib/fs-utils.js";
import {
  doesLocalBranchExist,
  runGitCapture,
  runGitStatus,
} from "../lib/git.js";
import { createOutput, type Output } from "../lib/output.js";
import { resolveRepoContext, resolveWorktreePath } from "../lib/repo.js";
import { buildBranchName, toTaskSlug } from "../lib/task-utils.js";

import { runRmCommand } from "./rm.js";

export interface FinishCommandOptions {
  dir?: string;
  branchPrefix?: string;
  forceDelete?: boolean;
  cleanup?: boolean;
  deleteBranch?: boolean;
}

export async function runFinishCommand(
  task: string,
  options: FinishCommandOptions,
  output: Output = createOutput(),
): Promise<void> {
  const repoContext = await resolveRepoContext();
  const resolved = await resolveFinishConfig(repoContext.repoRoot, options);
  const taskSlug = toTaskSlug(task);
  const taskBranch = buildBranchName(resolved.branchPrefix, taskSlug);
  const worktreePath = resolveWorktreePath(
    repoContext.repoRoot,
    repoContext.repoName,
    taskSlug,
    resolved.dir,
  );

  const currentBranch = await resolveCurrentBranch(repoContext.repoRoot);
  if (currentBranch === taskBranch) {
    throw new Error(
      `Cannot finish task while on task branch ${taskBranch}. Checkout a target branch first.`,
    );
  }

  const branchExists = await doesLocalBranchExist(repoContext.repoRoot, taskBranch);
  if (!branchExists) {
    throw new Error(`Task branch does not exist locally: ${taskBranch}`);
  }

  await assertCleanWorkingTree(repoContext.repoRoot);

  output.info(`Merging ${taskBranch} into ${currentBranch}...`);
  const mergeResult = await runGitStatus(
    ["merge", "--no-ff", "--no-edit", taskBranch],
    repoContext.repoRoot,
  );

  if (mergeResult.exitCode !== 0) {
    const mergeError = mergeGitOutput(mergeResult.stderr, mergeResult.stdout);
    throw new Error(
      [
        `Failed to merge ${taskBranch} into ${currentBranch}.`,
        mergeError || "Unknown git merge error",
        "Resolve the merge issue and retry. Cleanup was skipped.",
      ].join("\n"),
    );
  }

  output.info(`Merged ${taskBranch} into ${currentBranch}.`);

  let worktreeRemoved = false;
  let branchDeleted = false;

  if (resolved.cleanup) {
    await runRmCommand(
      task,
      {
        dir: resolved.dir,
        forceDelete: resolved.forceDelete,
      },
      output,
    );
    worktreeRemoved = !(await pathExists(worktreePath));
  } else {
    output.info("Skipped worktree cleanup (--no-cleanup).");
  }

  if (resolved.deleteBranch) {
    const deleteResult = await runGitStatus(
      ["branch", "-D", taskBranch],
      repoContext.repoRoot,
    );

    if (deleteResult.exitCode === 0) {
      branchDeleted = true;
      output.info(`Deleted branch ${taskBranch}.`);
    } else {
      const deleteError = mergeGitOutput(deleteResult.stderr, deleteResult.stdout);
      if (isMissingBranchError(deleteError)) {
        output.info(`Branch ${taskBranch} is already missing.`);
      } else {
        throw new Error(
          [
            `Failed to delete merged task branch ${taskBranch}.`,
            deleteError || "Unknown git branch delete error",
          ].join("\n"),
        );
      }
    }
  } else {
    output.info("Skipped branch delete (--keep-branch or --no-cleanup).");
  }

  output.event("task.finished", {
    task,
    taskSlug,
    taskBranch,
    mergedInto: currentBranch,
    cleanup: resolved.cleanup,
    forceDelete: resolved.forceDelete,
    worktreeRemoved,
    branchDeleted,
  });
}

async function resolveCurrentBranch(repoRoot: string): Promise<string> {
  const currentBranch = (await runGitCapture(["branch", "--show-current"], repoRoot)).trim();
  if (!currentBranch) {
    throw new Error(
      "Cannot finish task while HEAD is detached. Checkout a target branch first.",
    );
  }

  return currentBranch;
}

async function assertCleanWorkingTree(repoRoot: string): Promise<void> {
  const status = await runGitCapture(["status", "--porcelain"], repoRoot);
  if (!status.trim()) {
    return;
  }

  throw new Error(
    [
      "Current worktree has uncommitted changes.",
      "Commit or stash changes before running finish.",
    ].join("\n"),
  );
}

function mergeGitOutput(stderr: string, stdout: string): string {
  return [stderr, stdout].filter(Boolean).join("\n").trim();
}

function isMissingBranchError(message: string): boolean {
  return /not found|unknown branch|not a valid branch/i.test(message);
}
