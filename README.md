# git-codex

`git-codex` is a TypeScript CLI that adds a `git codex` subcommand for task-oriented Git worktrees.

## Demo

Adding tasks and merging them back:

https://github.com/user-attachments/assets/035b2c1b-11f7-4d42-ac3a-9063522ba379

Removing the tasks after the merge:

https://github.com/user-attachments/assets/0df9c32b-9312-49c3-a819-c884836b1d91

## Status

Phase 1 scaffold is implemented:

- `git codex add <task>`
- `git codex finish <task>`
- `git codex rm <task>`
- `git codex list`

## Install

Published install (after release):

```bash
pnpm add -g git-codex
git codex --help
```

Zero-install execution:

```bash
pnpm dlx git-codex --help
```

Local development install:

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

- `--base <ref>` default current checked-out branch
- `--branch-prefix <prefix>` default `codex/`
- `--dir <path>` default sibling directory of repo root
- `--no-open` skip `code -n <worktree>`
- `--no-copy-env` skip env copy
- `--env-globs ".env,.env.*"` customize env-like patterns
- `--env-scope <scope>` env file scan scope: `root`, `all`, or `packages`
- `--overwrite-env` allow overwriting env-like files
- `--template` generate `.codex/INSTRUCTIONS.md` for the new task worktree
- `--template-file <path>` use a custom template file (supports `{{task}}`, `{{taskSlug}}`, `{{branch}}`, `{{worktreePath}}`)
- `--template-type <type>` choose built-in template skeleton: `default`, `bugfix`, or `feature`
- `--overwrite-template` replace an existing generated instructions file
- `--no-fetch` skip `git fetch`

### `git codex finish <task>`

Merges the task branch into the currently checked-out branch in the main worktree.
On successful merge, it cleans up task artifacts by default.

Key flags:

- `--dir <path>` worktree parent directory override
- `--branch-prefix <prefix>` override task branch prefix
- `--no-force-delete` keep task worktree folder on disk during cleanup
- `--no-cleanup` keep worktree and branch after merge
- `--keep-branch` remove worktree but keep merged task branch

Default behavior:

- Validates current worktree is clean before merging
- Runs `git merge --no-ff --no-edit <task-branch>` into current branch
- Removes task worktree with force delete enabled
- Deletes merged task branch

In `--json` mode, `finish` emits `task.finished`.

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

### `git codex open <task>`

Opens an existing task worktree.

Key flags:

- `--dir <path>` worktree parent directory override
- `--branch-prefix <prefix>` override expected branch prefix
- `--no-open` print metadata only (do not launch VS Code)

In `--json` mode, `open` emits `worktree.opened`.

### `git codex prompt <task> <message>`

Generates a task bootstrap prompt including task/branch/worktree metadata.

Key flags:

- `--dir <path>` worktree parent directory override
- `--branch-prefix <prefix>` override branch prefix
- `--copy` copy generated prompt text to clipboard

In `--json` mode, `prompt` emits `prompt.generated`.

## Phase 2 Config

`git-codex` supports both file-based and git-config-based settings.

Supported keys:

- `base`
- `branchPrefix`
- `dir`
- `copyEnv`
- `envGlobs`
- `overwriteEnv`
- `envScope`
- `template`
- `templateFile`
- `templateType`
- `overwriteTemplate`
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
- `codex.envScope`
- `codex.template`
- `codex.templateFile`
- `codex.templateType`
- `codex.overwriteTemplate`
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
  "envScope": "packages",
  "template": true,
  "templateFile": "task-template.md",
  "templateType": "bugfix",
  "openVsCodeByDefault": false
}
```

## Troubleshooting

### Windows locks when removing worktrees

Symptom:

- `git codex rm <task>` fails with directory-not-empty or lock-related errors.

Common causes:

- VS Code window is still open for that worktree.
- A file watcher/dev server is still running.
- A terminal has CWD inside the worktree path.
- Antivirus/indexer still holds a file handle.

Recovery steps:

1. Close VS Code windows opened at that worktree.
2. Stop watchers/dev servers (for example `pnpm dev`, `vite`, `webpack --watch`).
3. Ensure no shell is `cd`'d into the target directory.
4. Retry remove with disk cleanup enabled:
   - `git codex rm <task> --force-delete`
5. If needed, wait a few seconds and retry after lock release.

See also:

- `docs/parallel-codex-workflows.md` for end-to-end usage.
- Phase 2 config (`README.md`) for default worktree/env options.

## Development

```bash
pnpm lint
pnpm test
pnpm build
```

## Versioning and Releases

`git-codex` uses Changesets for semantic versioning and changelog updates.

Release flow:

1. Create a changeset for user-facing changes:
   - `pnpm changeset`
2. Bump version and update `CHANGELOG.md`:
   - `pnpm version-packages`
3. Commit release metadata (version + changelog + changeset updates), then tag:
   - `git tag v<version>`
4. Pre-publish dry-run validation:
   - `pnpm release:check`
5. Publish:
   - `pnpm release`

Helpful checks before publish:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## Parallel Workflow Guide

See `docs/parallel-codex-workflows.md` for a full parallel task workflow from creation to cleanup, including naming, prompt generation, and cleanup hygiene.

## Release Checklist

See `docs/release-checklist.md` for the full semver/changelog/tag/publish procedure, including package dry-run validation.
