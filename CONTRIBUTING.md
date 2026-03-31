# Contributing to Amplify Overtone

## Getting Started

```bash
git clone https://github.com/nxsflow/amplify-overtone.git
cd amplify-overtone
pnpm install
```

### Development Commands

```bash
pnpm install          # install all workspace deps
pnpm build            # build all packages
pnpm test             # run all unit tests
pnpm lint             # biome check
pnpm format           # biome format --write
```

To work on a single package, use the root convenience scripts:

```bash
pnpm overtone:build      # build backend package
pnpm overtone:test       # test backend package
pnpm overtone:typecheck  # typecheck backend package
pnpm client:build        # build client package
pnpm client:test         # test client package
```

## Project Structure

```
packages/
├── amplify-overtone/            # @nxsflow/amplify-overtone — backend
│   ├── src/                     # Schema builder, CDK constructs, resolvers
│   └── test/
│       ├── unit/                # Factory logic, prop validation
│       └── construct/           # CDK Template assertions
├── amplify-overtone-client/     # @nxsflow/amplify-overtone-client — frontend
│   ├── src/                     # Sync engine, IndexedDB, collaborative API
│   └── test/
├── integration-tests/           # (private) E2E tests
│   └── src/
│       └── e2e/
│           ├── collaborative/   # CRDT-based conflict-free editing
│           ├── auth-inheritance/# Permission propagation
│           ├── local-first/     # Offline-capable sync
│           └── actions/         # Email, push, webhook actions
└── test-infra/                  # (private) CDK app for test infrastructure
    ├── bin/
    ├── lib/                     # Cognito user pool + SES receipt rules
    └── scripts/
```

## Testing

### Unit Tests

Run all unit tests across the monorepo:

```bash
pnpm test
```

#### When to Write Which Test

- **Unit tests** (`test/unit/`): Pure logic — factory behavior, prop validation, error messages. No `App` or `Stack` needed.
- **Construct tests** (`test/construct/`): CloudFormation output assertions using `Template.fromStack()`. Test that the synthesized template contains the expected AWS resources.

### Integration Tests

End-to-end tests deploy real Amplify backends and verify behavior.

```bash
# One-time setup
cp .env.example .env                    # fill in real AWS values (incl. AWS_PROFILE)
pnpm test-infra:deploy                  # deploy test infrastructure

# Run e2e tests
pnpm e2e:test

# Tear down test infrastructure
pnpm test-infra:destroy
```

Test infrastructure outputs (user pool IDs, S3 bucket, test user credentials) are written to `overtone_test_infra.json` by the deploy step. Integration tests read this file automatically.

## Making Changes

### 1. Branch from main

```bash
git checkout -b feat/my-feature main
```

### 2. Make your changes

Follow the existing code style. Run `pnpm format` before committing.

### 3. Add a changeset

Every user-facing change needs a changeset:

```bash
pnpm changeset
```

Choose the bump type:

- **patch**: Bug fix, docs, internal refactor
- **minor**: New feature, new export, new optional prop
- **major**: Breaking change to public API

Commit the `.changeset/*.md` file with your feature.

### 4. Open a PR

Push your branch and open a pull request against `main`. CI runs build, typecheck, test, and lint.

## Versioning

Amplify Overtone uses [Changesets](https://github.com/changesets/changesets) for version management across both published packages (`@nxsflow/amplify-overtone` and `@nxsflow/amplify-overtone-client`). Versions follow [Semantic Versioning](https://semver.org/):

| Bump    | When                                                             | Example                               |
| ------- | ---------------------------------------------------------------- | ------------------------------------- |
| `patch` | Bug fix, docs, internal refactor, new optional prop with default | Fix auth propagation Lambda timeout   |
| `minor` | New optional prop, new export, new utility                       | Add `n.pushNotification()` action     |
| `major` | Rename prop, change resource shape, remove export                | Rename schema builder API             |

A single changeset can bump both packages if a change affects both.

### Pre-release Channels

Pre-releases allow testing unreleased versions before they reach `latest`:

| Channel | Version format  | Install command                              |
| ------- | --------------- | -------------------------------------------- |
| Alpha   | `0.2.0-alpha.0` | `pnpm add @nxsflow/amplify-overtone@alpha`   |
| Beta    | `0.2.0-beta.0`  | `pnpm add @nxsflow/amplify-overtone@beta`    |
| Stable  | `0.2.0`         | `pnpm add @nxsflow/amplify-overtone`          |

**Alpha** is for early iteration (breaking changes expected). **Beta** is feature-complete and fully validated. **Stable** requires manual approval.

## Release Setup (one-time)

Before the CI/CD pipeline can publish to npm, run the setup script:

1. Create an npm account at [npmjs.com](https://www.npmjs.com/) if you don't have one
2. Generate a **Granular Access Token** at npmjs.com → Access Tokens → Generate:
   - **Token name:** `amplify-overtone-ci`
   - **Packages & scopes:** Read and write → Only select: `@nxsflow`
   - **Organizations:** No access
   - **Expiration:** 90 days (maximum for write tokens)
3. Add the token to `.env` as `NPM_TOKEN=npm_...`
4. Run the setup script:

```bash
pnpm release:setup
```

This configures:
- **`NPM_TOKEN`** as a GitHub repository secret (for npm publishing in CI)
- **`production`** GitHub environment with required reviewer (for stable release approval)

## Release Process

### Stable Releases

1. Merge your PR (with changeset) to `main`
2. CI creates a "Version Packages" PR that bumps `package.json` and updates `CHANGELOG.md`
3. A maintainer reviews and merges the Version Packages PR
4. CI publishes to npm with the `latest` tag

### Pre-releases

1. Create a branch: `git checkout -b alpha/my-feature`
2. Enter pre-release mode: `pnpm changeset pre enter alpha`
3. Add changesets: `pnpm changeset`
4. Bump version: `pnpm changeset version`
5. Push to the branch — CI publishes with the `alpha` dist-tag

Replace `alpha` with `beta` for beta releases (which run full test + lint gates).

## Claude Code Users

This project includes Claude Code skills with deeper guidance:

- **cdk-testing**: Test organization, CDK assertions API, concrete assertion recipes
- **cdk-construct-development**: ConstructFactory pattern, peer deps, build config
- **version-management**: Changesets workflow, pre-release channels, dist-tags
- **release-management**: CI/CD pipeline, GitHub Actions, tiered quality gates
