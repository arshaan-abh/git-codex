# git-codex

`git-codex` is a TypeScript CLI that adds a `git codex` subcommand for running tasks in parallel with Git worktrees.

It helps you:

- create a task worktree fast
- work in a separate VS Code window
- merge and clean up safely when done

## Quick Start

Install globally:

```bash
pnpm add -g git-codex
git codex --help
```

Or run without installing:

```bash
pnpm dlx git-codex --help
```

Typical flow:

```bash
# 1) Create task worktree + branch
git codex add auth-fix

# 2) Work in that window/branch

# 3) Merge task into current branch and clean up
git codex finish auth-fix
```

## Demo

Quick walkthrough:

- <https://youtu.be/lZUw3rr1GLY>

## Commands

Global flags:

- `-q, --quiet` less output
- `--json` machine-readable output

Core commands:

- `git codex add <task>` create task branch/worktree
- `git codex finish <task>` merge task branch into current branch, then clean up
- `git codex rm <task>` remove task worktree (optionally delete folder)
- `git codex list` show worktrees
- `git codex open <task>` open an existing task worktree
- `git codex prompt <task> <message>` generate a task prompt

Run `git codex <command> --help` for full flags.

### Most-used flags

For `add`:

- `--base <ref>`
- `--branch-prefix <prefix>`
- `--dir <path>`
- `--reuse`
- `--rm-first`
- `--template --template-type <default|bugfix|feature>`
- `--no-open`

For `finish`:

- `--no-cleanup`
- `--keep-branch`
- `--no-force-delete`

`finish` behavior summary:

- checks current branch is clean
- warns if task worktree has uncommitted changes
- pauses on merge conflicts until resolved/aborted
- cleans up only after merge is actually complete

## Configuration

You can configure defaults via:

- repo file: `.git-codexrc.json`
- global file: `~/.config/git-codex/config.json`
- git config keys (`codex.*`)

Precedence (highest to lowest):

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
  "envScope": "packages",
  "template": true,
  "templateType": "feature",
  "open": true
}
```

## Contributing

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Project notes:

- TypeScript + pnpm
- tests are run with Vitest
- CI runs lint, typecheck, test, and build on Linux/macOS/Windows

## Releases

`git-codex` uses Changesets.

```bash
pnpm changeset
pnpm version-packages
pnpm release:check
pnpm release
```

Detailed guides:

- `docs/release-checklist.md`
- `docs/parallel-codex-workflows.md`

## Troubleshooting (Windows locks)

If `rm` fails because files are locked:

1. close VS Code windows in that worktree
2. stop watchers/dev servers
3. make sure no terminal is inside that folder
4. retry with `git codex rm <task> --force-delete`
