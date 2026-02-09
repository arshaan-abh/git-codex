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

- Status: `not implemented`
- Plan source: `future enhancement`
- Description:
  - Add a workflow/command to help users complete a task branch and clean up in one guided flow.
  - Target outcome: reduce manual steps when finishing task worktrees (merge, remove worktree, delete task branch, and optional push).
  - Consider adding a command such as `git codex finish <task>` with safety checks and clear prompts/output.
- Completion criteria:
  - Feature supports a safe merge path into a target base branch.
  - Supports optional cleanup (worktree removal and task branch deletion).
  - Handles non-clean states with clear errors (uncommitted changes, merge conflicts, missing branch/worktree).
  - Includes integration tests and user documentation for the finish flow.
