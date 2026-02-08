export interface WorktreeEntry {
  worktree: string;
  head?: string;
  branch?: string;
  detached: boolean;
  bare: boolean;
  locked: boolean;
  prunable?: string;
}

export function parseWorktreeListPorcelain(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let current: WorktreeEntry | undefined;

  const pushCurrent = () => {
    if (current) {
      entries.push(current);
      current = undefined;
    }
  };

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      pushCurrent();
      continue;
    }

    const [rawKey, ...rest] = line.split(" ");
    const value = rest.join(" ");

    if (rawKey === "worktree") {
      pushCurrent();
      current = {
        worktree: value,
        detached: false,
        bare: false,
        locked: false
      };
      continue;
    }

    if (!current) {
      continue;
    }

    switch (rawKey) {
      case "HEAD":
        current.head = value;
        break;
      case "branch":
        current.branch = value;
        break;
      case "detached":
        current.detached = true;
        break;
      case "bare":
        current.bare = true;
        break;
      case "locked":
        current.locked = true;
        break;
      case "prunable":
        current.prunable = value;
        break;
      default:
        break;
    }
  }

  pushCurrent();
  return entries;
}

export function stripHeadsRef(branchRef: string): string {
  return branchRef.replace(/^refs\/heads\//, "");
}
