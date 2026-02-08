export interface BuildWorktreeAddArgsInput {
  branchName: string;
  worktreePath: string;
  baseRef: string;
  localBranchExists: boolean;
  remoteBranchExists: boolean;
  remoteName?: string;
}

export function buildWorktreeAddArgs(
  input: BuildWorktreeAddArgsInput,
): string[] {
  if (input.localBranchExists) {
    return ["worktree", "add", input.worktreePath, input.branchName];
  }

  const remoteName = input.remoteName ?? "origin";
  const startPoint = input.remoteBranchExists
    ? `${remoteName}/${input.branchName}`
    : input.baseRef;

  return [
    "worktree",
    "add",
    "-b",
    input.branchName,
    input.worktreePath,
    startPoint,
  ];
}
