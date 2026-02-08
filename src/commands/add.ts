import { copyEnvLikeFiles, parseEnvGlobs } from "../lib/env-files.js";
import { isMissingExecutableError } from "../lib/errors.js";
import { pathExists } from "../lib/fs-utils.js";
import { doesLocalBranchExist, runGitStream } from "../lib/git.js";
import { resolveRepoContext, resolveWorktreePath } from "../lib/repo.js";
import { buildBranchName, toTaskSlug } from "../lib/task-utils.js";
import { openInVSCode } from "../lib/vscode.js";

export interface AddCommandOptions {
  open: boolean;
  base: string;
  branchPrefix: string;
  dir?: string;
  copyEnv: boolean;
  envGlobs: string;
  overwriteEnv: boolean;
  fetch: boolean;
}

export async function runAddCommand(
  task: string,
  options: AddCommandOptions
): Promise<void> {
  const repoContext = await resolveRepoContext();
  const taskSlug = toTaskSlug(task);
  const branchName = buildBranchName(options.branchPrefix, taskSlug);
  const worktreePath = resolveWorktreePath(
    repoContext.repoRoot,
    repoContext.repoName,
    taskSlug,
    options.dir
  );

  if (await pathExists(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  if (options.fetch) {
    console.log("Fetching latest refs...");
    await runGitStream(["fetch"], repoContext.repoRoot);
  }

  const branchExists = await doesLocalBranchExist(repoContext.repoRoot, branchName);

  if (branchExists) {
    await runGitStream(
      ["worktree", "add", worktreePath, branchName],
      repoContext.repoRoot
    );
  } else {
    await runGitStream(
      ["worktree", "add", "-b", branchName, worktreePath, options.base],
      repoContext.repoRoot
    );
  }

  if (options.copyEnv) {
    const envGlobs = parseEnvGlobs(options.envGlobs);
    const copyResult = await copyEnvLikeFiles({
      repoRoot: repoContext.repoRoot,
      worktreePath,
      globs: envGlobs,
      overwrite: options.overwriteEnv
    });

    if (copyResult.matched.length === 0) {
      console.log("No env-like files matched copy patterns.");
    } else {
      for (const copiedFile of copyResult.copied) {
        console.log(`Copied ${copiedFile}`);
      }

      for (const skippedFile of copyResult.skipped) {
        console.log(`Skipped ${skippedFile} (already exists)`);
      }
    }
  }

  if (options.open) {
    try {
      await openInVSCode(worktreePath);
      console.log(`Opened VS Code at ${worktreePath}`);
    } catch (error) {
      if (isMissingExecutableError(error)) {
        console.log(
          "VS Code CLI `code` was not found in PATH. Install it from VS Code command palette: 'Shell Command: Install code command in PATH'."
        );
      } else {
        throw error;
      }
    }
  }

  console.log(`Worktree ready at ${worktreePath}`);
  console.log(`Branch: ${branchName}`);
}
