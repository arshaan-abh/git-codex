import { execa } from "execa";

export async function openInVSCode(worktreePath: string): Promise<void> {
  await execa("code", ["-n", worktreePath], {
    stdio: "ignore",
    windowsHide: true,
  });
}
