# Release Checklist

Use this checklist for every `git-codex` release.

## 1) Prepare release metadata

1. Add/update changesets for user-facing changes:
   - `pnpm changeset`
2. Apply semver bumps and changelog updates:
   - `pnpm version-packages`
3. Review:
   - `package.json` version
   - `CHANGELOG.md` updates
   - `.changeset/` entries consumed/created as expected

## 2) Validate quality and package shape

Run:

```bash
pnpm release:check
```

This validates:

- lint
- typecheck
- tests
- build
- npm package contents (`pnpm pack --dry-run`)

## 3) Commit and tag

1. Commit release artifacts:
   - version bump(s)
   - changelog updates
   - remaining `.changeset` changes
2. Create tag:
   - `git tag v<version>`
3. Push commit + tag to remote.

## 4) Publish

Run:

```bash
pnpm release
```

`pnpm release` runs build + `changeset publish`, which publishes the package based on version/changelog state.

## 5) Post-publish sanity checks

1. Verify install:
   - `pnpm add -g git-codex`
2. Verify command:
   - `git codex --help`
3. Confirm npm package page reflects expected version and release notes.
