import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pathExists } from "../src/lib/fs-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const cliPath = path.join(workspaceRoot, "dist", "cli.js");

const tempRoots: string[] = [];

beforeAll(
  async () => {
    await execa("pnpm", ["build"], { cwd: workspaceRoot });
  },
  120_000
);

afterAll(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

describe("cli integration", () => {
  it(
    "supports add/list/rm workflow and env copy end-to-end",
    async () => {
      const { repoPath } = await createRepoWithOrigin();

      await writeFile(path.join(repoPath, ".env"), "TOKEN=abc123\n");

      const addResult = await runCli(repoPath, [
        "add",
        "integration-a",
        "--json",
        "--no-open"
      ]);
      const addEvents = parseJsonLines(addResult.stdout);
      const createdEvent = getEvent(addEvents, "worktree.created");
      const worktreePath = String(createdEvent.path);

      expect(createdEvent.branch).toBe("codex/integration-a");
      expect(await pathExists(worktreePath)).toBe(true);
      expect(await pathExists(path.join(worktreePath, ".env"))).toBe(true);

      const copiedEnv = await readFile(path.join(worktreePath, ".env"), "utf8");
      expect(copiedEnv).toContain("TOKEN=abc123");

      const listResult = await runCli(repoPath, ["list", "--pretty", "--json"]);
      const listEvents = parseJsonLines(listResult.stdout);
      const listEvent = getEvent(listEvents, "worktree.list");
      const entries = Array.isArray(listEvent.entries) ? listEvent.entries : [];

      expect(entries.some((entry) => entry.branch === "codex/integration-a")).toBe(
        true
      );

      await runCli(repoPath, [
        "rm",
        "integration-a",
        "--json",
        "--force-delete"
      ]);

      expect(await pathExists(worktreePath)).toBe(false);
    },
    120_000
  );

  it(
    "supports open and prompt workflows",
    async () => {
      const { repoPath } = await createRepoWithOrigin();

      const addResult = await runCli(repoPath, [
        "add",
        "phase4-open",
        "--json",
        "--no-open",
        "--no-fetch",
        "--no-copy-env"
      ]);
      const addEvents = parseJsonLines(addResult.stdout);
      const createdEvent = getEvent(addEvents, "worktree.created");
      const worktreePath = String(createdEvent.path);

      const openResult = await runCli(repoPath, [
        "open",
        "phase4-open",
        "--json",
        "--no-open"
      ]);
      const openEvents = parseJsonLines(openResult.stdout);
      const openedEvent = getEvent(openEvents, "worktree.opened");

      expect(openedEvent.path).toBe(worktreePath);
      expect(openedEvent.branch).toBe("codex/phase4-open");
      expect(openedEvent.opened).toBe(false);

      const promptResult = await runCli(repoPath, [
        "prompt",
        "phase4-open",
        "Investigate flaky test and ship fix",
        "--json"
      ]);
      const promptEvents = parseJsonLines(promptResult.stdout);
      const promptEvent = getEvent(promptEvents, "prompt.generated");

      expect(promptEvent.branch).toBe("codex/phase4-open");
      expect(String(promptEvent.prompt)).toContain(
        "Investigate flaky test and ship fix"
      );

      await runCli(repoPath, ["rm", "phase4-open", "--json", "--force-delete"]);
      await runGit(repoPath, ["branch", "-D", "codex/phase4-open"]);
      expect(await pathExists(worktreePath)).toBe(false);
    },
    120_000
  );

  it(
    "can generate per-task .codex instruction template during add",
    async () => {
      const { repoPath } = await createRepoWithOrigin();

      const addResult = await runCli(repoPath, [
        "add",
        "phase4-template",
        "--json",
        "--no-open",
        "--no-fetch",
        "--no-copy-env",
        "--template",
        "--template-type",
        "bugfix"
      ]);
      const addEvents = parseJsonLines(addResult.stdout);
      const createdEvent = getEvent(addEvents, "worktree.created");
      const worktreePath = String(createdEvent.path);

      const templatePath = path.join(worktreePath, ".codex", "INSTRUCTIONS.md");
      expect(await pathExists(templatePath)).toBe(true);
      const renderedTemplate = await readFile(templatePath, "utf8");

      expect(renderedTemplate).toContain("Task: phase4-template");
      expect(renderedTemplate).toContain("Task Slug: phase4-template");
      expect(renderedTemplate).toContain("Branch: codex/phase4-template");
      expect(renderedTemplate).toContain("## Reproduction");

      await runCli(repoPath, [
        "rm",
        "phase4-template",
        "--json",
        "--force-delete"
      ]);
      await runGit(repoPath, ["branch", "-D", "codex/phase4-template"]);
      expect(await pathExists(worktreePath)).toBe(false);
    },
    120_000
  );

  it(
    "uses repo config defaults for add/rm/list",
    async () => {
      const { repoPath } = await createRepoWithOrigin();

      await writeFile(
        path.join(repoPath, ".git-codexrc.json"),
        JSON.stringify(
          {
            branchPrefix: "cfg/",
            fetch: false,
            copyEnv: false,
            openVsCodeByDefault: false
          },
          null,
          2
        )
      );

      const addResult = await runCli(repoPath, ["add", "phase3-cfg", "--json"]);
      const addEvents = parseJsonLines(addResult.stdout);
      const createdEvent = getEvent(addEvents, "worktree.created");
      const worktreePath = String(createdEvent.path);

      expect(createdEvent.branch).toBe("cfg/phase3-cfg");
      expect(await pathExists(worktreePath)).toBe(true);

      const listResult = await runCli(repoPath, ["list", "--pretty", "--json"]);
      const listEvents = parseJsonLines(listResult.stdout);
      const listEvent = getEvent(listEvents, "worktree.list");
      const entries = Array.isArray(listEvent.entries) ? listEvent.entries : [];

      expect(entries.some((entry) => entry.branch === "cfg/phase3-cfg")).toBe(true);

      await runCli(repoPath, ["rm", "phase3-cfg", "--json", "--force-delete"]);
      expect(await pathExists(worktreePath)).toBe(false);
    },
    120_000
  );

  it(
    "falls back to ls-remote for remote-only branches without local refs",
    async () => {
      const { repoPath } = await createRepoWithOrigin();

      await runGit(repoPath, ["checkout", "-b", "codex/remote-fallback"]);
      await runGit(repoPath, ["push", "-u", "origin", "codex/remote-fallback"]);
      await runGit(repoPath, ["checkout", "main"]);
      await runGit(repoPath, ["branch", "-D", "codex/remote-fallback"]);
      await runGit(repoPath, [
        "update-ref",
        "-d",
        "refs/remotes/origin/codex/remote-fallback"
      ]);

      const addResult = await runCli(repoPath, [
        "add",
        "remote-fallback",
        "--json",
        "--no-open",
        "--no-fetch",
        "--no-copy-env"
      ]);
      const addEvents = parseJsonLines(addResult.stdout);
      const createdEvent = getEvent(addEvents, "worktree.created");
      const worktreePath = String(createdEvent.path);

      expect(createdEvent.branch).toBe("codex/remote-fallback");
      expect(await pathExists(worktreePath)).toBe(true);

      await runCli(repoPath, [
        "rm",
        "remote-fallback",
        "--json",
        "--force-delete"
      ]);
      await runGit(repoPath, ["branch", "-D", "codex/remote-fallback"]);
      expect(await pathExists(worktreePath)).toBe(false);
    },
    120_000
  );
});

async function createRepoWithOrigin(): Promise<{ tempRoot: string; repoPath: string }> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "git-codex-it-"));
  tempRoots.push(tempRoot);

  const repoPath = path.join(tempRoot, "repo");
  const remotePath = path.join(tempRoot, "remote.git");

  await mkdir(repoPath, { recursive: true });

  await execa("git", ["init", "--bare", remotePath], { cwd: tempRoot });
  await execa("git", ["init"], { cwd: repoPath });
  await runGit(repoPath, ["config", "user.name", "git-codex-test"]);
  await runGit(repoPath, ["config", "user.email", "test@example.com"]);

  await writeFile(path.join(repoPath, "README.md"), "# integration test\n");

  await runGit(repoPath, ["add", "."]);
  await runGit(repoPath, ["commit", "-m", "initial commit"]);
  await runGit(repoPath, ["branch", "-M", "main"]);
  await runGit(repoPath, ["remote", "add", "origin", remotePath]);
  await runGit(repoPath, ["push", "-u", "origin", "main"]);

  return { tempRoot, repoPath };
}

async function runGit(cwd: string, args: string[]): Promise<void> {
  await execa("git", args, { cwd });
}

async function runCli(
  cwd: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  const result = await execa(process.execPath, [cliPath, ...args], {
    cwd,
    reject: false
  });

  if (result.exitCode !== 0) {
    throw new Error(
      [
        `CLI failed in ${cwd}`,
        `Command: node ${cliPath} ${args.join(" ")}`,
        `Exit code: ${result.exitCode ?? "unknown"}`,
        result.stderr || result.stdout || "No output"
      ].join("\n")
    );
  }

  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

function parseJsonLines(output: string): Array<Record<string, unknown>> {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function getEvent(
  lines: Array<Record<string, unknown>>,
  eventName: string
): Record<string, unknown> {
  const found = lines.find((line) => line.event === eventName);
  if (!found) {
    throw new Error(`Missing event "${eventName}" in output: ${JSON.stringify(lines)}`);
  }

  return found;
}
