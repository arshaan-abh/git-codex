import { describe, expect, it } from "vitest";

import { createOutput } from "../src/lib/output.js";

describe("output", () => {
  it("suppresses non-error logs in quiet mode", () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const output = createOutput(
      { quiet: true },
      {
        stdout: (chunk) => stdout.push(chunk),
        stderr: (chunk) => stderr.push(chunk),
      },
    );

    output.info("hello");
    output.warn("warn");
    output.print("plain");
    output.error("boom");

    expect(stdout).toEqual([]);
    expect(stderr).toEqual(["boom\n"]);
  });

  it("emits structured json logs when json mode is enabled", () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const output = createOutput(
      { json: true },
      {
        stdout: (chunk) => stdout.push(chunk),
        stderr: (chunk) => stderr.push(chunk),
      },
    );

    output.info("hello", { task: "a" });
    output.event("worktree.created", {
      path: "/tmp/repo-a",
    });
    output.error("failure", { code: 7 });

    expect(JSON.parse(stdout[0] ?? "{}")).toEqual({
      level: "info",
      message: "hello",
      task: "a",
    });
    expect(JSON.parse(stdout[1] ?? "{}")).toEqual({
      event: "worktree.created",
      path: "/tmp/repo-a",
    });
    expect(JSON.parse(stderr[0] ?? "{}")).toEqual({
      level: "error",
      message: "failure",
      code: 7,
    });
  });
});
