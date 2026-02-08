import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { buildWorktreeAddArgs } from "../lib/add-strategy.js";
import { resolveAddConfig } from "../lib/config.js";
import { copyEnvLikeFiles, parseEnvGlobs } from "../lib/env-files.js";
import { isMissingExecutableError, toErrorMessage } from "../lib/errors.js";
import { pathExists } from "../lib/fs-utils.js";
import {
  doesLocalBranchExist,
  fetchRemoteTrackingBranch,
  getRemoteBranchState,
  runGitCapture,
  runGitStatus,
  runGitStreamWithOptions,
} from "../lib/git.js";
import { createOutput, type Output } from "../lib/output.js";
import { resolveRepoContext, resolveWorktreePath } from "../lib/repo.js";
import { buildBranchName, toTaskSlug } from "../lib/task-utils.js";
import { normalizeTemplateType, writeTaskTemplate } from "../lib/template.js";
import { openInVSCode } from "../lib/vscode.js";
import {
  parseWorktreeListPorcelain,
  stripHeadsRef,
  type WorktreeEntry,
} from "../lib/worktrees.js";

export interface AddCommandOptions {
  open?: boolean;
  base?: string;
  branchPrefix?: string;
  dir?: string;
  copyEnv?: boolean;
  envGlobs?: string;
  overwriteEnv?: boolean;
  template?: boolean;
  templateFile?: string;
  templateType?: string;
  overwriteTemplate?: boolean;
  reuse?: boolean;
  rmFirst?: boolean;
  fetch?: boolean;
}

export async function runAddCommand(
  task: string,
  options: AddCommandOptions,
  output: Output = createOutput(),
): Promise<void> {
  const repoContext = await resolveRepoContext();
  const resolved = await resolveAddConfig(repoContext.repoRoot, options);
  const taskSlug = toTaskSlug(task);
  const branchName = buildBranchName(resolved.branchPrefix, taskSlug);
  const worktreePath = resolveWorktreePath(
    repoContext.repoRoot,
    repoContext.repoName,
    taskSlug,
    resolved.dir,
  );
  const reuse = Boolean(options.reuse);
  const rmFirst = Boolean(options.rmFirst);

  if (reuse && rmFirst) {
    throw new Error("Cannot use --reuse and --rm-first together.");
  }

  const worktreeExists = await pathExists(worktreePath);
  let reusedExistingWorktree = false;

  if (!worktreeExists && reuse) {
    throw new Error(
      `Cannot use --reuse: worktree path does not exist: ${worktreePath}`,
    );
  }

  if (worktreeExists) {
    if (rmFirst) {
      await removeExistingWorktreeForRecreate(
        repoContext.repoRoot,
        worktreePath,
        output,
      );
    } else if (reuse) {
      await assertReusableWorktreePath(
        repoContext.repoRoot,
        worktreePath,
        branchName,
      );
      reusedExistingWorktree = true;
      output.info(`Reusing existing worktree at ${worktreePath}`);
    } else {
      throw new Error(
        [
          `Worktree path already exists: ${worktreePath}`,
          "Use --reuse to continue with the existing worktree or --rm-first to recreate it.",
        ].join("\n"),
      );
    }
  }

  if (!reusedExistingWorktree) {
    if (resolved.fetch) {
      output.info("Fetching latest refs...");
      await runGitStreamWithOptions(["fetch"], repoContext.repoRoot, {
        quiet: output.quiet || output.json,
      });
    }

    const remoteName = inferRemoteNameFromRef(resolved.base);
    const branchExists = await doesLocalBranchExist(
      repoContext.repoRoot,
      branchName,
    );
    const remoteState = branchExists
      ? {
          trackingRefExists: false,
          exists: false,
        }
      : await getRemoteBranchState(
          repoContext.repoRoot,
          branchName,
          remoteName,
        );

    if (remoteState.exists && !remoteState.trackingRefExists) {
      output.info(
        `Fetching remote branch reference ${remoteName}/${branchName}...`,
      );
      await fetchRemoteTrackingBranch(
        repoContext.repoRoot,
        branchName,
        remoteName,
        {
          quiet: output.quiet || output.json,
        },
      );
    }

    const worktreeAddArgs = buildWorktreeAddArgs({
      branchName,
      worktreePath,
      baseRef: resolved.base,
      localBranchExists: branchExists,
      remoteBranchExists: remoteState.exists,
      remoteName,
    });

    await runGitStreamWithOptions(worktreeAddArgs, repoContext.repoRoot, {
      quiet: output.quiet || output.json,
    });
  }

  if (resolved.copyEnv) {
    const envGlobs = parseEnvGlobs(resolved.envGlobs);
    const copyResult = await copyEnvLikeFiles({
      repoRoot: repoContext.repoRoot,
      worktreePath,
      globs: envGlobs,
      overwrite: resolved.overwriteEnv,
    });

    if (copyResult.matched.length === 0) {
      output.info("No env-like files matched copy patterns.");
    } else {
      for (const copiedFile of copyResult.copied) {
        output.info(`Copied ${copiedFile}`);
      }

      for (const skippedFile of copyResult.skipped) {
        output.info(`Skipped ${skippedFile} (already exists)`);
      }
    }
  }

  if (resolved.template) {
    const templateType = normalizeTemplateType(resolved.templateType);
    const templateSource = await loadOptionalTemplateSource(
      repoContext.repoRoot,
      resolved.templateFile,
    );
    const templateResult = await writeTaskTemplate({
      worktreePath,
      templateType,
      variables: {
        task,
        taskSlug,
        branch: branchName,
        worktreePath,
      },
      templateSource,
      overwrite: resolved.overwriteTemplate,
    });

    if (templateResult.created) {
      output.info(`Generated ${templateResult.templatePath}`);
    } else {
      output.info(
        `Skipped ${templateResult.templatePath} (already exists; use --overwrite-template to replace)`,
      );
    }

    output.event("template.generated", {
      path: templateResult.templatePath,
      created: templateResult.created,
      overwritten: templateResult.overwritten,
      templateType,
    });
  }

  if (resolved.open) {
    try {
      await openInVSCode(worktreePath);
      output.info(`Opened VS Code at ${worktreePath}`);
    } catch (error) {
      if (isMissingExecutableError(error)) {
        output.warn(
          "VS Code CLI `code` was not found in PATH. Install it from VS Code command palette: 'Shell Command: Install code command in PATH'.",
        );
      } else {
        throw error;
      }
    }
  }

  output.info(`Worktree ready at ${worktreePath}`);
  output.info(`Branch: ${branchName}`);
  output.event(
    reusedExistingWorktree ? "worktree.reused" : "worktree.created",
    {
      path: worktreePath,
      branch: branchName,
      reused: reusedExistingWorktree,
    },
  );
}

