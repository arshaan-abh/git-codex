#!/usr/bin/env node

import { Command } from "commander";

import { runAddCommand } from "./commands/add.js";
import { runListCommand } from "./commands/list.js";
import { runOpenCommand } from "./commands/open.js";
import { runPromptCommand } from "./commands/prompt.js";
import { runRmCommand } from "./commands/rm.js";
import { toErrorMessage } from "./lib/errors.js";
import { createOutput } from "./lib/output.js";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("git codex")
    .description("Manage task worktrees for parallel Codex workflows.")
    .option("-q, --quiet", "Suppress non-error output")
    .option("--json", "Emit structured JSON output for automation")
    .showHelpAfterError();

  program
    .command("add")
    .description("Create a task worktree and branch.")
    .argument("<task>", "Task label used for branch and folder names")
    .option("--base <ref>", "Base ref for new worktree branches")
    .option("--branch-prefix <prefix>", "Branch prefix for generated branches")
    .option(
      "--dir <path>",
      "Parent directory for worktrees (default: sibling of repo root)"
    )
    .option(
      "--env-globs <patterns>",
      "Comma-separated env-like file globs from repo root"
    )
    .option("--overwrite-env", "Overwrite env-like files in existing worktree")
    .option("--no-open", "Do not open a new VS Code window")
    .option("--no-copy-env", "Skip env-like file copy")
    .option("--no-fetch", "Skip git fetch before worktree creation")
    .action(async (task: string, opts, command: Command) => {
      const output = createOutput(readGlobalOutputOptions(command));
      await runAddCommand(task, {
        open: readExplicitOption(command, "open", Boolean(opts.open)),
        base: readExplicitOption(command, "base", toOptionalString(opts.base)),
        branchPrefix: readExplicitOption(
          command,
          "branchPrefix",
          toOptionalString(opts.branchPrefix)
        ),
        dir: readExplicitOption(command, "dir", toOptionalString(opts.dir)),
        copyEnv: readExplicitOption(command, "copyEnv", Boolean(opts.copyEnv)),
        envGlobs: readExplicitOption(
          command,
          "envGlobs",
          toOptionalString(opts.envGlobs)
        ),
        overwriteEnv: readExplicitOption(
          command,
          "overwriteEnv",
          Boolean(opts.overwriteEnv)
        ),
        fetch: readExplicitOption(command, "fetch", Boolean(opts.fetch))
      }, output);
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
    .action(async (task: string, opts, command: Command) => {
      const output = createOutput(readGlobalOutputOptions(command));
      await runRmCommand(task, {
        dir: readExplicitOption(command, "dir", toOptionalString(opts.dir)),
        forceDelete: readExplicitOption(
          command,
          "forceDelete",
          Boolean(opts.forceDelete)
        )
      }, output);
    });

  program
    .command("list")
    .description("List git worktrees.")
    .option(
      "--pretty",
      "Show a filtered table for branches using the configured prefix"
    )
    .option("--branch-prefix <prefix>", "Branch prefix used by --pretty filtering")
    .action(async (opts, command: Command) => {
      const output = createOutput(readGlobalOutputOptions(command));
      await runListCommand({
        pretty: readExplicitOption(command, "pretty", Boolean(opts.pretty)),
        branchPrefix: readExplicitOption(
          command,
          "branchPrefix",
          toOptionalString(opts.branchPrefix)
        )
      }, output);
    });

  program
    .command("open")
    .description("Open an existing task worktree.")
    .argument("<task>", "Task label")
    .option(
      "--dir <path>",
      "Parent directory for worktrees (default: sibling of repo root)"
    )
    .option("--branch-prefix <prefix>", "Branch prefix for expected branch name")
    .option("--no-open", "Only print worktree metadata without opening VS Code")
    .action(async (task: string, opts, command: Command) => {
      const output = createOutput(readGlobalOutputOptions(command));
      await runOpenCommand(task, {
        dir: readExplicitOption(command, "dir", toOptionalString(opts.dir)),
        branchPrefix: readExplicitOption(
          command,
          "branchPrefix",
          toOptionalString(opts.branchPrefix)
        ),
        open: readExplicitOption(command, "open", Boolean(opts.open))
      }, output);
    });

  program
    .command("prompt")
    .description("Generate an initial prompt for a task worktree.")
    .argument("<task>", "Task label")
    .argument("<message>", "Prompt message")
    .option(
      "--dir <path>",
      "Parent directory for worktrees (default: sibling of repo root)"
    )
    .option("--branch-prefix <prefix>", "Branch prefix for generated branch name")
    .option("--copy", "Copy generated prompt to clipboard")
    .action(async (task: string, message: string, opts, command: Command) => {
      const output = createOutput(readGlobalOutputOptions(command));
      await runPromptCommand(task, message, {
        dir: readExplicitOption(command, "dir", toOptionalString(opts.dir)),
        branchPrefix: readExplicitOption(
          command,
          "branchPrefix",
          toOptionalString(opts.branchPrefix)
        ),
        copy: readExplicitOption(command, "copy", Boolean(opts.copy))
      }, output);
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  const output = createOutput({
    json: process.argv.includes("--json"),
    quiet: process.argv.includes("--quiet") || process.argv.includes("-q")
  });
  const message = toErrorMessage(error);
  output.error(message);
  process.exitCode = 1;
});

function isExplicitOptionSource(source: string | undefined): boolean {
  return source === "cli" || source === "env";
}

function readExplicitOption<T>(
  command: Command,
  optionName: string,
  value: T
): T | undefined {
  const source = command.getOptionValueSource(optionName);
  return isExplicitOptionSource(source) ? value : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function readGlobalOutputOptions(command: Command): {
  quiet?: boolean;
  json?: boolean;
} {
  const options = command.optsWithGlobals() as {
    quiet?: boolean;
    json?: boolean;
  };

  return {
    quiet: Boolean(options.quiet),
    json: Boolean(options.json)
  };
}
