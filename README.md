# git-codex

`git-codex` is a TypeScript CLI that adds a `git codex` subcommand for task-oriented Git worktrees.

## Status

Phase 1 scaffold is implemented:

- `git codex add <task>`
- `git codex rm <task>`
- `git codex list`

## Install

```bash
npm install
npm run build
```

For local subcommand testing:

```bash
npm link
git codex --help
```

## Commands

### `git codex add <task>`

Creates a worktree and branch for the task.

Key flags:

- `--base <ref>` default `origin/main`
- `--branch-prefix <prefix>` default `codex/`
- `--dir <path>` default sibling directory of repo root
- `--no-open` skip `code -n <worktree>`
- `--no-copy-env` skip env copy
- `--env-globs ".env,.env.*"` customize env-like patterns
- `--overwrite-env` allow overwriting env-like files
- `--no-fetch` skip `git fetch`

### `git codex rm <task>`

Removes the task worktree mapping and prunes stale entries.

Key flags:

- `--dir <path>` worktree parent directory override
- `--force-delete` also delete worktree folder from disk

### `git codex list`

Default:

- proxies `git worktree list`

Optional:

- `--pretty` filters by branch prefix and prints a compact table
- `--branch-prefix <prefix>` default `codex/`

## Development

```bash
npm test
npm run build
```
