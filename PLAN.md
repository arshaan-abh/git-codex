# Git Codex Plan

## 0) Product definition

**Goal:** a Git subcommand that makes it easy for multiple people (and multiple Codex/agent instances) to work in parallel on one repo by:

- creating **one worktree per task** (folder + branch)
- optionally opening each worktree in a **new VS Code window**
- copying **“.env-like” files** into each worktree for local runtime parity

Primary UX:

- `git codex add <task> --open`
- `git codex rm <task>`
- `git codex list`

---

## 1) CLI behavior and UX

### Commands

**`git codex add <task>`**

- Detect repo root from _any_ subdirectory: `git rev-parse --show-toplevel`
- Determine:
  - `repoRoot` (main checkout)
  - `parentDir = dirname(repoRoot)`
  - `repoName = basename(repoRoot)`
  - `branch = codex/<task>` (configurable)
  - `worktreePath = <parentDir>/<repoName>-<task>` (configurable)
  - `baseRef = origin/main` (configurable)

- `git fetch` (optional flag)
- Create worktree:
  - If branch doesn’t exist: `git worktree add -b <branch> <worktreePath> <baseRef>`
  - If branch exists: `git worktree add <worktreePath> <branch>`

- Copy env-like files from `repoRoot` → `worktreePath` (see section 2)
- If `--open`: run `code -n <worktreePath>`
- Print next steps (e.g., “Start Codex in this window, branch is `codex/<task>`”)

**`git codex rm <task>`**

- Compute the same `worktreePath` deterministically from `<task>` (and config)
- Attempt: `git worktree remove <worktreePath>`
- If Windows “Directory not empty” happens:
  - Explain likely causes (VS Code open, watcher running, terminal in folder)
  - Provide an opt-in `--force-delete` that deletes the folder after removing the worktree mapping (or, if mapping already removed, just deletes the folder)

- Run `git worktree prune` afterwards

**`git codex list`**

- Proxy: `git worktree list`
- Optionally add “pretty” filtering: show only `codex/*` branches/worktrees

### Flags (MVP)

- `--open` (open VS Code new window, default on)
- `--base <ref>` (default `origin/main`)
- `--branch-prefix <prefix>` (default `codex/`)
- `--dir <path>` (default: sibling of repo root)
- `--copy-env / --no-copy-env`
- `--env-globs ".env,.env.*"` (defaults)
- `--overwrite-env` (default off)
- `--fetch / --no-fetch` (default on)

---

## 2) Env-file copying spec (“.env-like files”)

### Default rule (simple, safe)

From **repo root only**, copy:

- `.env`
- `.env.*` (e.g. `.env.local`, `.env.development.local`, etc.)

Recommended extras (optional flags/config):

- `.npmrc` (common for private registries)
- `.tool-versions` (asdf)
- `.python-version`, `.ruby-version`

Behavior:

- Copy **only files that exist** and are regular files
- Do **not overwrite** existing files unless `--overwrite-env`
- Print what was copied (and what was skipped)

Why this is consistent with “AI-era workflow”: these local config files often remain untracked/ignored, so worktrees need a bootstrap step.

---

## 3) Repository-level config (team-friendly)

Support a config file (any one of these):

- `.git-codexrc.json`
- or `git config` keys (`codex.base`, `codex.dir`, etc.)

Example `.git-codexrc.json`:

```json
{
  "base": "origin/main",
  "branchPrefix": "codex/",
  "dirStrategy": "sibling",
  "envGlobs": [".env", ".env.*", ".npmrc"],
  "openVsCodeByDefault": true
}
```

Resolution precedence:

1. CLI flags
2. repo config file
3. global config (`~/.config/git-codex/config.json` or `git config --global`)
4. defaults

---

## 4) NPM packaging & install strategy

### Package shape

- Name: `git-codex`
- Publish as a Node CLI (TS recommended)
- `bin` mapping in `package.json`:
  - `"git-codex": "dist/cli.js"`
  - (optional) also `"codex-wt": "dist/cli.js"` for standalone usage

Why this works: Git subcommands are discovered by executable name `git-<x>` on PATH, so installing globally enables `git codex …`.

### Supported execution modes

- Global install: `npm i -g git-codex` → `git codex …`
- Zero-install: `npx git-codex …` (works, but “git codex …” ergonomics is best with global)

---

## 5) VS Code integration

When `--open` (or default):

- Call `code -n <worktreePath>`
- Detect missing `code` CLI and print the VS Code command-palette instruction (“Install ‘code’ command in PATH”)

(As discussed earlier) don’t try to auto-send the first message to the VS Code Codex chat unless you intentionally choose a brittle UI automation route; keep the tool stable.

---

## 6) Worktree correctness and edge cases

### Branch/worktree existence

- If directory exists already:
  - default: error with helpful message
  - optional: `--reuse` (open existing) or `--rm-first` (remove & recreate)

### Windows deletion failures

- Expect “Directory not empty” regularly if VS Code/watchers are running (you already saw this)
- Your `rm` should:
  1. remove mapping (`git worktree remove`)
  2. if folder still exists and `--force-delete`, try recursive delete
  3. if delete fails, print “close VS Code + stop watchers + ensure no terminal is in that folder”

### Monorepos

If your org uses env files inside packages/apps, add a later phase:

- `--env-scope root|all|packages`
- or config listing additional directories to scan for env patterns

---

## 7) Implementation plan (phased)

### Phase 1 — MVP (1–2 evenings)

- CLI skeleton (`commander`/`yargs`)
- `add/rm/list` implemented using `execa`
- repo root detection (`git rev-parse --show-toplevel`)
- deterministic path + branch naming
- env copy for `.env` + `.env.*`
- VS Code open via `code -n`
- basic error messages

### Phase 2 — Team-ready hardening

- Config file support + global defaults
- Better branch existence logic (handle existing local/remote branch)
- `--force-delete` and improved Windows guidance
- `--overwrite-env`, `--env-globs`
- Logging levels (`--quiet`, `--json` for CI)

### Phase 3 — Quality & release engineering

- Tests:
  - unit tests for path/branch naming and env glob logic
  - integration tests in temp git repos (create repo, create worktrees, remove)

- CI (GitHub Actions):
  - windows + mac + linux
  - lint + test + build

- Semantic versioning + changelog
- Docs:
  - README quickstart
  - “Windows locks” FAQ
  - “Parallel Codex workflows” guide

### Phase 4 — Nice-to-haves

- `git codex open <task>` (open existing)
- `git codex prompt <task> "<msg>"` that _prints/copies_ the initial prompt (reliable)
- Optional templates: generate per-task `.codex/` instructions files for the agent
