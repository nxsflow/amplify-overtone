# Contributing to Amplify Overtone

## Getting Started

```bash
git clone https://github.com/nxsflow/amplify-overtone.git
cd amplify-overtone
npm install
```

### Development Commands

```bash
npm install          # install all workspace deps
npm run build        # build all packages
npm test             # run all unit tests
npm run lint         # biome check
npm run format       # biome format --write
```

To work on a single package, use the root convenience scripts:

```bash
npm run overtone:build      # build backend package
npm run overtone:test       # test backend package
npm run overtone:typecheck  # typecheck backend package
npm run client:build        # build client package
npm run client:test         # test client package
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
└── test-infra/                  # (private) Amplify Gen 2 app for test infrastructure
    └── amplify/                 # Auth, storage, SES receipt rules, test user provisioning
```

## Testing

### Unit Tests

Run all unit tests across the monorepo:

```bash
npm test
```

#### When to Write Which Test

- **Unit tests** (`test/unit/`): Pure logic — factory behavior, prop validation, error messages. No `App` or `Stack` needed.
- **Construct tests** (`test/construct/`): CloudFormation output assertions using `Template.fromStack()`. Test that the synthesized template contains the expected AWS resources.

### Integration Tests

End-to-end tests deploy real Amplify backends and verify behavior.

```bash
# One-time setup
cp .env.example .env                    # fill in real AWS values (incl. AWS_PROFILE)
npm run test-infra:deploy               # deploy test infrastructure

# Run e2e tests
npm run e2e:test

# Tear down test infrastructure
npm run test-infra:destroy
```

Test infrastructure outputs (user pool IDs, S3 bucket, IAM role ARNs) are written to `packages/test-infra/amplify_outputs.json` by the deploy step. Test user credentials are stored in AWS Secrets Manager and fetched at test runtime.

## Making Changes

### 1. Branch from alpha

```bash
git checkout -b feat/my-feature alpha
```

Feature branches target `alpha` (or `beta` if skipping alpha), never `main` directly.

### 2. Make your changes

Follow the existing code style. Run `npm run format` before committing.

### 3. Add a changeset

Every user-facing change needs a changeset:

```bash
npx changeset
```

Choose the bump type:

- **patch**: Bug fix, docs, internal refactor
- **minor**: New feature, new export, new optional prop
- **major**: Breaking change to public API

Commit the `.changeset/*.md` file with your feature.

### 4. Open a PR

Push your branch and open a pull request against `alpha`. CI runs build, typecheck, test, and lint.

## Versioning

Amplify Overtone uses [Changesets](https://github.com/changesets/changesets) for version management across both published packages (`@nxsflow/amplify-overtone` and `@nxsflow/amplify-overtone-client`). Versions follow [Semantic Versioning](https://semver.org/):

| Bump    | When                                                             | Example                             |
| ------- | ---------------------------------------------------------------- | ----------------------------------- |
| `patch` | Bug fix, docs, internal refactor, new optional prop with default | Fix auth propagation Lambda timeout |
| `minor` | New optional prop, new export, new utility                       | Add `n.pushNotification()` action   |
| `major` | Rename prop, change resource shape, remove export                | Rename schema builder API           |

A single changeset can bump both packages if a change affects both.

### Pre-release Channels

Pre-releases allow testing unreleased versions before they reach `latest`:

| Channel | Version format  | Install command                               |
| ------- | --------------- | --------------------------------------------- |
| Alpha   | `0.2.0-alpha.0` | `npm install @nxsflow/amplify-overtone@alpha` |
| Beta    | `0.2.0-beta.0`  | `npm install @nxsflow/amplify-overtone@beta`  |
| Stable  | `0.2.0`         | `npm install @nxsflow/amplify-overtone`       |

**Alpha** is for early iteration (breaking changes expected). **Beta** is feature-complete and fully validated. **Stable** requires manual approval.

### Branch Strategy

```
feat/foo ──┐
feat/bar ──┤──► alpha ──► beta ──► main
feat/baz ──┘
```

Feature branches merge into `alpha`. When features are validated, `alpha` is promoted to `beta`. `beta` is promoted to `main` for stable release.

## Release Setup (one-time)

Publishing uses **npm Trusted Publishing (OIDC)** — no npm tokens needed. GitHub Actions authenticates directly with npm via short-lived tokens.

To enable stable release approval, create a `release` GitHub environment:

1. Go to repo Settings → Environments → New environment → "release"
2. Add required reviewers (at least one maintainer)

## Release Process

### Stable Releases

1. Promote `beta` → `main` via PR (exit pre-release mode first)
2. CI creates a "Version Packages" PR that bumps `package.json` and updates `CHANGELOG.md`
3. A maintainer reviews and merges the Version Packages PR
4. CI publishes to npm with the `latest` tag

### Pre-releases

1. Merge your feature PR into `alpha`
2. On `alpha`, enter pre-release mode: `npx changeset pre enter alpha`
3. Version: `npx changeset version`
4. Push — CI publishes with the `alpha` dist-tag

Promote `alpha` → `beta`: merge, switch pre-release mode to `beta`, version, push.

## Claude Code Users

This project includes Claude Code skills with deeper guidance:

- **cdk-testing**: Test organization, CDK assertions API, concrete assertion recipes
- **cdk-construct-development**: ConstructFactory pattern, peer deps, build config
- **versioning-and-releases**: Changesets workflow, pre-release channels, dist-tags
