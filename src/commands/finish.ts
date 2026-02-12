import { createInterface } from "node:readline/promises";

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

  await confirmTaskWorktreeState(
    worktreePath,
    {
      cleanup: resolved.cleanup,
      forceDelete: resolved.forceDelete,
    },
    output,
  );

  const currentBranch = await resolveCurrentBranch(repoContext.repoRoot);
  if (currentBranch === taskBranch) {
    throw new Error(
      `Cannot finish task while on task branch ${taskBranch}. Checkout a target branch first.`,
    );
  }

  const branchExists = await doesLocalBranchExist(
    repoContext.repoRoot,
    taskBranch,
  );
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

    if (await isMergeInProgress(repoContext.repoRoot)) {
      output.warn(
        [
          `Merge conflict detected while merging ${taskBranch} into ${currentBranch}.`,
          "Resolve conflicts and create the merge commit in this repository, then continue.",
        ].join("\n"),
      );

      await waitForConflictResolution(
        repoContext.repoRoot,
        taskBranch,
        currentBranch,
        output,
      );
    } else {
      throw new Error(
        [
          `Failed to merge ${taskBranch} into ${currentBranch}.`,
          mergeError || "Unknown git merge error",
          "Resolve the merge issue and retry. Cleanup was skipped.",
        ].join("\n"),
      );
    }
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
      const deleteError = mergeGitOutput(
        deleteResult.stderr,
        deleteResult.stdout,
      );
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

async function confirmTaskWorktreeState(
  worktreePath: string,
  cleanupOptions: {
    cleanup: boolean;
    forceDelete: boolean;
  },
  output: Output,
): Promise<void> {
  if (!(await pathExists(worktreePath))) {
    output.warn(
      `Task worktree path is missing (${worktreePath}). Skipping uncommitted-change check for task worktree.`,
    );
    return;
  }

  const status = await runGitStatus(["status", "--porcelain"], worktreePath);
  if (status.exitCode !== 0) {
    const detail = mergeGitOutput(status.stderr, status.stdout);
    throw new Error(
      [
        `Failed to inspect task worktree state at ${worktreePath}.`,
        detail || "Unknown git status error",
      ].join("\n"),
    );
  }

  if (!status.stdout.trim()) {
    return;
  }

  const cleanupNote =
    cleanupOptions.cleanup && cleanupOptions.forceDelete
      ? "Cleanup is configured to force-delete this worktree, so these uncommitted files will be removed."
      : "Continue only if you understand uncommitted task-worktree files may require manual follow-up.";

  output.warn(
    [
      `Task worktree has uncommitted changes: ${worktreePath}`,
      cleanupNote,
    ].join("\n"),
  );

  const shouldContinue = await promptForChoice(
    "Continue finish? Type 'y' to continue or 'n' to abort [n]: ",
    ["y", "yes", "n", "no"],
    "n",
  );

  if (shouldContinue === "y" || shouldContinue === "yes") {
    output.warn(
      "Continuing finish with dirty task worktree by user confirmation.",
    );
    return;
  }

  throw new Error(
    ["Aborted finish.", "Task worktree contains uncommitted changes."].join(
      "\n",
    ),
  );
}

async function waitForConflictResolution(
  repoRoot: string,
  taskBranch: string,
  currentBranch: string,
  output: Output,
): Promise<void> {
  while (true) {
    const action = await promptForChoice(
      "Merge conflict in progress. Type 'c' after resolving and committing, or 'a' to abort [a]: ",
      ["c", "continue", "a", "abort"],
      "a",
    );

    if (action === "a" || action === "abort") {
      throw new Error(
        [
          "Aborted finish while merge conflict is unresolved.",
          "Cleanup was skipped.",
        ].join("\n"),
      );
    }

    if (await isMergeInProgress(repoRoot)) {
      output.warn(
        "Merge is still in progress. Resolve conflicts and create the merge commit before continuing.",
      );
      continue;
    }

    if (!(await isBranchMergedIntoHead(repoRoot, taskBranch))) {
      output.warn(
        [
          `Branch ${taskBranch} is not merged into ${currentBranch} yet.`,
          "Complete the merge (or abort) before continuing.",
        ].join("\n"),
      );
      continue;
    }

    output.info(
      `Merge conflict resolved; continuing finish for ${taskBranch}.`,
    );
    return;
  }
}

async function isMergeInProgress(repoRoot: string): Promise<boolean> {
  const mergeHead = await runGitStatus(
    ["rev-parse", "-q", "--verify", "MERGE_HEAD"],
    repoRoot,
  );

  return mergeHead.exitCode === 0;
}

async function isBranchMergedIntoHead(
  repoRoot: string,
  branchName: string,
): Promise<boolean> {
  const merged = await runGitStatus(
    ["merge-base", "--is-ancestor", branchName, "HEAD"],
    repoRoot,
  );

  return merged.exitCode === 0;
}

async function promptForChoice(
  question: string,
  validChoices: ReadonlyArray<string>,
  defaultChoice: string,
): Promise<string> {
  const valid = new Set(validChoices.map((choice) => choice.toLowerCase()));

  while (true) {
    const answer = (await promptLine(question)).trim().toLowerCase();
    const resolved = answer || defaultChoice;

    if (valid.has(resolved)) {
      return resolved;
    }

    process.stderr.write(
      `Invalid choice: "${answer}". Expected one of: ${validChoices.join(", ")}\n`,
    );
  }
}

async function promptLine(question: string): Promise<string> {
  const interfaceHandle = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  try {
    return await interfaceHandle.question(question);
  } finally {
    interfaceHandle.close();
  }
}

async function resolveCurrentBranch(repoRoot: string): Promise<string> {
  const currentBranch = (
    await runGitCapture(["branch", "--show-current"], repoRoot)
  ).trim();
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
