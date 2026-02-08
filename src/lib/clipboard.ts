import process from "node:process";

import { execa } from "execa";

export async function copyToClipboard(text: string): Promise<void> {
  const platform = process.platform;

  if (platform === "win32") {
    await runClipboardCommand("clip", [], text);
    return;
  }

  if (platform === "darwin") {
    await runClipboardCommand("pbcopy", [], text);
    return;
  }

  const linuxCandidates: Array<[string, string[]]> = [
    ["wl-copy", []],
    ["xclip", ["-selection", "clipboard"]],
    ["xsel", ["--clipboard", "--input"]],
  ];

  for (const [binary, args] of linuxCandidates) {
    try {
      await runClipboardCommand(binary, args, text);
      return;
    } catch (error) {
      if (isMissingBinaryError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "No clipboard utility found. Install wl-copy, xclip, or xsel to use --copy.",
  );
}

async function runClipboardCommand(
  binary: string,
  args: string[],
  text: string,
): Promise<void> {
  await execa(binary, args, {
    input: text,
    reject: true,
  });
}

function isMissingBinaryError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as { code?: string };
  return maybeError.code === "ENOENT";
}
