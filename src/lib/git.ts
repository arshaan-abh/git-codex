import { execa } from "execa";

export async function runGitCapture(
  args: string[],
  cwd: string
): Promise<string> {
  const result = await execa("git", args, { cwd });
  return result.stdout.trimEnd();
}

export async function runGitStream(args: string[], cwd: string): Promise<void> {
  await runGitStreamWithOptions(args, cwd, {
    quiet: false
  });
}

export interface RunGitStreamOptions {
  quiet?: boolean;
}

export async function runGitStreamWithOptions(
  args: string[],
  cwd: string,
  options: RunGitStreamOptions
): Promise<void> {
  if (options.quiet) {
    const result = await execa("git", args, {
      cwd,
      reject: false
    });

    if (result.exitCode === 0) {
      return;
    }

    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(
      detail
        ? `Command failed: git ${args.join(" ")}\n${detail}`
        : `Command failed: git ${args.join(" ")}`
    );
  }

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
  const state = await getRemoteBranchState(cwd, branchName, remote);
  return state.exists;
}

export interface RemoteBranchState {
  trackingRefExists: boolean;
  exists: boolean;
}

export async function getRemoteBranchState(
  cwd: string,
  branchName: string,
  remote = "origin"
): Promise<RemoteBranchState> {
  const localRefResult = await execa(
    "git",
    ["show-ref", "--verify", "--quiet", `refs/remotes/${remote}/${branchName}`],
    {
      cwd,
      reject: false
    }
  );

  if (localRefResult.exitCode === 0) {
    return {
      trackingRefExists: true,
      exists: true
    };
  }

  const remoteResult = await execa(
    "git",
    ["ls-remote", "--exit-code", "--heads", remote, branchName],
    {
      cwd,
      reject: false
    }
  );

  return {
    trackingRefExists: false,
    exists: remoteResult.exitCode === 0
  };
}

export async function fetchRemoteTrackingBranch(
  cwd: string,
  branchName: string,
  remote: string,
  options: RunGitStreamOptions
): Promise<void> {
  await runGitStreamWithOptions(
    [
      "fetch",
      remote,
      `+refs/heads/${branchName}:refs/remotes/${remote}/${branchName}`
    ],
    cwd,
    options
  );
}
