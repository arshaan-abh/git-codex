import { rm } from "node:fs/promises";

import { resolveRmConfig } from "../lib/config.js";
import { toErrorMessage } from "../lib/errors.js";
import { pathExists } from "../lib/fs-utils.js";
import { runGitStatus, runGitStream } from "../lib/git.js";
import { resolveRepoContext, resolveWorktreePath } from "../lib/repo.js";
import { toTaskSlug } from "../lib/task-utils.js";

export interface RmCommandOptions {
  dir?: string;
  forceDelete?: boolean;
}

export async function runRmCommand(
  task: string,
  options: RmCommandOptions
): Promise<void> {
  const repoContext = await resolveRepoContext();
  const resolved = await resolveRmConfig(repoContext.repoRoot, options);
  const taskSlug = toTaskSlug(task);
  const worktreePath = resolveWorktreePath(
    repoContext.repoRoot,
    repoContext.repoName,
    taskSlug,
    resolved.dir
  );

  let removedMapping = false;

  const removeResult = await runGitStatus(
    ["worktree", "remove", worktreePath],
    repoContext.repoRoot
  );

  if (removeResult.exitCode === 0) {
    removedMapping = true;
  } else {
    const firstError = [removeResult.stderr, removeResult.stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
    const mappingMissing = isMissingWorktreeMappingError(firstError);

    if (!mappingMissing && resolved.forceDelete) {
      const forceRemoveResult = await runGitStatus(
        ["worktree", "remove", "--force", worktreePath],
        repoContext.repoRoot
      );

      if (forceRemoveResult.exitCode === 0) {
        removedMapping = true;
      } else {
        const forcedMessage = [forceRemoveResult.stderr, forceRemoveResult.stdout]
          .filter(Boolean)
          .join("\n")
          .trim();

        if (!isMissingWorktreeMappingError(forcedMessage)) {
          throw new Error(
            `Failed to remove worktree mapping for ${worktreePath}\n${forcedMessage || "Unknown git error"}`
          );
        }
      }
    } else if (!mappingMissing) {
      throw new Error(
        [
          `Failed to remove worktree mapping for ${worktreePath}`,
          firstError || "Unknown git error",
          "",
          "Likely causes: VS Code still open, a watcher process still running, or a terminal in that folder.",
          "Close those and retry, or use --force-delete."
        ].join("\n")
      );
    }
  }

  if (resolved.forceDelete && (await pathExists(worktreePath))) {
    try {
      await rm(worktreePath, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 150
      });
    } catch (error) {
      throw new Error(
        [
          `Worktree mapping may be removed, but directory delete failed: ${worktreePath}`,
          toErrorMessage(error),
          "Close VS Code and any watchers/terminals using this folder, then retry."
        ].join("\n")
      );
    }
  }

  await runGitStream(["worktree", "prune"], repoContext.repoRoot);

  if (!resolved.forceDelete && (await pathExists(worktreePath))) {
    console.log(`Removed worktree mapping for ${worktreePath}`);
    console.log(
      "Directory still exists on disk. Use --force-delete to remove it as well."
    );
    return;
  }

  if (removedMapping) {
    console.log(`Removed worktree ${worktreePath}`);
  } else {
    console.log(`No existing worktree mapping found for ${worktreePath}`);
  }
}

function isMissingWorktreeMappingError(message: string): boolean {
  return /is not a working tree|is not registered|no such file|does not exist/i.test(
    message
  );
}
