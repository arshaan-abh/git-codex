export interface TaskPromptInput {
  task: string;
  taskSlug: string;
  branch: string;
  worktreePath: string;
  message: string;
}

export function buildTaskPrompt(input: TaskPromptInput): string {
  const normalizedMessage = input.message.trim();
  const body =
    normalizedMessage.length > 0 ? normalizedMessage : "(no message)";

  return [
    `Task: ${input.task}`,
    `Task Slug: ${input.taskSlug}`,
    `Branch: ${input.branch}`,
    `Worktree: ${input.worktreePath}`,
    "",
    "Prompt:",
    body,
  ].join("\n");
}
