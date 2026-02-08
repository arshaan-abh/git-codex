import { copyToClipboard } from "../lib/clipboard.js";
import { resolvePromptConfig } from "../lib/config.js";
import { createOutput, type Output } from "../lib/output.js";
import { buildTaskPrompt } from "../lib/prompt.js";
import { resolveRepoContext, resolveWorktreePath } from "../lib/repo.js";
import { buildBranchName, toTaskSlug } from "../lib/task-utils.js";

export interface PromptCommandOptions {
  dir?: string;
  branchPrefix?: string;
  copy?: boolean;
}

export async function runPromptCommand(
  task: string,
  message: string,
  options: PromptCommandOptions,
  output: Output = createOutput(),
): Promise<void> {
  const repoContext = await resolveRepoContext();
  const resolved = await resolvePromptConfig(repoContext.repoRoot, options);
  const taskSlug = toTaskSlug(task);
  const branchName = buildBranchName(resolved.branchPrefix, taskSlug);
  const worktreePath = resolveWorktreePath(
    repoContext.repoRoot,
    repoContext.repoName,
    taskSlug,
    resolved.dir,
  );
  const promptText = buildTaskPrompt({
    task,
    taskSlug,
    branch: branchName,
    worktreePath,
    message,
  });

  let copied = false;
  if (options.copy) {
    await copyToClipboard(promptText);
    copied = true;
  }

  if (output.json) {
    output.event("prompt.generated", {
      task,
      taskSlug,
      branch: branchName,
      worktreePath,
      copied,
      prompt: promptText,
    });
    return;
  }

  output.print(promptText);
  if (copied) {
    output.info("Prompt copied to clipboard.");
  }
}
