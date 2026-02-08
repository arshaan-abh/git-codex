import { describe, expect, it } from "vitest";

import { renderTaskTemplate } from "../src/lib/template.js";

describe("renderTaskTemplate", () => {
  it("injects task metadata into built-in template", () => {
    const rendered = renderTaskTemplate(
      {
        task: "Fix auth",
        taskSlug: "fix-auth",
        branch: "codex/fix-auth",
        worktreePath: "/tmp/repo-fix-auth"
      },
      undefined
    );

    expect(rendered).toContain("Task: Fix auth");
    expect(rendered).toContain("Task Slug: fix-auth");
    expect(rendered).toContain("Branch: codex/fix-auth");
    expect(rendered).toContain("Worktree: /tmp/repo-fix-auth");
  });

  it("supports placeholder replacement for custom template content", () => {
    const rendered = renderTaskTemplate(
      {
        task: "Investigate flaky tests",
        taskSlug: "investigate-flaky-tests",
        branch: "cfg/investigate-flaky-tests",
        worktreePath: "/tmp/repo-investigate"
      },
      "T={{task}}|S={{taskSlug}}|B={{branch}}|W={{worktreePath}}"
    );

    expect(rendered).toBe(
      "T=Investigate flaky tests|S=investigate-flaky-tests|B=cfg/investigate-flaky-tests|W=/tmp/repo-investigate"
    );
  });
});
