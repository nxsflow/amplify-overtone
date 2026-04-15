# Monorepo Structure Refactor

Align amplify-overtone's project infrastructure with amplify-backend's patterns: package manager, build tooling, test runner, CI/CD, scripts, and developer workflows.

## Decisions

| Area | Current | Target |
|---|---|---|
| Package manager | pnpm | npm workspaces |
| Build | tsup (ESM+CJS) | tsc (ESM only, composite projects) |
| Linter/formatter | Biome | Biome (rules tightened to match amplify-backend conventions) |
| Test runner | vitest | Node test runner (`node:test` + `node:assert`) |
| Coverage | vitest built-in | c8 (85% thresholds) |
| API surface tracking | none | Microsoft API Extractor (API.md per package) |
| CI/CD | 2 simple workflows | Full health_checks pattern with composite actions |
| E2E | single account, .env | multi-account OIDC with random selection |
| Local publishing | none | verdaccio |
| Git hooks | none | husky + lint-staged |

## Phases

Each phase is a separate PR, merged sequentially.

---

### Phase 1: pnpm to npm + Root Config Alignment

**Scope:** Package manager migration and root config harmonization.

**Changes:**
- Delete `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- Add `"workspaces": ["packages/*"]` to root `package.json`
- Replace all `pnpm` references in scripts with `npm` equivalents (`pnpm build` becomes `npm run build`, `pnpm --filter` becomes `npm -w`)
- Replace `workspace:*` protocol in package dependencies with `*` (npm workspace resolution)
- Remove `pnpm.onlyBuiltDependencies` from package.json
- Add `.npmrc` if needed
- Run `npm install` to generate `package-lock.json`
- Add `.husky/` with pre-commit hook running lint-staged
- Add `lint-staged` config to root package.json
- Update `engines` to `"node": "^18.19.0 || ^20.6.0 || >=22"`
- Update `amplify.yml` to use npm instead of pnpm/corepack
- Update Biome rules to match amplify-backend conventions (file naming: snake_case, folder naming: kebab-case where applicable)

**What stays:** Biome as linter/formatter, all package source code, website/docs/test-infra structure.

---

### Phase 2: tsup to tsc + API Extractor

**Scope:** Build tooling migration and public API surface tracking.

**TypeScript build:**
- Add `tsconfig.base.json` at root (ES2022, Node16 module resolution, strict mode, composite: true, declaration: true)
- Update root `tsconfig.json` to extend base with project references
- Each publishable package gets `tsconfig.json` extending base with `outDir: "lib"`, `rootDir: "src"`
- Remove `tsup.config.ts` from each package
- Remove `tsup` dependency
- Update package.json `exports` to point to `lib/` instead of `dist/`
- ESM only output (drop CJS, matching amplify-backend)

**API Extractor:**
- Add `api-extractor.base.json` at root
- Add `api-extractor.json` per publishable package (`amplify-overtone`, `amplify-overtone-client`)
- Add `update:api` and `check:api` scripts
- Add `temp/` to `.gitignore`
- Commit initial `API.md` files

**Build scripts:**
- Root `build` becomes `tsc --build packages/* scripts`
- Add `watch` script: `npm run build -- --watch`

**Lambda handlers:** No impact. `NodejsFunction` in CDK handles bundling at synthesis time via esbuild.

**What stays:** All source code (only output location changes), `esbuild` stays as devDependency for CDK synthesis.

---

### Phase 3: vitest to Node Test Runner + c8

**Scope:** Test framework migration.

**Test framework:**
- Remove `vitest` from all packages
- Rewrite tests to use `node:test` (`describe`, `it`, `before`, `beforeEach`, `after`) and `node:assert`
- API mapping:
  - `vi.fn()` becomes `mock.fn()` from `node:test`
  - `vi.spyOn()` becomes `mock.method()` from `node:test`
  - `expect(x).toBe(y)` becomes `assert.strictEqual(x, y)`
  - `expect(x).toEqual(y)` becomes `assert.deepStrictEqual(x, y)`
  - `expect(x).toThrow()` becomes `assert.throws(() => x)`
- `aws-sdk-client-mock` stays (framework-agnostic)

**Tests must follow amplify-backend patterns** for how a test is prepared (setup/fixtures), executed (assertions), and how teardown is processed (cleanup in `after`/`afterEach`). Use tests from the amplify-backend repository as reference examples.

**Coverage:**
- Add `.c8rc.json` (85% thresholds for lines, functions, branches)
- Exclude: docs, scripts, test files, website, test-infra, integration-tests, `lib/`

**Test scripts:**
- Add `scripts/run_tests.ts` (adapted from amplify-backend)
- Add `scripts/get_unit_test_dir_list.ts`
- Root `test` becomes `npm run test:dir $(tsx scripts/get_unit_test_dir_list.ts)`

**What stays:** Test file locations (`test/unit/`, `test/construct/`), CDK assertions, `aws-sdk-client-mock`, integration-tests (already uses `tsx --test`).

---

### Phase 4: Scripts Infrastructure

**Scope:** Port automation scripts from amplify-backend, adapted for overtone.

**Scripts ported (adapted):**
- `scripts/run_tests.ts` — Node test runner wrapper
- `scripts/get_unit_test_dir_list.ts` — enumerate test directories
- `scripts/concurrent_workspace_script.ts` — parallel builds with skip logic
- `scripts/check_dependencies.ts` — dependency allowlist validation
- `scripts/check_package_lock.ts` — prevent localhost references in lockfile
- `scripts/check_package_json.ts` — ensure publishable packages have `main` field
- `scripts/check_api_extract.ts` — validate API.md files
- `scripts/check_api_changes.ts` — detect breaking API changes between branches
- `scripts/check_changeset_completeness.ts` — ensure changesets for modified packages
- `scripts/check_pr_size.ts` — enforce PR size limits
- `scripts/check_package_versions.ts` — validate expected major versions
- `scripts/check_no_git_diff.ts` — fail on uncommitted changes
- `scripts/publish.ts` / `scripts/publish_runner.ts` — changeset publishing
- `scripts/publish_snapshot.ts` — snapshot releases
- `scripts/publish_local.ts` — publish to local verdaccio
- `scripts/start_npm_proxy.ts` / `scripts/stop_npm_proxy.ts` — verdaccio management
- `scripts/version_runner.ts` — changeset versioning
- `scripts/deprecate_release.ts` / `scripts/restore_release.ts` — emergency rollback
- `scripts/setup_test_project.ts` — scaffold test project
- `scripts/update_tsconfig_refs.ts` — keep tsconfig references in sync
- `scripts/is_version_packages_commit.ts` — detect version-packages commits
- `scripts/copy_template.ts` — create new package from template

**Shared utilities (`scripts/components/`):**
- `git_client.ts`, `npm_client.ts`, `github_client.ts` — external system clients
- `package_json.ts` — read/write package.json
- `dependencies_validator.ts`, `package_lock_validator.ts` — validators
- `release_deprecator.ts`, `release_restorer.ts` — release lifecycle
- `api-changes-validator/` — API breaking change detection
- `sparse_test_matrix_generator.ts` — test matrix generation
- `create_changeset_file.ts` — programmatic changeset creation

**Root config:**
- `verdaccio.config.yaml`
- `scripts/tsconfig.json`
- New npm scripts in root package.json: `check:api`, `check:dependencies`, `check:package-lock`, `vend`, `start:npm-proxy`, `stop:npm-proxy`, `new`, etc.

**Adaptations:** Package names, paths, version expectations, and dependency allowlists adjusted for overtone. PR size limits may differ.

**Deferred to Phase 5:** `dependabot_handle_version_update.ts` (tied to GitHub Actions).

**Deferred to Phase 6:** `cleanup_e2e_resources.ts`, `select_e2e_test_account.ts`, `do_include_e2e.ts`, `generate_sparse_test_matrix.ts` (tied to E2E infrastructure).

---

### Phase 5: GitHub Actions + Dependabot + Verdaccio

**Scope:** Complete CI/CD overhaul.

**Composite actions (`.github/actions/`):**
- `setup_node/action.yml` — Node.js setup with cache
- `install_with_cache/action.yml` — `npm ci` with cache keyed by OS + lockfile + Node version
- `build_with_cache/action.yml` — build + cache keyed by commit SHA
- `restore_build_cache/action.yml` / `restore_install_cache/action.yml` — cache restoration (fail-on-miss)
- `setup_profile/action.yml` — AWS CLI profile from temporary credentials

**Workflows:**

`health_checks.yml` — Primary CI:
- Triggers: PR on main, push to main, weekly schedule, manual dispatch
- Jobs: install, build, test_with_coverage, lint, check_dependencies, check_api_extract, check_api_changes, check_pr_size, check_pr_changesets, check_package_versions, dependency-review, codeql
- Multi-OS/Node matrix where appropriate
- E2E gate via `run-e2e` label (jobs wired in Phase 6)
- On main push: `update_package_versions` (Version Packages PR)
- On Version PR merge: `publish_package_versions` (npm publish)

`canary_checks.yml` — Every-other-day latest-dependency health check (no lockfile).

`snapshot_release.yml` — Snapshot publishing for feature branches.

`deprecate_release.yml` / `restore_release.yml` — Manual dispatch for emergency rollback.

`e2e_resource_cleanup.yml` — Placeholder, wired in Phase 6.

`issue-pending-response.yml` — Auto-label issues on maintainer comment.

**GitHub config:**
- `CODEOWNERS` — default `@nxsflow/amplify-overtone`, elevated approval for API.md + package.json
- `dependabot.yml` — weekly updates, grouped by ecosystem (AWS SDK, CDK, changesets)
- `dependency_review_config.yml` — allowed licenses (Apache, MIT, BSD, ISC, etc.)
- `PULL_REQUEST_TEMPLATE.md` — problem/changes/validation checklist
- `ISSUE_TEMPLATE/` — bug report and feature request forms

**Replaces:** Current `ci.yml` and `publish.yml` removed entirely.

---

### Phase 6: Multi-Account E2E Infrastructure

**Scope:** Production-grade E2E testing with multi-account AWS access.

**AWS account setup (documented, not automated):**
- Multiple AWS test accounts with IAM roles for GitHub Actions OIDC federation
- Dual role pattern: tooling role (setup/teardown) + execution role (test runner)
- Accounts stored as JSON secret in GitHub (`E2E_TEST_ACCOUNTS`)
- Target regions: `us-east-1`, `eu-central-1`

**Composite actions:**
- `select_e2e_account/action.yml` — random selection from account pool
- `run_with_e2e_account/action.yml` — orchestrator: cache restore, account selection, IAM profile setup, test execution with retry (configurable attempts, timeout, delay)

**Scripts:**
- `scripts/select_e2e_test_account.ts`
- `scripts/cleanup_e2e_resources.ts` — delete stale CloudFormation stacks, S3 buckets, Cognito pools, SES identities, IAM roles, SSM parameters
- `scripts/generate_sparse_test_matrix.ts` — minimal matrix covering tests x OS x Node
- `scripts/do_include_e2e.ts` — gate on event type and `run-e2e` label

**Workflows wired:**
- E2E jobs in `health_checks.yml` activated
- `e2e_resource_cleanup.yml` — daily, iterates accounts x regions with retry

**Documentation:**
- `docs/superpowers/specs/github-actions-aws-access.md` — OIDC federation setup, IAM trust policies, role structure, GitHub secrets, step-by-step preparation guide

**What stays:** test-infra package, E2E test code, `.env`-based local dev flow.

---

### Phase 7: CLAUDE.md + Skills

**Scope:** Update project documentation and Claude Code skills to reflect new tooling. Done last.

**CLAUDE.md:**
- Rewrite for npm, tsc, Node test runner + c8
- Update script references and build output paths (`lib/` not `dist/`)
- Add API Extractor, verdaccio, scripts conventions
- Document multi-account E2E setup
- Remove duplicated biome config details

**Skills updated:**
- `commit` — npm changeset commands
- `versioning-and-releases` — npm commands, verdaccio/local publish, deprecation/restore scripts
- `cdk-construct-development` — tsc build, lib/ output, API Extractor workflow
- `cdk-testing` — Node test runner examples, amplify-backend test patterns
- `amplify-custom-resources` — update dist/ to lib/ references
- `amplify-overview` — no changes needed
- `overtone-brand` — no changes needed
