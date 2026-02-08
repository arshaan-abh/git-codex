import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  copyEnvLikeFiles,
  parsePnpmWorkspacePackagePatterns,
} from "../src/lib/env-files.js";

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
  it("copies only root env-like files for root scope", async () => {
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
      scope: "root",
      overwrite: false,
    });

    expect(result.scope).toBe("root");
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
      scope: "root",
      overwrite: false,
    });

    expect(result.scope).toBe("root");
    expect(result.matched).toEqual([".env"]);
    expect(result.copied).toEqual([]);
    expect(result.skipped).toEqual([".env"]);
  });

  it("copies nested env-like files for all scope while skipping ignored folders", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "git-codex-test-"));
    tempRoots.push(tempRoot);

    const repoRoot = path.join(tempRoot, "repo");
    const worktreePath = path.join(tempRoot, "worktree");

    await mkdir(path.join(repoRoot, "apps", "web"), { recursive: true });
    await mkdir(path.join(repoRoot, "packages", "api"), { recursive: true });
    await mkdir(path.join(repoRoot, "node_modules", "ignored"), {
      recursive: true,
    });
    await mkdir(worktreePath, { recursive: true });

    await writeFile(path.join(repoRoot, ".env"), "ROOT=1");
    await writeFile(path.join(repoRoot, "apps", "web", ".env.local"), "WEB=1");
    await writeFile(path.join(repoRoot, "packages", "api", ".env"), "API=1");
    await writeFile(
      path.join(repoRoot, "node_modules", "ignored", ".env"),
      "SHOULD_NOT_COPY=1",
    );

    const result = await copyEnvLikeFiles({
      repoRoot,
      worktreePath,
      globs: [".env", ".env.*"],
      scope: "all",
      overwrite: false,
    });

    expect(result.scope).toBe("all");
    expect(result.matched).toEqual([
      ".env",
      "apps/web/.env.local",
      "packages/api/.env",
    ]);
    expect(result.copied).toEqual([
      ".env",
      "apps/web/.env.local",
      "packages/api/.env",
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("copies only package/app env-like files for packages scope", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "git-codex-test-"));
    tempRoots.push(tempRoot);

    const repoRoot = path.join(tempRoot, "repo");
    const worktreePath = path.join(tempRoot, "worktree");

    await mkdir(path.join(repoRoot, "apps", "web"), { recursive: true });
    await mkdir(path.join(repoRoot, "packages", "api"), { recursive: true });
    await mkdir(path.join(repoRoot, "scripts"), { recursive: true });
    await mkdir(worktreePath, { recursive: true });

    await writeFile(path.join(repoRoot, ".env"), "ROOT=1");
    await writeFile(path.join(repoRoot, "apps", "web", ".env"), "WEB=1");
    await writeFile(path.join(repoRoot, "packages", "api", ".env"), "API=1");
    await writeFile(path.join(repoRoot, "scripts", ".env"), "SCRIPT=1");

    const result = await copyEnvLikeFiles({
      repoRoot,
      worktreePath,
      globs: [".env"],
      scope: "packages",
      overwrite: false,
    });

    expect(result.scope).toBe("packages");
    expect(result.matched).toEqual(["apps/web/.env", "packages/api/.env"]);
    expect(result.copied).toEqual(["apps/web/.env", "packages/api/.env"]);
    expect(result.skipped).toEqual([]);
  });
});

describe("parsePnpmWorkspacePackagePatterns", () => {
  it("extracts package globs from pnpm-workspace yaml", () => {
    const parsed = parsePnpmWorkspacePackagePatterns(`
packages:
  - "apps/*"
  - 'services/*'
  - packages/*

onlyBuiltDependencies:
  - esbuild
`);

    expect(parsed).toEqual(["apps/*", "services/*", "packages/*"]);
  });
});