function inferRemoteNameFromRef(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed) {
    return "origin";
  }

  if (trimmed.startsWith("refs/remotes/")) {
    const parts = trimmed.split("/");
    return parts[2] || "origin";
  }

  const slashIndex = trimmed.indexOf("/");
  if (slashIndex > 0) {
    return trimmed.slice(0, slashIndex);
  }

  return "origin";
}

async function loadOptionalTemplateSource(
  repoRoot: string,
  templateFile?: string,
): Promise<string | undefined> {
  if (!templateFile) {
    return undefined;
  }

  const resolvedTemplatePath = path.isAbsolute(templateFile)
    ? templateFile
    : path.resolve(repoRoot, templateFile);

  if (!(await pathExists(resolvedTemplatePath))) {
    throw new Error(`Template file not found: ${resolvedTemplatePath}`);
  }

  return readFile(resolvedTemplatePath, "utf8");
}

async function assertReusableWorktreePath(
  repoRoot: string,
  worktreePath: string,
  expectedBranch: string,
): Promise<void> {
  const matchingEntry = await findWorktreeByPath(repoRoot, worktreePath);
  if (!matchingEntry) {
    throw new Error(
      [
        `Cannot reuse ${worktreePath}: path exists, but it is not registered as a worktree in this repository.`,
        "Use --rm-first to remove it and recreate the worktree.",
      ].join("\n"),
    );
  }

  const actualBranch = matchingEntry.branch
    ? stripHeadsRef(matchingEntry.branch)
    : undefined;
  if (!actualBranch) {
    throw new Error(
      [
        `Cannot reuse ${worktreePath}: worktree is detached.`,
        `Expected branch: ${expectedBranch}`,
      ].join("\n"),
    );
  }

  if (actualBranch !== expectedBranch) {
    throw new Error(
      [
        `Cannot reuse ${worktreePath}: branch mismatch.`,
        `Expected branch: ${expectedBranch}`,
        `Actual branch: ${actualBranch}`,
        "Use --rm-first to recreate it for this task.",
      ].join("\n"),
    );
  }
}

async function removeExistingWorktreeForRecreate(
  repoRoot: string,
  worktreePath: string,
  output: Output,
): Promise<void> {
  output.info(
    `Removing existing worktree at ${worktreePath} before recreate...`,
  );

  const removeResult = await runGitStatus(
    ["worktree", "remove", "--force", worktreePath],
    repoRoot,
  );
  const removeError = mergeGitErrorOutput(
    removeResult.stderr,
    removeResult.stdout,
  );
  if (
    removeResult.exitCode !== 0 &&
    !isMissingWorktreeMappingError(removeError)
  ) {
    throw new Error(
      [
        `Failed to remove existing worktree mapping for ${worktreePath}`,
        removeError || "Unknown git error",
      ].join("\n"),
    );
  }

  try {
    await rm(worktreePath, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 150,
    });
  } catch (error) {
    throw new Error(
      [
        `Failed to remove existing worktree directory: ${worktreePath}`,
        toErrorMessage(error),
      ].join("\n"),
    );
  }

  await runGitStreamWithOptions(["worktree", "prune"], repoRoot, {
    quiet: output.quiet || output.json,
  });
}

async function findWorktreeByPath(
  repoRoot: string,
  worktreePath: string,
): Promise<WorktreeEntry | undefined> {
  const listOutput = await runGitCapture(
    ["worktree", "list", "--porcelain"],
    repoRoot,
  );
  const entries = parseWorktreeListPorcelain(listOutput);
  const normalizedTarget = normalizePathForComparison(worktreePath);

  return entries.find(
    (entry) => normalizePathForComparison(entry.worktree) === normalizedTarget,
  );
}

function normalizePathForComparison(targetPath: string): string {
  const normalized = path.normalize(path.resolve(targetPath));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function mergeGitErrorOutput(stderr: string, stdout: string): string {
  return [stderr, stdout].filter(Boolean).join("\n").trim();
}

function isMissingWorktreeMappingError(message: string): boolean {
  return /is not a working tree|is not registered|no such file|does not exist/i.test(
    message,
  );
}
