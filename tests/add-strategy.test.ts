import { describe, expect, it } from "vitest";

import { buildWorktreeAddArgs } from "../src/lib/add-strategy.js";

describe("buildWorktreeAddArgs", () => {
  it("uses existing local branch when it exists", () => {
    expect(
      buildWorktreeAddArgs({
        branchName: "codex/task-a",
        worktreePath: "/tmp/repo-task-a",
        baseRef: "origin/main",
        localBranchExists: true,
        remoteBranchExists: true
      })
    ).toEqual(["worktree", "add", "/tmp/repo-task-a", "codex/task-a"]);
  });

  it("creates local branch from remote branch when only remote exists", () => {
    expect(
      buildWorktreeAddArgs({
        branchName: "codex/task-a",
        worktreePath: "/tmp/repo-task-a",
        baseRef: "origin/main",
        localBranchExists: false,
        remoteBranchExists: true
      })
    ).toEqual([
      "worktree",
      "add",
      "-b",
      "codex/task-a",
      "/tmp/repo-task-a",
      "origin/codex/task-a"
    ]);
  });

  it("creates a new branch from base ref when branch does not exist", () => {
    expect(
      buildWorktreeAddArgs({
        branchName: "codex/task-a",
        worktreePath: "/tmp/repo-task-a",
        baseRef: "origin/main",
        localBranchExists: false,
        remoteBranchExists: false
      })
    ).toEqual([
      "worktree",
      "add",
      "-b",
      "codex/task-a",
      "/tmp/repo-task-a",
      "origin/main"
    ]);
  });
});
