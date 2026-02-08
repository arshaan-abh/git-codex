import { execa } from "execa";

export async function runGitCapture(
  args: string[],
  cwd: string
): Promise<string> {
  const result = await execa("git", args, { cwd });
  return result.stdout.trimEnd();
}

export async function runGitStream(args: string[], cwd: string): Promise<void> {
  await execa("git", args, {
    cwd,
    stdio: "inherit"
  });
}

export interface GitStatusResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runGitStatus(
  args: string[],
  cwd: string
): Promise<GitStatusResult> {
  const result = await execa("git", args, {
    cwd,
    reject: false
  });

  return {
    exitCode: result.exitCode ?? -1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

export async function doesLocalBranchExist(
  cwd: string,
  branchName: string
): Promise<boolean> {
  const result = await execa(
    "git",
    ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
    {
      cwd,
      reject: false
    }
  );

  return result.exitCode === 0;
}

export async function doesRemoteBranchExist(
  cwd: string,
  branchName: string,
  remote = "origin"
): Promise<boolean> {
  const result = await execa(
    "git",
    ["show-ref", "--verify", "--quiet", `refs/remotes/${remote}/${branchName}`],
    {
      cwd,
      reject: false
    }
  );

  return result.exitCode === 0;
}
