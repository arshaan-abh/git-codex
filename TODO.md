# TODO

Remaining tasks from `PLAN.md` that are not yet implemented or fully closed.

## 1) Worktree Reuse/Recreate Flags

- Status: `implemented` (2026-02-08)
- Plan source: `PLAN.md` section `6) Worktree correctness and edge cases` (`--reuse`, `--rm-first`)
- Description:
  - When `git codex add <task>` resolves a worktree path that already exists, current behavior is to error.
  - Add optional behavior flags:
    - `--reuse`: do not create a new worktree; treat existing path as reusable, validate it, and continue with optional open/prompt actions.
    - `--rm-first`: remove the existing worktree mapping/path first, then recreate using normal add flow.
  - Ensure behavior is deterministic and safe on Windows/macOS/Linux.
- Completion criteria:
  - `add` supports both flags with clear help text.
  - Conflicting flag usage is validated (for example `--reuse` + `--rm-first`).
  - Integration tests cover existing-path scenarios.

## 2) Monorepo Env Scope Support

- Status: `implemented` (2026-02-08)
- Plan source: `PLAN.md` section `6) Worktree correctness and edge cases` (`--env-scope root|all|packages`)
- Description:
  - Current env-copy logic only copies files from repo root.
  - Add monorepo-aware modes:
    - `root`: current behavior.
    - `all`: scan full repository for env-like matches (while filtering unsupported targets).
    - `packages`: scan package/app directories according to configuration or workspace conventions.
  - Keep overwrite semantics consistent with `--overwrite-env`.
- Completion criteria:
  - New option (or equivalent config) implemented and documented.
  - File-copy logic is covered by unit tests and at least one integration case.
  - Output clearly reports copied/skipped files per scope.

## 3) Linting in Local + CI Pipeline

- Status: `implemented` (2026-02-08)
- Plan source: `PLAN.md` section `7) Phase 3` (`lint + test + build`)
- Description:
  - CI currently runs `typecheck`, `test`, and `build`; lint step is missing.
  - Add a linting toolchain (for example ESLint with TypeScript support) and wire it into scripts and CI.
  - Ensure linting is stable across Windows/macOS/Linux.
- Completion criteria:
  - `pnpm lint` script exists and runs cleanly.
  - CI workflow includes lint step before or alongside tests/build.
  - Lint config and ignore patterns are committed.

## 4) Semantic Versioning + Changelog Workflow

- Status: `implemented` (2026-02-08)
- Plan source: `PLAN.md` section `7) Phase 3` (`Semantic versioning + changelog`)
- Description:
  - Add a release/versioning process with consistent semver bumping and changelog updates.
  - Choose and configure a release mechanism (manual or automated), including tagging expectations.
  - Ensure release notes are derived from committed change history.
- Completion criteria:
  - Versioning strategy documented and tooling configured.
  - Changelog file/process exists (for example `CHANGELOG.md`).
  - Release procedure is reproducible by maintainers.

## 5) Documentation Gaps: Windows Locks FAQ

- Status: `implemented` (2026-02-08)
- Plan source: `PLAN.md` section `7) Phase 3` docs (`"Windows locks" FAQ`)
- Description:
  - Add a dedicated troubleshooting section covering Windows directory lock failures during `rm`.
  - Include common causes: open VS Code window, active watcher, terminal CWD in worktree, antivirus/indexer interactions.
  - Include concrete recovery steps and recommended command usage (`--force-delete`).
- Completion criteria:
  - README or dedicated doc includes a Windows locks FAQ section.
  - `rm` behavior and expected recovery steps are documented with actionable commands.

## 6) Documentation Gaps: Parallel Codex Workflows Guide

- Status: `implemented` (2026-02-08)
- Plan source: `PLAN.md` section `7) Phase 3` docs (`"Parallel Codex workflows" guide`)
- Description:
  - Add an end-to-end guide showing how multiple tasks/agents run in parallel using worktrees.
  - Cover setup, task naming conventions, branch hygiene, open/prompt/template usage, and cleanup.
  - Include a recommended day-to-day workflow with examples.
- Completion criteria:
  - A dedicated guide exists in docs/README.
  - Includes concrete command sequences from task creation through cleanup.
  - Cross-links to configuration and troubleshooting sections.

## 7) Publish/Distribution Readiness

- Status: `implemented` (2026-02-08)
- Plan source: `PLAN.md` section `4) NPM packaging & install strategy`
- Description:
  - CLI package shape and `bin` entries exist, but published distribution/release flow is not finalized.
  - Complete package publication readiness for global install and zero-install usage.
  - Ensure package metadata, release process, and install docs are aligned with actual package manager usage.
- Completion criteria:
  - Publish process is documented and tested (dry run or release checklist).
  - Installation docs are consistent and verified for intended usage patterns.
  - Release/tag/version/changelog flow ties into publish step.

## 8) Merge and Finish Task Workflow

