---
name: versioning-and-releases
description: Use when bumping versions, creating changesets, entering/exiting pre-release mode, deciding bump type, publishing to npm, managing alpha/beta branches, promoting features to alpha/beta/stable, or when the user says something is "ready for alpha", "ready for beta", or "ready to release".
---

# Versioning and Releases

Uses `@changesets/cli` for versioning. CI (`.github/workflows/publish.yml`) handles publishing automatically — never publish manually unless CI is broken.

## Packages

| Package                            | npm                                 | Versioned independently |
| ---------------------------------- | ----------------------------------- | ----------------------- |
| `@nxsflow/amplify-overtone`        | `packages/amplify-overtone/`        | Yes                     |
| `@nxsflow/amplify-overtone-client` | `packages/amplify-overtone-client/` | Yes                     |

## Semver Guide

| Bump    | When                                                             | Example                            |
| ------- | ---------------------------------------------------------------- | ---------------------------------- |
| `patch` | Bug fix, docs, internal refactor, new optional prop with default | Fix handler timeout                |
| `minor` | New optional prop, new export, new utility                       | Add `wireOvertoneToAuth()`         |
| `major` | Rename prop, change `OvertoneResources` shape, remove export     | Rename `config` → `overtoneConfig` |

Quick test: Can consumers upgrade without code changes? → patch/minor. New capabilities? → minor. Breaking? → major. Bumping a peer dep minimum range is always **major**.

## Branch Strategy

| Branch  | Purpose                                     | Dist-tag | CI gates                                          |
| ------- | ------------------------------------------- | -------- | ------------------------------------------------- |
| `main`  | Stable releases                             | `latest` | build + typecheck + test + lint + manual approval |
| `alpha` | Integration branch for in-progress features | `alpha`  | build + typecheck                                 |
| `beta`  | Validated features ready for release        | `beta`   | build + typecheck + test + lint                   |

**`alpha` and `beta` are single integration branches, not per-feature.** Feature branches (`feat/*`) merge into `alpha`. When all features in alpha are validated, alpha is promoted to `beta` as a cohort. Beta is promoted to main for stable release.

```
feat/foo ──┐
feat/bar ──┤──► alpha ──► beta ──► main
feat/baz ──┘
```

**PRs target `alpha` (or `beta` if skipping alpha), never `main` directly** for feature work. Promotion between integration branches is done by merging branches and switching pre-release mode.

### Selective Release

If some features aren't ready when you want to release:

1. Revert unfinished features from `alpha`
2. Promote remaining `alpha` → `beta` → `main` (releases as e.g. `0.3.0`)
3. Re-apply unfinished features to `alpha` (starts next version, e.g. `0.4.0-alpha.0`)

This preserves the invariant that `beta` is always a superset of `alpha` at the moment of promotion.

## Workflows

### Feature Development (on `feat/*`)

```bash
# Create changeset with your feature
npx changeset
git add .changeset/ && git commit -m "feat: description"
# Open PR targeting `alpha` (or `beta` if skipping alpha)
```

No `pre.json`, no version bumps on feature branches — just code and changesets.

### "Ready for Alpha" — Merging a Feature into Alpha

When the user says a feature is "ready for alpha":

1. **Merge the feature PR into the `alpha` branch**
2. **If `alpha` doesn't have `pre.json` yet** (first feature), enter alpha pre-release mode:

   ```bash
   git checkout alpha
   npx changeset pre enter alpha
   ```

3. **Version and publish:**

   ```bash
   npx changeset version           # bumps to X.Y.Z-alpha.N
   git add .changeset/ packages/
   git commit -m "chore(release): version X.Y.Z-alpha.N"
   git push                        # CI publishes automatically
   ```

Subsequent features merged into alpha: just run `changeset version`, commit, push. The alpha counter increments automatically.

### "Ready for Beta" — Promoting Alpha to Beta

When the user says features are "ready for beta":

1. **Merge alpha into beta and switch pre-release mode:**

   ```bash
   git checkout beta && git merge alpha
   npx changeset pre exit
   npx changeset pre enter beta
   npx changeset version           # bumps to X.Y.Z-beta.0
   git add .changeset/ packages/
   git commit -m "chore(release): version X.Y.Z-beta.0"
   git push                        # CI publishes automatically
   ```

### "Ready to Release" — Promoting Beta to Main

When the user says it's "ready to release" or "ready for stable":

1. **Exit pre-release mode on the beta branch:**

   ```bash
   git checkout beta
   npx changeset pre exit
   npx changeset version           # bumps to stable X.Y.Z
   git add .changeset/ packages/
   git commit -m "chore(release): exit pre-release, bump to X.Y.Z"
   git push
   ```

2. **Create a PR from `beta` → `main`** — CI runs all four gates
3. **After merge**, `changesets/action` creates a "Version Packages" PR or publishes directly. Stable publish requires manual approval via the `production` GitHub environment.

**Key:** `pre.json` must be removed on the `beta` branch _before_ creating the PR to main. The CI guard validates that `pre.json` does not exist on `main`.

## Rules

- **`pre.json` must exist** on `alpha` and `beta` branches — CI validates this
- **`pre.json` must NOT exist** on `main` — CI rejects it
- **Never pass `--tag`** to `changeset publish` when in pre mode — pre mode handles dist-tags
- **Versioning on pre-release branches is local** (`changeset version` before push); on main, `changesets/action` handles it via a "Version Packages" PR
- **Never edit `CHANGELOG.md` manually** — edit `.changeset/*.md` files before running `changeset version`

## Verify Dist-tags

```bash
npm view @nxsflow/amplify-overtone dist-tags
npm view @nxsflow/amplify-overtone-client dist-tags
```

## Local Publish Workflow (Verdaccio)

Use `npm run vend` to publish packages locally via Verdaccio for manual integration testing before pushing to npm:

```bash
npm run vend          # starts Verdaccio, builds, and publishes packages locally
```

This spins up a local registry at `http://localhost:4873`. Useful for testing package installs in a consumer project without publishing to npm.

## CI Pipeline

See `.github/workflows/health_checks.yml` for implementation. Key behaviors:

- **main push**: `changesets/action` creates a "Version Packages" PR (bumps versions, updates changelogs). Merging that PR publishes to npm with `latest` tag after manual approval (`release` environment).
- **alpha/beta push**: `publish_prerelease` job runs `changeset publish` directly. Pre mode sets the dist-tag automatically.
- **PRs to main, alpha, or beta**: CI runs all gates (build, typecheck, test, lint, API checks).
- **Publishing uses npm Trusted Publishing (OIDC)** — no npm token needed.

## Rollback

| Scenario        | Action                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| Within 72 hours | `npm unpublish @nxsflow/amplify-overtone@X.Y.Z`                               |
| After 72 hours  | `npm deprecate @nxsflow/amplify-overtone@X.Y.Z "use X.Y.Z+1"` + publish patch |
| Pre-release     | Publish the next pre-release number (`-alpha.1` replaces `-alpha.0`)          |

## Peer Dependency Ranges

| Package                     | Range     | Rule                                       |
| --------------------------- | --------- | ------------------------------------------ |
| `aws-cdk-lib`               | `^2.0.0`  | Permissive — consumer controls CDK version |
| `constructs`                | `^10.0.0` | CDK base class                             |
| `@aws-amplify/plugin-types` | `^1.0.0`  | ConstructFactory interface                 |

Never bundle peer deps. Keep ranges permissive.
