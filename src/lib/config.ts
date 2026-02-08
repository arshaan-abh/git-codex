import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { execa } from "execa";

import { pathExists } from "./fs-utils.js";

export interface CodexConfigValues {
  base: string;
  branchPrefix: string;
  dir?: string;
  copyEnv: boolean;
  envGlobs: string;
  overwriteEnv: boolean;
  template: boolean;
  templateFile?: string;
  overwriteTemplate: boolean;
  fetch: boolean;
  open: boolean;
}

export type CodexConfigOverrides = Partial<CodexConfigValues>;

export const addDefaults: CodexConfigValues = {
  base: "origin/main",
  branchPrefix: "codex/",
  dir: undefined,
  copyEnv: true,
  envGlobs: ".env,.env.*",
  overwriteEnv: false,
  template: false,
  templateFile: undefined,
  overwriteTemplate: false,
  fetch: true,
  open: true
};

interface RawConfigShape {
  base?: unknown;
  branchPrefix?: unknown;
  dir?: unknown;
  envGlobs?: unknown;
  openVsCodeByDefault?: unknown;
  open?: unknown;
  copyEnv?: unknown;
  overwriteEnv?: unknown;
  template?: unknown;
  templateFile?: unknown;
  overwriteTemplate?: unknown;
  fetch?: unknown;
}

export function mergeAddConfigLayers(
  ...layers: CodexConfigOverrides[]
): CodexConfigValues {
  const merged: CodexConfigOverrides = {};

  for (const layer of layers) {
    for (const [rawKey, value] of Object.entries(layer)) {
      if (value !== undefined) {
        const key = rawKey as keyof CodexConfigValues;
        merged[key] = value as never;
      }
    }
  }

  return {
    ...addDefaults,
    ...merged
  };
}

export function parseBooleanLike(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

export function parseGitConfigMap(
  entries: ReadonlyMap<string, string>
): CodexConfigOverrides {
  const normalizedEntries = new Map<string, string>();
  for (const [key, value] of entries.entries()) {
    normalizedEntries.set(key.toLowerCase(), value);
  }

  const get = (key: string): string | undefined =>
    normalizedEntries.get(key.toLowerCase());

  const copyEnv = getBooleanFromString(get("codex.copyenv"));
  const overwriteEnv = getBooleanFromString(get("codex.overwriteenv"));
  const template = getBooleanFromString(get("codex.template"));
  const overwriteTemplate = getBooleanFromString(get("codex.overwritetemplate"));
  const fetch = getBooleanFromString(get("codex.fetch"));
  const open =
    getBooleanFromString(get("codex.open")) ??
    getBooleanFromString(get("codex.openvscodebydefault"));

  return {
    base: get("codex.base"),
    branchPrefix: get("codex.branchprefix"),
    dir: get("codex.dir"),
    envGlobs: get("codex.envglobs"),
    copyEnv,
    overwriteEnv,
    template,
    templateFile: get("codex.templatefile"),
    overwriteTemplate,
    fetch,
    open
  };
}

export async function resolveAddConfig(
  repoRoot: string,
  cliOverrides: CodexConfigOverrides
): Promise<CodexConfigValues> {
  const layers = await loadConfigLayers(repoRoot);
  return mergeAddConfigLayers(addDefaults, ...layers, cliOverrides);
}

export async function resolveRmConfig(
  repoRoot: string,
  cliOverrides: {
    dir?: string;
    forceDelete?: boolean;
  }
): Promise<{
  dir?: string;
  forceDelete: boolean;
}> {
  const addConfig = await resolveAddConfig(repoRoot, {});

  return {
    dir: cliOverrides.dir ?? addConfig.dir,
    forceDelete: cliOverrides.forceDelete ?? false
  };
}

export async function resolveListConfig(
  repoRoot: string,
  cliOverrides: {
    branchPrefix?: string;
    pretty?: boolean;
  }
): Promise<{
  branchPrefix: string;
  pretty: boolean;
}> {
  const addConfig = await resolveAddConfig(repoRoot, {});

  return {
    branchPrefix: cliOverrides.branchPrefix ?? addConfig.branchPrefix,
    pretty: cliOverrides.pretty ?? false
  };
}

export async function resolveOpenConfig(
  repoRoot: string,
  cliOverrides: {
    dir?: string;
    branchPrefix?: string;
    open?: boolean;
  }
): Promise<{
  dir?: string;
  branchPrefix: string;
  open: boolean;
}> {
  const addConfig = await resolveAddConfig(repoRoot, {});

  return {
    dir: cliOverrides.dir ?? addConfig.dir,
    branchPrefix: cliOverrides.branchPrefix ?? addConfig.branchPrefix,
    open: cliOverrides.open ?? true
  };
}

export async function resolvePromptConfig(
  repoRoot: string,
  cliOverrides: {
    dir?: string;
    branchPrefix?: string;
  }
): Promise<{
  dir?: string;
  branchPrefix: string;
}> {
  const addConfig = await resolveAddConfig(repoRoot, {});

  return {
    dir: cliOverrides.dir ?? addConfig.dir,
    branchPrefix: cliOverrides.branchPrefix ?? addConfig.branchPrefix
  };
}

async function loadConfigLayers(repoRoot: string): Promise<CodexConfigOverrides[]> {
  const globalGit = await readGitConfig("global", repoRoot);
  const globalFile = await readJsonConfig(
    path.join(os.homedir(), ".config", "git-codex", "config.json")
  );
  const repoGit = await readGitConfig("local", repoRoot);
  const repoFile = await readJsonConfig(path.join(repoRoot, ".git-codexrc.json"));

  return [globalGit, globalFile, repoGit, repoFile];
}

async function readGitConfig(
  scope: "local" | "global",
  repoRoot: string
): Promise<CodexConfigOverrides> {
  const args =
    scope === "global"
      ? ["config", "--global", "--get-regexp", "^codex\\."]
      : ["config", "--get-regexp", "^codex\\."];

  const result = await execa("git", args, {
    cwd: repoRoot,
    reject: false
  });

  if (result.exitCode !== 0) {
    return {};
  }

  const map = new Map<string, string>();

  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace <= 0) {
      continue;
    }

    const key = trimmed.slice(0, firstSpace).trim().toLowerCase();
    const value = trimmed.slice(firstSpace + 1).trim();
    map.set(key, value);
  }

  return parseGitConfigMap(map);
}

