---
name: version-management
description: Changesets-based version management for @nxsflow/amplify-overtone and @nxsflow/amplify-overtone-client — semver guide, stable workflow, alpha/beta/rc pre-release channels, npm dist-tags, changelog format, and peer dependency ranges. Use when bumping versions, creating changesets, entering pre-release mode, or deciding on bump type.
---

# Version Management: @nxsflow/amplify-overtone Monorepo

How and when versions are bumped. Uses `@changesets/cli` for all version management.

## Tooling

- **Version manager**: `@changesets/cli` (semver, changelog generation, multi-package)
- **Package manager**: pnpm (workspace mode)
- **Repo structure**: pnpm monorepo with independently versioned packages
- **Config**: `.changeset/config.json`

## Published Packages

| Package                            | Path                                | Versioned independently |
| ---------------------------------- | ----------------------------------- | ----------------------- |
| `@nxsflow/amplify-overtone`        | `packages/amplify-overtone/`        | Yes                     |
| `@nxsflow/amplify-overtone-client` | `packages/amplify-overtone-client/` | Yes                     |

Each package has its own `package.json` version and `CHANGELOG.md`. A single changeset can select one or both packages to bump.

---

## Semantic Versioning Guide

| Bump    | When                                                             | Example                             |
| ------- | ---------------------------------------------------------------- | ----------------------------------- |
| `patch` | Bug fix, docs, internal refactor, new optional prop with default | Fix handler timeout config          |
| `minor` | New optional `OvertoneProps` field, new export, new utility      | Add `wireOvertoneToAuth()`          |
| `major` | Rename prop, change `OvertoneResources` shape, remove export     | Rename `config` to `overtoneConfig` |

### Decision Guide

Ask yourself:

- **Can existing consumers upgrade without changing their code?** → patch or minor
- **Does it add new capabilities without breaking existing usage?** → minor
- **Will existing consumers need to change their code?** → major

---

## Stable Workflow

### 1. Create a changeset (on feature branch)

```bash
pnpm changeset
```

Choose bump type (patch/minor/major) and describe the change. A `.changeset/<random-id>.md` file is created. Commit it with the feature:

```bash
git add .changeset/
git commit -m "feat: add new feature

<description>"
```

### 2. Merge to main

Open a PR and merge. CI handles the rest:

- `changesets/action` detects pending changesets
- Creates a "Version Packages" PR that bumps `package.json` and updates `CHANGELOG.md`

### 3. Merge the Version Packages PR

This triggers `pnpm changeset publish` via CI, which:

- Publishes to npm with the `latest` tag
- Creates a git tag (`v0.2.0`)

---

## Pre-release Channels

Three tiers with escalating quality gates.

**Key difference from stable:** On pre-release branches, versioning happens **locally** before pushing. CI only runs `changeset publish`. On main, `changesets/action` handles versioning via a "Version Packages" PR.

### Alpha — early iteration, breaking changes expected

```bash
# 1. Create a branch (must match alpha/**)
git checkout -b alpha/my-feature

# 2. Enter alpha pre-release mode (creates .changeset/pre.json)
pnpm changeset pre enter alpha

# 3. Create changesets as normal
pnpm changeset

# 4. Version locally — bumps package.json (e.g., 0.2.0-alpha.0)
pnpm changeset version

# 5. Commit everything (pre.json, changeset, version bump, changelog)
git add .changeset/ packages/
git commit -m "chore(release): enter alpha, version 0.2.0-alpha.0"

# 6. Push — CI runs `changeset publish` (dist-tag handled by pre mode)
git push -u origin alpha/my-feature
```

Subsequent changes on this branch: add a changeset, run `changeset version` locally (increments to `alpha.1`, `alpha.2`, etc.), commit, and push. CI publishes automatically.

### Beta — feature-complete, needs validation

```bash
git checkout -b beta/my-feature

pnpm changeset pre enter beta
pnpm changeset
pnpm changeset version    # 0.2.0-beta.0

git add .changeset/ packages/
git commit -m "chore(release): enter beta, version 0.2.0-beta.0"
git push -u origin beta/my-feature
```

### RC (optional) — release candidate, final validation

```bash
pnpm changeset pre enter rc
pnpm changeset
pnpm changeset version    # 0.2.0-rc.0

git add .changeset/ packages/
git commit -m "chore(release): enter rc, version 0.2.0-rc.0"
git push -u origin beta/my-feature  # still uses beta/** branch
```

### Exiting Pre-release Mode

When the pre-release is validated and ready for stable:

```bash
# Exit pre-release mode
pnpm changeset pre exit

# Version bumps to stable (0.2.0)
pnpm changeset version

# Commit and merge to main
git add package.json CHANGELOG.md .changeset
git commit -m "chore(release): exit pre-release, bump to 0.2.0"
```

Merging to main triggers the stable release via CI.

**Rules:**
- Pre-release mode (`changeset pre enter`) is only used on feature branches, never on main.
- `pre.json` **must** exist on `alpha/**` and `beta/**` branches — the publish workflow validates this.
- `pre.json` **must not** exist on `main` — the publish workflow rejects it.
- Never pass `--tag` to `changeset publish` when in pre mode — pre mode handles dist-tags automatically.

---

## npm Dist-tags

| Tag      | Channel            | Who installs it                              |
| -------- | ------------------ | -------------------------------------------- |
| `latest` | Stable releases    | Default `pnpm add @nxsflow/amplify-overtone` |
| `alpha`  | Alpha pre-releases | `pnpm add @nxsflow/amplify-overtone@alpha`   |
| `beta`   | Beta pre-releases  | `pnpm add @nxsflow/amplify-overtone@beta`    |

Both `@nxsflow/amplify-overtone` and `@nxsflow/amplify-overtone-client` use the same dist-tag scheme.

**Critical:** Pre-releases must be published from branches with changeset pre mode active (`.changeset/pre.json`). Pre mode automatically sets the correct dist-tag. Never pass `--tag` manually when in pre mode — it causes an error. The publish workflow validates that `pre.json` exists on `alpha/**` and `beta/**` branches.

### Verify Dist-tags

```bash
npm view @nxsflow/amplify-overtone dist-tags
npm view @nxsflow/amplify-overtone-client dist-tags
```

Expected output after an alpha release:

```
{ latest: '0.1.0', alpha: '0.2.0-alpha.0' }
```

---

## Changelog Format

Auto-generated by changesets. Each entry includes the changeset hash and description:

```markdown
## 0.2.0

### Minor Changes

- abc1234: Add wireOvertoneToAuth() utility for wiring overtone to Cognito

### Patch Changes

- def5678: Fix handler timeout configuration

## 0.2.0-beta.0

### Minor Changes

- abc1234: Add wireOvertoneToAuth() utility for wiring overtone to Cognito
```

Do not edit `CHANGELOG.md` manually. If a changeset description needs fixing, edit the `.changeset/*.md` file before running `pnpm changeset version`.

---

## Peer Dependency Ranges

| Package                     | Range     | Rule                                             |
| --------------------------- | --------- | ------------------------------------------------ |
| `aws-cdk-lib`               | `^2.0.0`  | Permissive — consumer controls their CDK version |
| `constructs`                | `^10.0.0` | CDK base class                                   |
| `@aws-amplify/plugin-types` | `^1.0.0`  | ConstructFactory interface                       |

**Rules:**

- Never bundle peer deps — they're in tsup's `external` list
- Test against the minimum supported version, not latest
- Keep ranges permissive (`^2.0.0` not `^2.170.0`) — consumers have their own CDK version constraints
- Bumping a peer dep minimum range is a **major** version bump for this library
