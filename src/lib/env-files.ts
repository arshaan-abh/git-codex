import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";

import { type EnvScope } from "./env-scope.js";
import { pathExists } from "./fs-utils.js";

export interface CopyEnvLikeFilesOptions {
  repoRoot: string;
  worktreePath: string;
  globs: string[];
  overwrite: boolean;
  scope: EnvScope;
}

export interface CopyEnvLikeFilesResult {
  scope: EnvScope;
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
  const matched = await findEnvLikeFiles(options);

  const copied: string[] = [];
  const skipped: string[] = [];

  for (const relativePath of matched) {
    const sourcePath = path.resolve(options.repoRoot, relativePath);
    const destinationPath = path.resolve(options.worktreePath, relativePath);

    if (!options.overwrite && (await pathExists(destinationPath))) {
      skipped.push(relativePath);
      continue;
    }

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
    copied.push(relativePath);
  }

  return {
    scope: options.scope,
    matched,
    copied,
    skipped,
  };
}

async function findEnvLikeFiles(
  options: CopyEnvLikeFilesOptions,
): Promise<string[]> {
  switch (options.scope) {
    case "root":
      return findRootEnvLikeFiles(options.repoRoot, options.globs);
    case "all":
      return findAllEnvLikeFiles(
        options.repoRoot,
        options.worktreePath,
        options.globs,
      );
    case "packages":
      return findPackagesEnvLikeFiles(
        options.repoRoot,
        options.worktreePath,
        options.globs,
      );
    default:
      return [];
  }
}

async function findRootEnvLikeFiles(
  repoRoot: string,
  globs: string[],
): Promise<string[]> {
  const matches = await fg(globs, {
    cwd: repoRoot,
    dot: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
    suppressErrors: true,
  });

  return sortPaths(
    matches.filter((match) => !toPosixPath(match).includes("/")),
  );
}

async function findAllEnvLikeFiles(
  repoRoot: string,
  worktreePath: string,
  globs: string[],
): Promise<string[]> {
  const recursiveGlobs = toRecursiveGlobs(globs);
  const matches = await fg(recursiveGlobs, {
    cwd: repoRoot,
    dot: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: buildEnvIgnoreGlobs(repoRoot, worktreePath),
  });

  return sortPaths(matches);
}

async function findPackagesEnvLikeFiles(
  repoRoot: string,
  worktreePath: string,
  globs: string[],
): Promise<string[]> {
  const packageRoots = await resolvePackageRoots(repoRoot, worktreePath);
  const relativeMatches = new Set<string>();
  const recursiveGlobs = toRecursiveGlobs(globs);

  for (const packageRoot of packageRoots) {
    const packageRootPath = path.join(repoRoot, packageRoot);
    const packageMatches = await fg(recursiveGlobs, {
      cwd: packageRootPath,
      dot: true,
      onlyFiles: true,
      unique: true,
      followSymbolicLinks: false,
      suppressErrors: true,
    });

    for (const packageMatch of packageMatches) {
      relativeMatches.add(
        toPosixPath(path.posix.join(toPosixPath(packageRoot), packageMatch)),
      );
    }
  }

  return sortPaths([...relativeMatches]);
}

async function resolvePackageRoots(
  repoRoot: string,
  worktreePath: string,
): Promise<string[]> {
  const workspacePatterns = await readPnpmWorkspacePackagePatterns(repoRoot);
  const patterns =
    workspacePatterns.length > 0 ? workspacePatterns : ["packages/*", "apps/*"];

  const packageRoots = await fg(patterns, {
    cwd: repoRoot,
    onlyDirectories: true,
    unique: true,
    followSymbolicLinks: false,
    suppressErrors: true,
    ignore: buildEnvIgnoreGlobs(repoRoot, worktreePath),
  });

  return sortPaths(packageRoots);
}

export async function readPnpmWorkspacePackagePatterns(
  repoRoot: string,
): Promise<string[]> {
  const workspacePath = path.join(repoRoot, "pnpm-workspace.yaml");
  if (!(await pathExists(workspacePath))) {
    return [];
  }

  const workspaceRaw = await readFile(workspacePath, "utf8");
  return parsePnpmWorkspacePackagePatterns(workspaceRaw);
}

export function parsePnpmWorkspacePackagePatterns(
  workspaceRaw: string,
): string[] {
  const lines = workspaceRaw.split(/\r?\n/);
  const patterns: string[] = [];

  let inPackagesSection = false;
  let packagesIndent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
    const currentIndent = leadingWhitespace.length;

    if (!inPackagesSection) {
      if (/^\s*packages:\s*$/.test(line)) {
        inPackagesSection = true;
        packagesIndent = currentIndent;
      }
      continue;
    }

    if (currentIndent <= packagesIndent && /^\s*[\w.-]+\s*:/.test(line)) {
      break;
    }

    const itemMatch = trimmed.match(/^- (.+)$/);
    if (!itemMatch) {
      continue;
    }

    let value = itemMatch[1].trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }

    if (value) {
      patterns.push(value);
    }
  }

  return patterns;
}

function buildEnvIgnoreGlobs(repoRoot: string, worktreePath: string): string[] {
  const ignore = [
    "**/.git/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/.turbo/**",
    "**/.cache/**",
    "**/.yarn/**",
    "**/.pnpm-store/**",
  ];

  const relativeWorktreePath = toPosixPath(
    path.relative(repoRoot, worktreePath),
  );
  if (isSubpath(relativeWorktreePath)) {
    ignore.push(`${relativeWorktreePath}/**`);
  }

  return ignore;
}

function isSubpath(relativePath: string): boolean {
  if (!relativePath) {
    return false;
  }

  return !relativePath.startsWith("../") && relativePath !== "..";
}

function sortPaths(paths: string[]): string[] {
  return paths
    .map((entry) => toPosixPath(entry))
    .sort((a, b) => a.localeCompare(b));
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function toRecursiveGlobs(globs: string[]): string[] {
  const expanded = new Set<string>();

  for (const glob of globs) {
    const normalized = toPosixPath(glob).trim();
    if (!normalized) {
      continue;
    }

    expanded.add(normalized);
    if (!normalized.startsWith("**/")) {
      expanded.add(`**/${normalized}`);
    }
  }

  return [...expanded];
}
