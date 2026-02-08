# git-codex

`git-codex` is a TypeScript CLI that adds a `git codex` subcommand for task-oriented Git worktrees.

## Status

Phase 1 scaffold is implemented:

- `git codex add <task>`
- `git codex rm <task>`
- `git codex list`

## Install

```bash
pnpm install
pnpm build
```

For local subcommand testing:

```bash
pnpm link --global
git codex --help
```

## Commands

Global flags (all commands):

- `-q, --quiet` suppress non-error output
- `--json` emit structured JSON output for CI/automation

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

In `--json` mode, `list` emits a structured `worktree.list` event with entries.

## Phase 2 Config

`git-codex` supports both file-based and git-config-based settings.

Supported keys:

- `base`
- `branchPrefix`
- `dir`
- `copyEnv`
- `envGlobs`
- `overwriteEnv`
- `fetch`
- `open` or `openVsCodeByDefault`

File locations:

- Repo config: `.git-codexrc.json`
- Global config: `~/.config/git-codex/config.json`

Git config keys:

- `codex.base`
- `codex.branchPrefix`
- `codex.dir`
- `codex.copyEnv`
- `codex.envGlobs`
- `codex.overwriteEnv`
- `codex.fetch`
- `codex.open`

Precedence:

1. CLI flags
2. Repo config file
3. Repo git config
4. Global config file
5. Global git config
6. Built-in defaults

Example `.git-codexrc.json`:

```json
{
  "base": "origin/main",
  "branchPrefix": "codex/",
  "fetch": false,
  "copyEnv": true,
  "envGlobs": [".env", ".env.*", ".npmrc"],
  "openVsCodeByDefault": false
}
```

## Development

```bash
pnpm test
pnpm build
```