async function readJsonConfig(configPath: string): Promise<CodexConfigOverrides> {
  if (!(await pathExists(configPath))) {
    return {};
  }

  const raw = await readFile(configPath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${configPath}: ${(error as Error).message || "Unable to parse"}`
    );
  }

  return parseJsonConfigObject(parsed, configPath);
}

function parseJsonConfigObject(
  raw: unknown,
  sourcePath: string
): CodexConfigOverrides {
  if (!isRecord(raw)) {
    throw new Error(`${sourcePath} must contain a JSON object.`);
  }

  const config = raw as RawConfigShape;
  const envGlobs = normalizeEnvGlobs(config.envGlobs, sourcePath);
  const open =
    readBoolean(config.open, "open", sourcePath) ??
    readBoolean(config.openVsCodeByDefault, "openVsCodeByDefault", sourcePath);

  return {
    base: readString(config.base, "base", sourcePath),
    branchPrefix: readString(config.branchPrefix, "branchPrefix", sourcePath),
    dir: readString(config.dir, "dir", sourcePath),
    envGlobs,
    copyEnv: readBoolean(config.copyEnv, "copyEnv", sourcePath),
    overwriteEnv: readBoolean(config.overwriteEnv, "overwriteEnv", sourcePath),
    template: readBoolean(config.template, "template", sourcePath),
    templateFile: readString(config.templateFile, "templateFile", sourcePath),
    overwriteTemplate: readBoolean(
      config.overwriteTemplate,
      "overwriteTemplate",
      sourcePath
    ),
    fetch: readBoolean(config.fetch, "fetch", sourcePath),
    open
  };
}

function readString(
  value: unknown,
  fieldName: string,
  sourcePath: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${sourcePath}: "${fieldName}" must be a string.`);
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function readBoolean(
  value: unknown,
  fieldName: string,
  sourcePath: string
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${sourcePath}: "${fieldName}" must be a boolean.`);
  }

  return value;
}

function normalizeEnvGlobs(
  value: unknown,
  sourcePath: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry !== "string") {
          throw new Error(
            `${sourcePath}: "envGlobs" array entries must all be strings.`
          );
        }

        return entry.trim();
      })
      .filter(Boolean);

    return normalized.length > 0 ? normalized.join(",") : undefined;
  }

  throw new Error(`${sourcePath}: "envGlobs" must be a string or string array.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBooleanFromString(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseBooleanLike(value);
}