- Status: `implemented` (2026-02-10)
- Plan source: `future enhancement`
- Description:
  - Added `git codex finish <task>` to complete task branches in one flow.
  - The command merges the task branch into the currently checked-out branch in the main worktree.
  - On successful merge, default behavior is forced cleanup: remove task worktree and delete task branch.
  - Added options for control: `--no-force-delete`, `--no-cleanup`, and `--keep-branch` (plus `--dir` and `--branch-prefix`).
  - Added safety checks for detached HEAD, dirty working tree, missing task branch, and same-branch merge attempts.
- Completion criteria:
  - `finish` supports a safe merge path into the current checked-out target branch.
  - Supports optional cleanup controls (`--no-cleanup`, `--keep-branch`, `--no-force-delete`).
  - Handles non-clean states with clear errors (uncommitted changes, merge conflicts, missing branch, detached HEAD).
  - Includes integration tests and user documentation for the finish flow.

## 9) Multi-IDE Open Support (Beyond VS Code)

- Status: `not implemented`
- Plan source: `future enhancement`
- Description:
  - Current `add`/`open` behavior launches VS Code via the `code` CLI only.
  - Add IDE provider support so users can open worktrees in other editors/IDEs (for example Cursor and JetBrains IDEs) without custom shell scripts.
  - Introduce provider-aware open abstraction with consistent behavior across commands:
    - `git codex add <task>` (auto-open path)
    - `git codex open <task>` (manual open path)
  - Proposed interface:
    - CLI option such as `--ide <provider>` (`vscode`, `cursor`, `webstorm`, `idea`, etc.).
    - Optional escape hatch like `--open-cmd <command>` for custom environments.
    - Config keys for default IDE/provider and optional custom open command.
  - Ensure cross-platform behavior for Windows/macOS/Linux, including executable-not-found guidance and fallback messaging.
- Completion criteria:
  - `add` and `open` support selecting IDE/provider via CLI and config.
  - Open command construction is centralized and tested for each supported provider.
  - Missing executable/errors return actionable messages (similar quality to current VS Code guidance).
  - Unit tests cover provider resolution and command generation.
  - Integration tests cover non-launch mode (`--no-open`) and JSON event metadata for selected IDE.
  - README/docs include supported IDE matrix, examples, and configuration instructions.

## 10) Finish Workflow: Optional Push + Guided Completion

- Status: `not implemented`
- Plan source: `future enhancement` (split out from item 8)
- Description:
  - Extend `git codex finish <task>` with optional remote push support so finishing can include merge + push in one flow.
  - Add a guided completion mode with explicit confirmations and clear step-by-step output for destructive cleanup.
  - Consider explicit target branch selection (`--into <branch>`) so users do not need to pre-checkout the target branch manually.
- Completion criteria:
  - Supports `--push` (and optional remote/branch selection) with robust error handling.
  - Defines safe order of operations for push vs cleanup and preserves recoverability when push fails.
  - Adds guided confirmation mode (for example `--interactive` / `--yes`) for merge and cleanup actions.
  - Adds tests for push success/failure and guided mode behavior.
  - Documents finish push/guided usage and failure recovery steps.

## Potential Issues (Audit)

## 11) Safety: Prevent Deleting Non-Worktree Directories During Force Cleanup

- Status: `not implemented`
- Plan source: `audit` (`src/commands/rm.ts`, `src/commands/add.ts`)
- Description:
  - Current force-delete flows can remove directories from disk even when the git worktree mapping is missing.
  - In `rm`, if mapping is missing but path exists, `--force-delete` still removes the directory.
  - In `add --rm-first`, the recreate path can also remove an existing directory after force-removal attempts.
  - This is useful for cleanup, but risky if a path collision points at a directory that is not a valid worktree.
  - Add stronger safety checks before destructive delete:
    - verify path is a registered worktree for this repo, or
    - verify path contains worktree metadata tied to this repo.
  - If verification fails, require explicit user confirmation or a dedicated override flag.
- Completion criteria:
  - Force delete does not remove unknown directories by default.
  - Commands emit clear warnings when deletion target is not a verified worktree.
  - Explicit override path exists for advanced users.
  - Integration tests cover verified-worktree delete and non-worktree rejection paths.

## 12) Config Consistency Bug: `open` Command Ignores Configured Default Open Behavior

- Status: `not implemented`
- Plan source: `audit` (`src/lib/config.ts`)
- Description:
  - `resolveOpenConfig` currently resolves `open` as `cliOverrides.open ?? true`.
  - This bypasses configured defaults from `.git-codexrc.json` / git config (`codex.open`).
  - Result: users who set `open: false` in config still get auto-open behavior unless they pass `--no-open` on CLI.
  - Align `open` command config resolution with the same precedence model used elsewhere.
- Completion criteria:
  - `open` command respects config values when CLI flag is omitted.
  - CLI flags still override config.
  - Unit tests assert precedence for CLI, repo config, and global config.
  - README clarifies default `open` behavior across `add` and `open`.

## 13) Validation Gap: `open` Reports Expected Branch but Does Not Verify Actual Worktree Branch

