import path from "node:path";

import { runGitCapture } from "./git.js";

export interface RepoContext {
  repoRoot: string;
  repoName: string;
  parentDir: string;
}

export async function resolveRepoContext(
  cwd = process.cwd(),
): Promise<RepoContext> {
  const repoRootRaw = await runGitCapture(
    ["rev-parse", "--show-toplevel"],
    cwd,
  );
  const repoRoot = path.resolve(repoRootRaw.trim());

  return {
    repoRoot,
    repoName: path.basename(repoRoot),
    parentDir: path.dirname(repoRoot),
  };
}

export function resolveWorktreeParentDir(
  repoRoot: string,
  dirOverride?: string,
): string {
  if (!dirOverride) {
    return path.dirname(repoRoot);
  }

  return path.isAbsolute(dirOverride)
    ? path.resolve(dirOverride)
    : path.resolve(repoRoot, dirOverride);
}

export function resolveWorktreePath(
  repoRoot: string,
  repoName: string,
  taskSlug: string,
  dirOverride?: string,
): string {
  const parentDir = resolveWorktreeParentDir(repoRoot, dirOverride);
  return path.resolve(parentDir, `${repoName}-${taskSlug}`);
}
