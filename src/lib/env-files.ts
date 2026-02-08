import { copyFile } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";

import { pathExists } from "./fs-utils.js";

export interface CopyEnvLikeFilesOptions {
  repoRoot: string;
  worktreePath: string;
  globs: string[];
  overwrite: boolean;
}

export interface CopyEnvLikeFilesResult {
  matched: string[];
  copied: string[];
  skipped: string[];
}

export function parseEnvGlobs(globsInput: string): string[] {
  const unique = new Set(
    globsInput
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

  return [...unique];
}

export async function copyEnvLikeFiles(
  options: CopyEnvLikeFilesOptions,
): Promise<CopyEnvLikeFilesResult> {
  const matches = await fg(options.globs, {
    cwd: options.repoRoot,
    dot: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
    suppressErrors: true,
  });

  const rootOnlyMatches = matches
    .filter((match) => {
      const normalized = match.replace(/\\/g, "/");
      return !normalized.includes("/");
    })
    .sort((a, b) => a.localeCompare(b));

  const copied: string[] = [];
  const skipped: string[] = [];

  for (const relativePath of rootOnlyMatches) {
    const sourcePath = path.join(options.repoRoot, relativePath);
    const destinationPath = path.join(options.worktreePath, relativePath);

    if (!options.overwrite && (await pathExists(destinationPath))) {
      skipped.push(relativePath);
      continue;
    }

    await copyFile(sourcePath, destinationPath);
    copied.push(relativePath);
  }

  return {
    matched: rootOnlyMatches,
    copied,
    skipped,
  };
}
