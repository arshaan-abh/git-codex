import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { pathExists } from "./fs-utils.js";

export interface TaskTemplateVariables {
  task: string;
  taskSlug: string;
  branch: string;
  worktreePath: string;
}

export interface WriteTaskTemplateOptions {
  worktreePath: string;
  variables: TaskTemplateVariables;
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

export function renderTaskTemplate(
  variables: TaskTemplateVariables,
  templateSource?: string
): string {
  const source = templateSource ?? DEFAULT_TASK_TEMPLATE;
  const replacements: Record<string, string> = {
    task: variables.task,
    taskSlug: variables.taskSlug,
    branch: variables.branch,
    worktreePath: variables.worktreePath
  };

  return source.replace(/\{\{\s*(task|taskSlug|branch|worktreePath)\s*\}\}/g, (_, key) => {
    const value = replacements[key];
    return value ?? "";
  });
}

export async function writeTaskTemplate(
  options: WriteTaskTemplateOptions
): Promise<WriteTaskTemplateResult> {
  const codexDir = path.join(options.worktreePath, ".codex");
  const templatePath = path.join(codexDir, "INSTRUCTIONS.md");
  const exists = await pathExists(templatePath);

  if (exists && !options.overwrite) {
    return {
      templatePath,
      created: false,
      overwritten: false
    };
  }

  await mkdir(codexDir, { recursive: true });
  const rendered = renderTaskTemplate(options.variables, options.templateSource);
  await writeFile(templatePath, rendered, "utf8");

  return {
    templatePath,
    created: true,
    overwritten: exists
  };
}
