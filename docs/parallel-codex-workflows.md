# Parallel Codex Workflows

This guide shows a practical daily flow for running multiple tasks in parallel with `git-codex`.

## 1) One-time setup

1. Configure your defaults in `.git-codexrc.json`:

```json
{
  "base": "origin/main",
  "branchPrefix": "codex/",
  "copyEnv": true,
  "envGlobs": [".env", ".env.*"],
  "envScope": "packages",
  "open": true
}
```

2. Confirm command availability:

```bash
git codex list
```

Related: README config section (`README.md`).

## 2) Naming conventions

- Use short task slugs with outcome intent:
  - `auth-bugfix`
  - `billing-retry-logic`
  - `docs-windows-faq`
- Keep one worktree per task and avoid reusing task names across unrelated efforts.

## 3) Start parallel tasks

Create three independent worktrees:

```bash
git codex add auth-bugfix --template --template-type bugfix
git codex add billing-feature --template --template-type feature
git codex add release-docs --template --template-type default
```

Useful variants:

- Reuse an existing task path:
  - `git codex add auth-bugfix --reuse`
- Recreate from scratch:
  - `git codex add auth-bugfix --rm-first`

## 4) Open and prompt each task

1. Open a worktree manually when needed:
   - `git codex open auth-bugfix`
2. Generate an initial prompt for your coding agent:
   - `git codex prompt auth-bugfix "Fix login token refresh regression" --copy`

## 5) Track active work

List active worktrees with branch filtering:

```bash
git codex list --pretty
```

For automation:

```bash
git codex list --json
```

## 6) Keep branch hygiene

- Rebase/merge each task branch from `main` as needed.
- Keep PRs small and task-scoped.
- Delete merged task branches after cleanup:
  - `git branch -d codex/<task>`

## 7) Cleanup completed tasks

Remove worktree mapping and folder:

```bash
git codex rm auth-bugfix --force-delete
git codex rm billing-feature --force-delete
git codex rm release-docs --force-delete
```

If Windows reports locked directories, follow the Windows FAQ (`README.md` troubleshooting section).

## 8) Recommended team loop

1. Pull latest `main`.
2. Create one worktree per task with `git codex add`.
3. Start implementation in parallel (human or agent per worktree).
4. Merge completed tasks independently.
5. Run `git codex rm <task> --force-delete` immediately after merge.
