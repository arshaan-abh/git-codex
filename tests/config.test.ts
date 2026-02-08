import { describe, expect, it } from "vitest";

import {
  addDefaults,
  mergeAddConfigLayers,
  parseBooleanLike,
  parseGitConfigMap
} from "../src/lib/config.js";

describe("config helpers", () => {
  it("merges add config layers with higher-priority overrides", () => {
    const resolved = mergeAddConfigLayers(
      addDefaults,
      {
        base: "origin/release",
        branchPrefix: "team/"
      },
      {
        copyEnv: false
      },
      {
        branchPrefix: "feature/",
        open: false
      }
    );

    expect(resolved.base).toBe("origin/release");
    expect(resolved.branchPrefix).toBe("feature/");
    expect(resolved.copyEnv).toBe(false);
    expect(resolved.open).toBe(false);
    expect(resolved.fetch).toBe(true);
  });

  it("parses codex git-config map into typed config", () => {
    const parsed = parseGitConfigMap(
      new Map<string, string>([
        ["codex.base", "origin/dev"],
        ["codex.branchPrefix", "my-prefix/"],
        ["codex.copyEnv", "false"],
        ["codex.open", "true"],
        ["codex.fetch", "0"],
        ["codex.envGlobs", ".env,.env.local"]
      ])
    );

    expect(parsed).toEqual({
      base: "origin/dev",
      branchPrefix: "my-prefix/",
      copyEnv: false,
      open: true,
      fetch: false,
      envGlobs: ".env,.env.local"
    });
  });

  it("accepts common boolean-like values", () => {
    expect(parseBooleanLike("true")).toBe(true);
    expect(parseBooleanLike("yes")).toBe(true);
    expect(parseBooleanLike("1")).toBe(true);
    expect(parseBooleanLike("false")).toBe(false);
    expect(parseBooleanLike("no")).toBe(false);
    expect(parseBooleanLike("0")).toBe(false);
    expect(parseBooleanLike("maybe")).toBeUndefined();
  });
});