- Status: `not implemented`
- Plan source: `audit` (`src/commands/open.ts`)
- Description:
  - `open` currently computes expected branch name from task slug/prefix and prints it.
  - It does not validate that the target path is a registered worktree for this repo or that the branch actually matches expectation.
  - This can produce misleading success output for detached/mismatched/manual paths.
  - Add branch/mapping verification similar to `add --reuse` safeguards.
- Completion criteria:
  - `open` validates path is a registered worktree in current repo.
  - Command verifies actual branch (or detached state) and reports accurate status.
  - Mismatch behavior is explicit (error or warning mode).
  - Integration tests cover expected branch, mismatch, and detached scenarios.

## 14) Remote Detection Robustness: Base Ref Parsing Can Infer Wrong Remote

- Status: `not implemented`
- Plan source: `audit` (`src/commands/add.ts`)
- Description:
  - Remote inference currently derives remote name from the first slash in `--base`.
  - Local branch names containing slashes (for example `feature/foo`) can be misinterpreted as remote names.
  - This can cause remote-branch existence checks/fetch behavior to target non-existent remotes.
  - Improve inference to only treat `<remote>/<branch>` as remote when `<remote>` is an actual configured remote.
  - Fall back safely to `origin` (or configurable default) when ambiguous.
- Completion criteria:
  - Remote inference checks configured remotes before treating prefix as remote.
  - Ambiguous base refs no longer produce invalid remote lookups.
  - Add tests for local branch refs with slashes and real remote refs.
  - Documentation clarifies base ref and remote resolution behavior.

## 15) Automation Reliability: Interactive `finish` Prompts Can Block Non-Interactive Runs

- Status: `not implemented`
- Plan source: `audit` (`src/commands/finish.ts`, `src/cli.ts`)
- Description:
  - `finish` now prompts on dirty task worktrees and conflict resolution loops.
  - In CI/automation/non-TTY contexts, prompts can block indefinitely if no input is provided.
  - Add explicit non-interactive controls and safe defaults:
    - `--yes` / `--assume-yes` for pre-approved continuation.
    - `--non-interactive` to fail fast instead of waiting for input.
    - detect non-TTY and provide actionable guidance.
  - Include structured event output for prompt decisions in `--json` mode.
- Completion criteria:
  - Non-interactive mode never waits for stdin.
  - `--yes` and `--non-interactive` behaviors are deterministic and documented.
  - JSON output includes machine-readable prompt/decision events.
  - Integration tests cover CI-style non-interactive scenarios.

## Potential Useful Features (Audit)

## 16) New Command: `git codex status` for Task Health Overview

- Status: `not implemented`
- Plan source: `audit`
- Description:
  - Add a status command to inspect task worktrees and branches in one view.
  - Suggested fields:
    - task slug, worktree path, branch, detached/locked flags
    - clean/dirty state
    - merge status vs current branch (merged/unmerged)
    - optional ahead/behind against remote
  - Support both human-readable table and `--json`.
- Completion criteria:
  - `status` command implemented with consistent output shape.
  - Works across multiple worktrees with configurable branch prefix filter.
  - Includes integration tests and docs with examples.

## 17) `finish --dry-run`: Preflight Report Before Merge/Cleanup

- Status: `not implemented`
- Plan source: `audit`
- Description:
  - Add a dry-run mode for `finish` that performs checks and shows intended actions without mutating git state.
  - Preflight should include:
    - current branch
    - task branch existence
    - dirty states (main/task worktree)
    - potential cleanup actions
    - remote push plan (once push support exists)
  - Useful for cautious workflows and CI validations.
- Completion criteria:
  - `finish --dry-run` performs zero write operations.
  - Output clearly distinguishes pass/fail checks and planned actions.
  - JSON output includes deterministic preflight result schema.
  - Tests verify no side effects in dry-run mode.

## 18) Safe Cleanup Mode: Trash/Archive Instead of Immediate Permanent Delete

- Status: `not implemented`
- Plan source: `audit`
- Description:
  - Add optional cleanup strategy that moves task worktree directories to a recoverable trash/archive location instead of immediate hard delete.
  - Useful for accidental deletion recovery and safer adoption in teams.
  - Suggested options:
    - `--cleanup-mode delete|trash`
    - `git codex restore <task>` to restore last trashed path
    - retention policy configuration for archive cleanup.
- Completion criteria:
  - Cleanup mode is configurable per command and per config defaults.
  - Restore workflow is documented and tested.
  - Cross-platform path handling is robust (Windows/macOS/Linux).
  - Security/safety notes are included in docs.

## 19) New Command: `git codex sync <task>` for Base-Branch Updates

- Status: `not implemented`
- Plan source: `audit`
- Description:
  - Add a command to update a task branch from a base branch without manual navigation.
  - Suggested behavior:
    - open task worktree context
    - fetch (optional)
    - merge/rebase from base (`--strategy merge|rebase`)
    - emit summary of conflicts and resulting branch state
  - This reduces manual git commands during long-lived task work.
- Completion criteria:
  - `sync` command supports merge and rebase strategies.
  - Conflict handling and rollback/abort guidance is clear.
  - Tests cover clean sync and conflict scenarios.
  - README includes workflow examples with `add -> sync -> finish`.
