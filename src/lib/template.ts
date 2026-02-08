import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { pathExists } from "./fs-utils.js";

export type TaskTemplateType = "default" | "bugfix" | "feature";

export interface TaskTemplateVariables {
  task: string;
  taskSlug: string;
  branch: string;
  worktreePath: string;
}

export interface WriteTaskTemplateOptions {
  worktreePath: string;
  variables: TaskTemplateVariables;
  templateType: TaskTemplateType;
  templateSource?: string;
  overwrite: boolean;
}

export interface WriteTaskTemplateResult {
  templatePath: string;
  created: boolean;
  overwritten: boolean;
}

const DEFAULT_TASK_TEMPLATE = `# Codex Task Instructions

Task: {{task}}
Task Slug: {{taskSlug}}
Branch: {{branch}}
Worktree: {{worktreePath}}

## Goals
- Clarify scope and assumptions before coding.
- Implement the smallest safe change first.
- Validate with focused tests before completion.

## Notes
- Capture key decisions and tradeoffs here as you work.
`;

const BUGFIX_TASK_TEMPLATE = `# Codex Bugfix Instructions

Task: {{task}}
Task Slug: {{taskSlug}}
Branch: {{branch}}
Worktree: {{worktreePath}}

## Reproduction
- Document exact failing behavior and where it occurs.
- Capture error messages, stack traces, and triggering inputs.

## Root Cause
- Identify the precise source of the bug (not just symptom).
- Note why existing checks/tests missed it.

## Fix Plan
- Implement the smallest safe fix at the source.
- Add regression coverage for this exact failure mode.

## Validation
- Run focused tests first, then broader suite.
- Confirm no behavioral regressions in adjacent paths.
`;

const FEATURE_TASK_TEMPLATE = `# Codex Feature Instructions

Task: {{task}}
Task Slug: {{taskSlug}}
Branch: {{branch}}
Worktree: {{worktreePath}}

## Feature Scope
- Define explicit in-scope and out-of-scope behavior.
- List required interfaces, UX/API changes, and data impacts.

## Implementation Plan
- Break implementation into small, testable increments.
- Favor backward-compatible changes when possible.

## Validation
- Add/extend tests for happy path and edge cases.
- Verify error handling and observability paths.

## Rollout Notes
- Document migration, flags, or release sequencing needs.
`;

const BUILT_IN_TEMPLATES: Record<TaskTemplateType, string> = {
  default: DEFAULT_TASK_TEMPLATE,
  bugfix: BUGFIX_TASK_TEMPLATE,
  feature: FEATURE_TASK_TEMPLATE,
};

export function normalizeTemplateType(
  type: string | undefined,
): TaskTemplateType {
  const candidate = (type ?? "default").trim().toLowerCase();

  if (
    candidate === "default" ||
    candidate === "bugfix" ||
    candidate === "feature"
  ) {
    return candidate;
  }

  throw new Error(
    `Invalid template type "${type}". Expected one of: default, bugfix, feature.`,
  );
}

export function renderTaskTemplate(
  variables: TaskTemplateVariables,
  templateSource?: string,
  templateType: TaskTemplateType = "default",
): string {
  const source = templateSource ?? BUILT_IN_TEMPLATES[templateType];
  const replacements: Record<string, string> = {
    task: variables.task,
    taskSlug: variables.taskSlug,
    branch: variables.branch,
    worktreePath: variables.worktreePath,
  };

  return source.replace(
    /\{\{\s*(task|taskSlug|branch|worktreePath)\s*\}\}/g,
    (_, key) => {
      const value = replacements[key];
      return value ?? "";
    },
  );
}

export async function writeTaskTemplate(
  options: WriteTaskTemplateOptions,
): Promise<WriteTaskTemplateResult> {
  const codexDir = path.join(options.worktreePath, ".codex");
  const templatePath = path.join(codexDir, "INSTRUCTIONS.md");
  const exists = await pathExists(templatePath);

  if (exists && !options.overwrite) {
    return {
      templatePath,
      created: false,
      overwritten: false,
    };
  }

  await mkdir(codexDir, { recursive: true });
  const rendered = renderTaskTemplate(
    options.variables,
    options.templateSource,
    options.templateType,
  );
  await writeFile(templatePath, rendered, "utf8");

  return {
    templatePath,
    created: true,
    overwritten: exists,
  };
}
