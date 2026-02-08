import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildWorktreeAddArgs } from "../lib/add-strategy.js";
import { resolveAddConfig } from "../lib/config.js";
import { copyEnvLikeFiles, parseEnvGlobs } from "../lib/env-files.js";
import { isMissingExecutableError } from "../lib/errors.js";
import { pathExists } from "../lib/fs-utils.js";
import {
  doesLocalBranchExist,
  fetchRemoteTrackingBranch,
  getRemoteBranchState,
  runGitStreamWithOptions
} from "../lib/git.js";
import { createOutput, type Output } from "../lib/output.js";
import { resolveRepoContext, resolveWorktreePath } from "../lib/repo.js";
import { buildBranchName, toTaskSlug } from "../lib/task-utils.js";
import { writeTaskTemplate } from "../lib/template.js";
import { openInVSCode } from "../lib/vscode.js";

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
  overwriteTemplate?: boolean;
  fetch?: boolean;
}

export async function runAddCommand(
  task: string,
  options: AddCommandOptions,
  output: Output = createOutput()
): Promise<void> {
  const repoContext = await resolveRepoContext();
  const resolved = await resolveAddConfig(repoContext.repoRoot, options);
  const taskSlug = toTaskSlug(task);
  const branchName = buildBranchName(resolved.branchPrefix, taskSlug);
  const worktreePath = resolveWorktreePath(
    repoContext.repoRoot,
    repoContext.repoName,
    taskSlug,
    resolved.dir
  );

  if (await pathExists(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  if (resolved.fetch) {
    output.info("Fetching latest refs...");
    await runGitStreamWithOptions(["fetch"], repoContext.repoRoot, {
      quiet: output.quiet || output.json
    });
  }

  const remoteName = inferRemoteNameFromRef(resolved.base);
  const branchExists = await doesLocalBranchExist(repoContext.repoRoot, branchName);
  const remoteState = branchExists
    ? {
        trackingRefExists: false,
        exists: false
      }
    : await getRemoteBranchState(repoContext.repoRoot, branchName, remoteName);

  if (remoteState.exists && !remoteState.trackingRefExists) {
    output.info(`Fetching remote branch reference ${remoteName}/${branchName}...`);
    await fetchRemoteTrackingBranch(repoContext.repoRoot, branchName, remoteName, {
      quiet: output.quiet || output.json
    });
  }

  const worktreeAddArgs = buildWorktreeAddArgs({
    branchName,
    worktreePath,
    baseRef: resolved.base,
    localBranchExists: branchExists,
    remoteBranchExists: remoteState.exists,
    remoteName
  });

  await runGitStreamWithOptions(worktreeAddArgs, repoContext.repoRoot, {
    quiet: output.quiet || output.json
  });

  if (resolved.copyEnv) {
    const envGlobs = parseEnvGlobs(resolved.envGlobs);
    const copyResult = await copyEnvLikeFiles({
      repoRoot: repoContext.repoRoot,
      worktreePath,
      globs: envGlobs,
      overwrite: resolved.overwriteEnv
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
    const templateSource = await loadOptionalTemplateSource(
      repoContext.repoRoot,
      resolved.templateFile
    );
    const templateResult = await writeTaskTemplate({
      worktreePath,
      variables: {
        task,
        taskSlug,
        branch: branchName,
        worktreePath
      },
      templateSource,
      overwrite: resolved.overwriteTemplate
    });

    if (templateResult.created) {
      output.info(`Generated ${templateResult.templatePath}`);
    } else {
      output.info(
        `Skipped ${templateResult.templatePath} (already exists; use --overwrite-template to replace)`
      );
    }

    output.event("template.generated", {
      path: templateResult.templatePath,
      created: templateResult.created,
      overwritten: templateResult.overwritten
    });
  }

  if (resolved.open) {
    try {
      await openInVSCode(worktreePath);
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

  output.info(`Worktree ready at ${worktreePath}`);
  output.info(`Branch: ${branchName}`);
  output.event("worktree.created", {
    path: worktreePath,
    branch: branchName
  });
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
  templateFile?: string
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
