import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { copyEnvLikeFiles } from "../src/lib/env-files.js";

const tempRoots: string[] = [];

afterEach(async () => {
  while (tempRoots.length > 0) {
    const target = tempRoots.pop();
    if (target) {
      await rm(target, { recursive: true, force: true });
    }
  }
});

describe("copyEnvLikeFiles", () => {
  it("copies only root env-like files", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "git-codex-test-"));
    tempRoots.push(tempRoot);

    const repoRoot = path.join(tempRoot, "repo");
    const worktreePath = path.join(tempRoot, "worktree");

    await mkdir(repoRoot, { recursive: true });
    await mkdir(worktreePath, { recursive: true });
    await mkdir(path.join(repoRoot, "nested"), { recursive: true });

    await writeFile(path.join(repoRoot, ".env"), "ROOT=1");
    await writeFile(path.join(repoRoot, ".env.local"), "LOCAL=1");
    await writeFile(path.join(repoRoot, "nested", ".env"), "NESTED=1");

    const result = await copyEnvLikeFiles({
      repoRoot,
      worktreePath,
      globs: [".env", ".env.*"],
      overwrite: false,
    });

    expect(result.matched).toEqual([".env", ".env.local"]);
    expect(result.copied).toEqual([".env", ".env.local"]);
    expect(result.skipped).toEqual([]);
  });

  it("skips existing files when overwrite is false", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "git-codex-test-"));
    tempRoots.push(tempRoot);

    const repoRoot = path.join(tempRoot, "repo");
    const worktreePath = path.join(tempRoot, "worktree");

    await mkdir(repoRoot, { recursive: true });
    await mkdir(worktreePath, { recursive: true });

    await writeFile(path.join(repoRoot, ".env"), "ROOT=1");
    await writeFile(path.join(worktreePath, ".env"), "EXISTING=1");

    const result = await copyEnvLikeFiles({
      repoRoot,
      worktreePath,
      globs: [".env"],
      overwrite: false,
    });

    expect(result.matched).toEqual([".env"]);
    expect(result.copied).toEqual([]);
    expect(result.skipped).toEqual([".env"]);
  });
});
