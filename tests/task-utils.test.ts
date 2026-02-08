import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseEnvGlobs } from "../src/lib/env-files.js";
import { resolveWorktreePath } from "../src/lib/repo.js";
import {
  buildBranchName,
  normalizeBranchPrefix,
  toTaskSlug,
} from "../src/lib/task-utils.js";

describe("task-utils", () => {
  it("normalizes task slugs for branch and directory safety", () => {
    expect(toTaskSlug(" Feature: Add Login ")).toBe("feature-add-login");
    expect(toTaskSlug("fix__windows.path")).toBe("fix__windows.path");
  });

  it("rejects empty task names", () => {
    expect(() => toTaskSlug("   ")).toThrow("Task cannot be empty");
  });

  it("normalizes branch prefixes to include trailing slash", () => {
    expect(normalizeBranchPrefix("codex")).toBe("codex/");
    expect(normalizeBranchPrefix("codex/")).toBe("codex/");
    expect(buildBranchName("codex", "task-a")).toBe("codex/task-a");
  });

  it("parses env globs from comma-separated input", () => {
    expect(parseEnvGlobs(".env,.env.*,.npmrc")).toEqual([
      ".env",
      ".env.*",
      ".npmrc",
    ]);
  });

  it("uses repo sibling by default and custom dir when specified", () => {
    const repoRoot = path.resolve("C:/tmp/my-repo");
    expect(resolveWorktreePath(repoRoot, "my-repo", "task-a")).toBe(
      path.resolve("C:/tmp/my-repo-task-a"),
    );

    expect(
      resolveWorktreePath(repoRoot, "my-repo", "task-a", ".worktrees"),
    ).toBe(path.resolve("C:/tmp/my-repo/.worktrees/my-repo-task-a"));
  });
});
