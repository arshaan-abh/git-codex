import { describe, expect, it } from "vitest";

import {
  normalizeTemplateType,
  renderTaskTemplate,
} from "../src/lib/template.js";

describe("renderTaskTemplate", () => {
  it("injects task metadata into built-in template", () => {
    const rendered = renderTaskTemplate(
      {
        task: "Fix auth",
        taskSlug: "fix-auth",
        branch: "codex/fix-auth",
        worktreePath: "/tmp/repo-fix-auth",
      },
      undefined,
    );

    expect(rendered).toContain("Task: Fix auth");
    expect(rendered).toContain("Task Slug: fix-auth");
    expect(rendered).toContain("Branch: codex/fix-auth");
    expect(rendered).toContain("Worktree: /tmp/repo-fix-auth");
    expect(rendered).toContain("## Goals");
  });

  it("renders bugfix template skeleton", () => {
    const rendered = renderTaskTemplate(
      {
        task: "Fix auth",
        taskSlug: "fix-auth",
        branch: "codex/fix-auth",
        worktreePath: "/tmp/repo-fix-auth",
      },
      undefined,
      "bugfix",
    );

    expect(rendered).toContain("## Reproduction");
    expect(rendered).toContain("## Root Cause");
    expect(rendered).toContain("## Fix Plan");
  });

  it("renders feature template skeleton", () => {
    const rendered = renderTaskTemplate(
      {
        task: "New dashboard",
        taskSlug: "new-dashboard",
        branch: "codex/new-dashboard",
        worktreePath: "/tmp/repo-new-dashboard",
      },
      undefined,
      "feature",
    );

    expect(rendered).toContain("## Feature Scope");
    expect(rendered).toContain("## Validation");
    expect(rendered).toContain("## Rollout Notes");
  });

  it("supports placeholder replacement for custom template content", () => {
    const rendered = renderTaskTemplate(
      {
        task: "Investigate flaky tests",
        taskSlug: "investigate-flaky-tests",
        branch: "cfg/investigate-flaky-tests",
        worktreePath: "/tmp/repo-investigate",
      },
      "T={{task}}|S={{taskSlug}}|B={{branch}}|W={{worktreePath}}",
    );

    expect(rendered).toBe(
      "T=Investigate flaky tests|S=investigate-flaky-tests|B=cfg/investigate-flaky-tests|W=/tmp/repo-investigate",
    );
  });

  it("normalizes supported template types", () => {
    expect(normalizeTemplateType(undefined)).toBe("default");
    expect(normalizeTemplateType("default")).toBe("default");
    expect(normalizeTemplateType("bugfix")).toBe("bugfix");
    expect(normalizeTemplateType("feature")).toBe("feature");
  });

  it("throws for unsupported template types", () => {
    expect(() => normalizeTemplateType("unknown")).toThrow(
      "Invalid template type",
    );
  });
});
