#!/usr/bin/env node

import { Command } from "commander";

import { runAddCommand } from "./commands/add.js";
import { runListCommand } from "./commands/list.js";
import { runRmCommand } from "./commands/rm.js";
import { toErrorMessage } from "./lib/errors.js";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("git codex")
    .description("Manage task worktrees for parallel Codex workflows.")
    .showHelpAfterError();

  program
    .command("add")
    .description("Create a task worktree and branch.")
    .argument("<task>", "Task label used for branch and folder names")
    .option("--base <ref>", "Base ref for new worktree branches", "origin/main")
    .option(
      "--branch-prefix <prefix>",
      "Branch prefix for generated branches",
      "codex/"
    )
    .option(
      "--dir <path>",
      "Parent directory for worktrees (default: sibling of repo root)"
    )
    .option(
      "--env-globs <patterns>",
      "Comma-separated env-like file globs from repo root",
      ".env,.env.*"
    )
    .option("--overwrite-env", "Overwrite env-like files in existing worktree")
    .option("--no-open", "Do not open a new VS Code window")
    .option("--no-copy-env", "Skip env-like file copy")
    .option("--no-fetch", "Skip git fetch before worktree creation")
    .action(async (task: string, opts) => {
      await runAddCommand(task, {
        open: Boolean(opts.open),
        base: String(opts.base),
        branchPrefix: String(opts.branchPrefix),
        dir: opts.dir ? String(opts.dir) : undefined,
        copyEnv: Boolean(opts.copyEnv),
        envGlobs: String(opts.envGlobs),
        overwriteEnv: Boolean(opts.overwriteEnv),
        fetch: Boolean(opts.fetch)
      });
    });

  program
    .command("rm")
    .description("Remove a task worktree.")
    .argument("<task>", "Task label")
    .option(
      "--dir <path>",
      "Parent directory for worktrees (default: sibling of repo root)"
    )
    .option(
      "--force-delete",
      "Delete the worktree directory after removing mapping"
    )
    .action(async (task: string, opts) => {
      await runRmCommand(task, {
        dir: opts.dir ? String(opts.dir) : undefined,
        forceDelete: Boolean(opts.forceDelete)
      });
    });

  program
    .command("list")
    .description("List git worktrees.")
    .option(
      "--pretty",
      "Show a filtered table for branches using the configured prefix"
    )
    .option(
      "--branch-prefix <prefix>",
      "Branch prefix used by --pretty filtering",
      "codex/"
    )
    .action(async (opts) => {
      await runListCommand({
        pretty: Boolean(opts.pretty),
        branchPrefix: String(opts.branchPrefix)
      });
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  const message = toErrorMessage(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
