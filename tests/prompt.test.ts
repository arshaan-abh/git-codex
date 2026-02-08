import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildTaskPrompt } from "../src/lib/prompt.js";

describe("buildTaskPrompt", () => {
  it("builds a structured task prompt with metadata", () => {
    const prompt = buildTaskPrompt({
      task: "Fix login bug",
      taskSlug: "fix-login-bug",
      branch: "codex/fix-login-bug",
      worktreePath: path.resolve("/tmp/repo-fix-login-bug"),
      message: "Investigate failing auth tests and propose a fix."
    });

    expect(prompt).toContain("Task: Fix login bug");
    expect(prompt).toContain("Task Slug: fix-login-bug");
    expect(prompt).toContain("Branch: codex/fix-login-bug");
    expect(prompt).toContain("Prompt:");
    expect(prompt).toContain("Investigate failing auth tests and propose a fix.");
  });

  it("uses placeholder text when message is blank", () => {
    const prompt = buildTaskPrompt({
      task: "Blank",
      taskSlug: "blank",
      branch: "codex/blank",
      worktreePath: "/tmp/repo-blank",
      message: "   "
    });

    expect(prompt).toContain("Prompt:\n(no message)");
  });
});
