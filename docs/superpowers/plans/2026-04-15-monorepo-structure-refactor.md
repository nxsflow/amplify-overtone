# Monorepo Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align amplify-overtone's infrastructure with amplify-backend patterns across 7 sequential PRs.

**Architecture:** Each phase produces a self-contained PR. Phases are sequential — each builds on the previous. The work transforms the project from pnpm/tsup/vitest to npm/tsc/node:test with full CI/CD, scripts, and multi-account E2E.

**Tech Stack:** npm workspaces, TypeScript (tsc composite), Node test runner, c8 coverage, Microsoft API Extractor, GitHub Actions, verdaccio, AWS OIDC federation.

**Reference repository:** `/Users/ckoch/Development/aws-amplify/amplify-backend` — the source of patterns being adopted.

---

## Phase 1: pnpm to npm + Root Config Alignment

### Task 1.1: Remove pnpm and Set Up npm Workspaces

**Files:**

- Delete: `pnpm-workspace.yaml`
- Delete: `pnpm-lock.yaml`
- Modify: `package.json` (root)
- Modify: `packages/integration-tests/package.json`

- [ ] **Step 1: Delete pnpm configuration files**

```bash
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
rm pnpm-workspace.yaml pnpm-lock.yaml
```

- [ ] **Step 2: Update root package.json**

Replace the entire root `package.json` with npm workspace configuration. Key changes:

- Remove `packageManager` field
- Remove `pnpm.onlyBuiltDependencies`
- Add `"workspaces": ["packages/*"]`
- Replace all `pnpm` script commands with `npm` equivalents
- Update `engines` field
- Add `lint-staged` config
- Add `husky` to devDependencies

```json
{
    "name": "amplify-overtone",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "license": "Apache-2.0",
    "repository": {
        "type": "git",
        "url": "https://github.com/nxsflow/amplify-overtone.git"
    },
    "scripts": {
        "build": "tsc --build packages/*",
        "test": "npm run test:dir $(tsx scripts/get_unit_test_dir_list.ts)",
        "test:dir": "tsx scripts/run_tests.ts",
        "test:coverage:threshold": "c8 npm run test",
        "test:scripts": "npm run test:dir $(glob --cwd=scripts --absolute **/*.test.ts)",
        "typecheck": "tsc --build packages/*",
        "lint": "biome check --error-on-warnings . && tsx scripts/check_package_json.ts",
        "lint:fix": "biome check --write . && biome format --write .",
        "format": "biome format --write .",
        "check:api": "npm run update:api && tsx scripts/check_api_extract.ts",
        "check:dependencies": "tsx scripts/check_dependencies.ts",
        "check:package-lock": "tsx scripts/check_package_lock.ts",
        "check:package-versions": "tsx scripts/check_package_versions.ts",
        "check:tsconfig-refs": "npm run update:tsconfig-refs && tsx scripts/check_no_git_diff.ts",
        "clean": "npm run clean:build && npm run clean:npm-proxy && rimraf --glob node_modules coverage packages/*/node_modules",
        "clean:build": "rimraf --glob packages/*/lib packages/*/tsconfig.tsbuildinfo",
        "clean:npm-proxy": "npm run stop:npm-proxy && rimraf verdaccio-cache verdaccio-logs.txt",
        "diff:check": "tsx scripts/check_pr_size.ts",
        "new": "tsx scripts/copy_template.ts",
        "prepare": "husky",
        "publish": "tsx scripts/publish.ts",
        "publish:local": "tsx scripts/publish_local.ts",
        "publish:snapshot": "tsx scripts/publish_snapshot.ts",
        "start:npm-proxy": "tsx scripts/start_npm_proxy.ts",
        "stop:npm-proxy": "tsx scripts/stop_npm_proxy.ts",
        "update:api": "npm run build && api-extractor run --local -c packages/amplify-overtone/api-extractor.json && api-extractor run --local -c packages/amplify-overtone-client/api-extractor.json",
        "update:tsconfig-refs": "tsx scripts/update_tsconfig_refs.ts",
        "vend": "npm run start:npm-proxy && npm run publish:local",
        "watch": "npm run build -- --watch",
        "aws:login": "./scripts/aws-login.sh",
        "overtone:build": "npm run build -w @nxsflow/amplify-overtone",
        "overtone:test": "npm run test -w @nxsflow/amplify-overtone",
        "overtone:typecheck": "npm run typecheck -w @nxsflow/amplify-overtone",
        "client:build": "npm run build -w @nxsflow/amplify-overtone-client",
        "client:test": "npm run test -w @nxsflow/amplify-overtone-client",
        "client:typecheck": "npm run typecheck -w @nxsflow/amplify-overtone-client",
        "test-infra:typecheck": "npm run typecheck -w @nxsflow/test-infra",
        "test-infra:deploy": "npm run deploy -w @nxsflow/test-infra",
        "test-infra:destroy": "npm run destroy -w @nxsflow/test-infra",
        "e2e:typecheck": "npm run typecheck -w @nxsflow/integration-tests",
        "e2e:test": "npm run test:e2e -w @nxsflow/integration-tests",
        "website:dev": "npm run dev -w @nxsflow/website",
        "website:build": "npm run build -w @nxsflow/website",
        "website:typecheck": "npm run typecheck -w @nxsflow/website"
    },
    "engines": {
        "node": "^18.19.0 || ^20.6.0 || >=22"
    },
    "workspaces": [
        "packages/*"
    ],
    "devDependencies": {
        "@biomejs/biome": "2.4.10",
        "@changesets/cli": "^2.30.0",
        "@changesets/get-release-plan": "^4.0.0",
        "@changesets/types": "^6.0.0",
        "@microsoft/api-extractor": "^7.57.7",
        "@octokit/rest": "^22.0.1",
        "c8": "^10.1.3",
        "esbuild": "^0.27.7",
        "glob": "^11.1.0",
        "husky": "^9.1.7",
        "lint-staged": "^15.2.10",
        "rimraf": "^6.0.1",
        "semver": "^7.5.4",
        "tsx": "4.19.4",
        "typescript": "^5.9.3",
        "verdaccio": "^6.2.5"
    },
    "lint-staged": {
        "*.ts": [
            "biome check --write",
            "biome format --write"
        ],
        "*.json": "biome format --write",
        "*.yml": "biome format --write"
    }
}
```

Note: Many scripts reference files that don't exist yet (e.g., `scripts/run_tests.ts`). Those will be created in later phases. For now, the scripts that won't work yet are: `test`, `test:dir`, `test:coverage:threshold`, `test:scripts`, `check:*`, `diff:check`, `new`, `publish*`, `start:npm-proxy`, `stop:npm-proxy`, `update:*`, `vend`, `clean:npm-proxy`. The core `build`, `typecheck`, `lint`, `format` scripts will work after Phase 2.

- [ ] **Step 3: Update workspace dependency references**

In `packages/integration-tests/package.json`, change `workspace:*` to `*`:

Replace:
```json
"@nxsflow/amplify-overtone": "workspace:*",
"@nxsflow/amplify-overtone-client": "workspace:*",
```

With:
```json
"@nxsflow/amplify-overtone": "*",
"@nxsflow/amplify-overtone-client": "*",
```

- [ ] **Step 4: Update individual package scripts from pnpm to npm**

In `packages/amplify-overtone/package.json`, update scripts (build/test scripts will be updated in Phase 2 and 3, just remove pnpm-specific patterns for now).

In `packages/test-infra/package.json`, change lint/format scripts:

Replace:
```json
"lint": "biome check",
"format": "biome format --write",
```

These stay the same — they're already npm-compatible.

- [ ] **Step 5: Generate package-lock.json**

```bash
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
rm -rf node_modules packages/*/node_modules
npm install
```

Verify the lockfile was created:
```bash
ls -la package-lock.json
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "ref: migrate from pnpm to npm workspaces

Remove pnpm-workspace.yaml and pnpm-lock.yaml. Add npm workspaces
config. Replace workspace:* with * for npm resolution. Generate
package-lock.json.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.2: Add Husky + lint-staged

**Files:**

- Create: `.husky/pre-commit`
- Modify: `.gitignore` (remove pnpm-store, add verdaccio)

- [ ] **Step 1: Initialize husky**

```bash
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
npx husky init
```

- [ ] **Step 2: Write pre-commit hook**

Replace the contents of `.husky/pre-commit` with:

```bash
npx lint-staged
```

Note: amplify-backend runs additional checks in pre-commit (update:create-amplify-deps, update:tsconfig-refs, check:package-lock). We'll add those in Phase 4 when the scripts exist.

- [ ] **Step 3: Update .gitignore**

Replace pnpm-specific entries and add npm/verdaccio entries. Change:

```
# pnpm
.pnpm-store/
```

To:

```
# npm
.npmrc

# verdaccio
verdaccio-cache
verdaccio-logs.txt
```

Also add after the `dist/` line:

```
lib/
```

And add after `coverage/`:

```
temp/
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "build: add husky pre-commit hook with lint-staged

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.3: Update amplify.yml for npm

**Files:**

- Modify: `amplify.yml`

- [ ] **Step 1: Update amplify.yml**

Replace the entire file with:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm use 22
        - npm ci
    build:
      commands:
        - npm run website:build
  artifacts:
    baseDirectory: packages/website/out
    files:
      - "**/*"
  cache:
    paths:
      - node_modules
```

- [ ] **Step 2: Commit**

```bash
git add amplify.yml
git commit -m "build: update amplify.yml for npm

Remove corepack/pnpm setup, use npm ci and npm run.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 1.4: Update Biome Rules

**Files:**

- Modify: `biome.json`

- [ ] **Step 1: Update biome.json to match amplify-backend conventions**

amplify-backend enforces snake_case for files and kebab-case for folders via ESLint. We can approximate this with Biome's naming conventions. Update the linter rules and add file ignore for `lib/`:

```json
{
    "$schema": "https://biomejs.dev/schemas/2.4.10/schema.json",
    "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
    "files": {
        "ignoreUnknown": true,
        "includes": [
            "**",
            "!dist",
            "!lib",
            "!node_modules",
            "!*.d.ts",
            "!.changeset",
            ".claude/**",
            "!.next",
            "!.source",
            "!temp",
            "!verdaccio-cache",
            "!coverage"
        ]
    },
    "formatter": {
        "enabled": true,
        "indentStyle": "space",
        "indentWidth": 4,
        "lineWidth": 100
    },
    "linter": {
        "enabled": true,
        "rules": {
            "recommended": true,
            "suspicious": {
                "noUnknownAtRules": "error",
                "noThenProperty": "off"
            },
            "style": {
                "useImportType": "error",
                "noNonNullAssertion": "off",
                "useNodejsImportProtocol": "error",
                "noDefaultExport": "error"
            },
            "complexity": {
                "noStaticOnlyClass": "error"
            }
        }
    },
    "assist": { "actions": { "source": { "organizeImports": "on" } } },
    "javascript": {
        "formatter": {
            "quoteStyle": "double",
            "trailingCommas": "all",
            "semicolons": "always"
        }
    },
    "overrides": [
        {
            "includes": ["*.config.ts", "*.config.js", "next.config.ts"],
            "linter": {
                "rules": {
                    "style": {
                        "noDefaultExport": "off"
                    }
                }
            }
        }
    ]
}
```

Key additions matching amplify-backend:
- `useNodejsImportProtocol`: forces `node:` prefix (matches amplify-backend's Node16 resolution)
- `noDefaultExport`: prefer named exports (matches amplify-backend pattern)
- `noStaticOnlyClass`: matches amplify-backend's `@shopify/no-fully-static-class`
- Override for config files that require default exports
- Added `lib`, `temp`, `verdaccio-cache`, `coverage` to ignores

- [ ] **Step 2: Run the linter to check for violations**

```bash
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
npx biome check .
```

Fix any violations that arise from the new rules. The most likely issues:
- Missing `node:` prefix on built-in imports → add `node:` prefix
- Default exports in non-config files → convert to named exports

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "build: tighten biome rules to match amplify-backend conventions

Add useNodejsImportProtocol, noDefaultExport, noStaticOnlyClass.
Add overrides for config files. Update file ignores.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2: tsup to tsc + API Extractor

### Task 2.1: Create tsconfig.base.json and Update Root tsconfig

**Files:**

- Create: `tsconfig.base.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Create tsconfig.base.json**

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "Node16",
        "moduleResolution": "Node16",
        "lib": ["ES2022"],
        "composite": true,
        "declaration": true,
        "declarationMap": true,
        "strict": true,
        "exactOptionalPropertyTypes": true,
        "noUncheckedIndexedAccess": true,
        "noImplicitOverride": true,
        "noImplicitReturns": true,
        "noUnusedLocals": false,
        "noUnusedParameters": false,
        "skipLibCheck": true,
        "esModuleInterop": true,
        "resolveJsonModule": true,
        "inlineSourceMap": true,
        "inlineSources": true
    },
    "exclude": ["**/node_modules", "**/lib"]
}
```

- [ ] **Step 2: Update root tsconfig.json**

Replace with:

```json
{
    "extends": "./tsconfig.base.json"
}
```

This is intentionally minimal — the root tsconfig just extends the base. Individual packages define their own `rootDir`/`outDir` and references.

- [ ] **Step 3: Commit**

```bash
git add tsconfig.base.json tsconfig.json
git commit -m "build: add tsconfig.base.json with composite project config

Node16 module resolution, strict mode, composite builds matching
amplify-backend patterns.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.2: Update Package TypeScript Configs

**Files:**

- Modify: `packages/amplify-overtone/tsconfig.json`
- Modify: `packages/amplify-overtone-client/tsconfig.json`
- Modify: `packages/integration-tests/tsconfig.json` (if exists, or create)
- Modify: `packages/test-infra/tsconfig.json` (if exists)

- [ ] **Step 1: Update amplify-overtone tsconfig.json**

```json
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "rootDir": "src",
        "outDir": "lib"
    }
}
```

Note: We remove `"include": ["src", "test"]` because with composite builds, `rootDir` controls what gets compiled. Tests will be compiled separately or run via tsx.

- [ ] **Step 2: Update amplify-overtone-client tsconfig.json**

```json
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "rootDir": "src",
        "outDir": "lib"
    }
}
```

- [ ] **Step 3: Check and update remaining package tsconfigs**

For `packages/integration-tests/tsconfig.json` — this is a private package that uses tsx to run tests directly, so it doesn't need composite build output:

```json
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "composite": false,
        "noEmit": true
    },
    "include": ["src"]
}
```

For `packages/test-infra/tsconfig.json` — same pattern, private, no build output:

```json
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "composite": false,
        "noEmit": true
    },
    "include": ["amplify"]
}
```

For `packages/website/tsconfig.json` — leave unchanged, Next.js manages its own tsconfig.

For `packages/docs/` — no tsconfig needed (markdown only).

- [ ] **Step 4: Commit**

```bash
git add packages/*/tsconfig.json
git commit -m "build: update package tsconfigs for tsc composite builds

Set rootDir/outDir for publishable packages. Set noEmit for private
packages.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.3: Remove tsup, Update Package Exports

**Files:**

- Delete: `packages/amplify-overtone/tsup.config.ts`
- Delete: `packages/amplify-overtone-client/tsup.config.ts`
- Modify: `packages/amplify-overtone/package.json`
- Modify: `packages/amplify-overtone-client/package.json`

- [ ] **Step 1: Delete tsup config files**

```bash
rm packages/amplify-overtone/tsup.config.ts
rm packages/amplify-overtone-client/tsup.config.ts
```

- [ ] **Step 2: Update amplify-overtone package.json**

Key changes: remove tsup, remove CJS output, point to `lib/` instead of `dist/`, update scripts, update `files` field.

```json
{
    "name": "@nxsflow/amplify-overtone",
    "version": "0.3.0-beta.9",
    "description": "Extend AWS Amplify Gen 2 with email, collaboration, and local-first support — backend constructs and resolvers",
    "type": "module",
    "license": "Apache-2.0",
    "repository": {
        "type": "git",
        "url": "https://github.com/nxsflow/amplify-overtone.git",
        "directory": "packages/amplify-overtone"
    },
    "exports": {
        ".": {
            "types": "./lib/index.d.ts",
            "import": "./lib/index.js"
        },
        "./email": {
            "types": "./lib/email/index.d.ts",
            "import": "./lib/email/index.js"
        }
    },
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": [
        "lib",
        "src/email/functions",
        "src/email/templates",
        "README.md"
    ],
    "scripts": {
        "build": "tsc --build",
        "watch": "tsc --build --watch",
        "test": "node --test lib/test/**/*.test.js",
        "typecheck": "tsc --build"
    },
    "peerDependencies": {
        "@aws-amplify/backend": "^1.0.0",
        "@aws-amplify/plugin-types": "^1.0.0",
        "aws-cdk-lib": "^2.0.0",
        "constructs": "^10.0.0"
    },
    "devDependencies": {
        "@aws-amplify/backend": "^1.21.0",
        "@aws-amplify/plugin-types": "^1.12.0",
        "@aws-sdk/client-cognito-identity-provider": "^3.1019.0",
        "@aws-sdk/client-sesv2": "^3.1019.0",
        "@types/node": "^18.15.11",
        "aws-cdk-lib": "^2.170.0",
        "aws-sdk-client-mock": "^4.1.0",
        "constructs": "^10.4.2",
        "esbuild": "^0.27.0"
    }
}
```

Key changes:
- Removed `tsup` from devDependencies
- Removed `vitest` and `@vitest/coverage-v8` (Phase 3 handles test migration)
- Changed `dist/` to `lib/` everywhere
- Removed CJS exports (`require` entries)
- Build script is now `tsc --build`
- Downgraded `@types/node` to `^18.15.11` to match engine minimum
- Test script is a placeholder — will be updated in Phase 3

- [ ] **Step 3: Update amplify-overtone-client package.json**

```json
{
    "name": "@nxsflow/amplify-overtone-client",
    "version": "0.1.0",
    "description": "Extend AWS Amplify Gen 2 with email, collaboration, and local-first support — client runtime",
    "type": "module",
    "license": "Apache-2.0",
    "repository": {
        "type": "git",
        "url": "https://github.com/nxsflow/amplify-overtone.git",
        "directory": "packages/amplify-overtone-client"
    },
    "exports": {
        ".": {
            "types": "./lib/index.d.ts",
            "import": "./lib/index.js"
        }
    },
    "main": "lib/index.js",
    "types": "lib/index.d.ts",
    "files": [
        "lib"
    ],
    "scripts": {
        "build": "tsc --build",
        "watch": "tsc --build --watch",
        "test": "echo 'No tests yet'",
        "typecheck": "tsc --build"
    },
    "peerDependencies": {
        "aws-amplify": "^6.0.0"
    },
    "devDependencies": {
        "@types/node": "^18.15.11",
        "aws-amplify": "^6.16.3"
    }
}
```

- [ ] **Step 4: Update source code for Node16 module resolution**

With `moduleResolution: "Node16"`, all relative imports must include the `.js` extension. Check if the source already uses `.js` extensions (the CLAUDE.md mentioned this convention). If not, update all relative imports:

```bash
# Check for bare relative imports (missing .js extension)
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
grep -r "from '\.\." packages/amplify-overtone/src/ | grep -v "\.js'" | grep -v node_modules || echo "All imports have .js extensions"
grep -r 'from "\.\.' packages/amplify-overtone/src/ | grep -v '\.js"' | grep -v node_modules || echo "All imports have .js extensions"
```

If any imports are missing `.js` extensions, add them. For example:
- `from "./types"` → `from "./types.js"`
- `from "../email/construct"` → `from "../email/construct.js"`

Do the same for `packages/amplify-overtone-client/src/`.

- [ ] **Step 5: Move test files into src directory**

amplify-backend compiles tests alongside source code (they live under `src/`). However, overtone has tests in a separate `test/` directory. Since we're using `rootDir: "src"`, tests in `test/` won't be compiled by tsc.

We have two options:
1. Move `test/` into `src/` (matching amplify-backend)
2. Keep `test/` separate and run them via `tsx` (bypassing tsc for tests)

Option 2 is simpler and avoids shipping test files. Keep tests in `test/` and run them via `tsx` (which handles TypeScript on the fly). Update the test script:

In `packages/amplify-overtone/package.json`, the test script will be:
```
"test": "tsx --test test/**/*.test.ts"
```

This will be finalized in Phase 3 when we migrate the test framework.

- [ ] **Step 6: Build and verify**

```bash
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
rm -rf packages/amplify-overtone/dist packages/amplify-overtone-client/dist
rm -rf packages/amplify-overtone/lib packages/amplify-overtone-client/lib
npm run build
```

Verify output:
```bash
ls packages/amplify-overtone/lib/
ls packages/amplify-overtone-client/lib/
```

Expected: `.js`, `.d.ts`, `.d.ts.map` files in `lib/` directories.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "build: migrate from tsup to tsc composite builds

Remove tsup configs and dependency. Switch to ESM-only output in lib/.
Update package.json exports and files fields.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2.4: Add API Extractor

**Files:**

- Create: `api-extractor.base.json`
- Create: `packages/amplify-overtone/api-extractor.json`
- Create: `packages/amplify-overtone-client/api-extractor.json`

- [ ] **Step 1: Create api-extractor.base.json at root**

```json
{
    "$schema": "https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json",
    "mainEntryPointFilePath": "<projectFolder>/lib/index.d.ts",
    "apiReport": {
        "enabled": true,
        "reportFileName": "API.md",
        "reportFolder": "<projectFolder>"
    },
    "docModel": {
        "enabled": false
    },
    "dtsRollup": {
        "enabled": false
    },
    "tsdocMetadata": {
        "enabled": false
    },
    "messages": {
        "extractorMessageReporting": {
            "ae-missing-release-tag": {
                "logLevel": "none"
            },
            "ae-forgotten-export": {
                "logLevel": "error"
            }
        }
    }
}
```

- [ ] **Step 2: Create amplify-overtone api-extractor.json**

```json
{
    "extends": "../../api-extractor.base.json"
}
```

- [ ] **Step 3: Create amplify-overtone-client api-extractor.json**

```json
{
    "extends": "../../api-extractor.base.json"
}
```

- [ ] **Step 4: Generate initial API.md files**

```bash
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
npm run build
npx api-extractor run --local -c packages/amplify-overtone/api-extractor.json
npx api-extractor run --local -c packages/amplify-overtone-client/api-extractor.json
```

Review the generated `packages/amplify-overtone/API.md` and `packages/amplify-overtone-client/API.md` to ensure they capture the public API surface correctly.

- [ ] **Step 5: Commit**

```bash
git add api-extractor.base.json packages/amplify-overtone/api-extractor.json packages/amplify-overtone-client/api-extractor.json packages/amplify-overtone/API.md packages/amplify-overtone-client/API.md
git commit -m "build: add Microsoft API Extractor for public API tracking

Generate API.md files for amplify-overtone and amplify-overtone-client.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3: vitest to Node Test Runner + c8

### Task 3.1: Add c8 Coverage Config

**Files:**

- Create: `.c8rc.json`

- [ ] **Step 1: Create .c8rc.json**

```json
{
    "lines": 85,
    "functions": 85,
    "branches": 85,
    "exclude": [
        "docs",
        "scripts",
        "packages/website",
        "packages/test-infra",
        "packages/integration-tests",
        "packages/docs",
        "**/*.test.ts",
        "**/test/**"
    ],
    "all": true,
    "check-coverage": true,
    "src": "packages/"
}
```

- [ ] **Step 2: Commit**

```bash
git add .c8rc.json
git commit -m "build: add c8 coverage config with 85% thresholds

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3.2: Migrate amplify-overtone Tests to Node Test Runner

**Files:**

- Modify: All 12 test files under `packages/amplify-overtone/test/`
- Modify: `packages/amplify-overtone/package.json`

This is the largest single task. Each test file needs to be converted from vitest to `node:test` + `node:assert`. Follow the patterns from the amplify-backend reference test at `packages/backend/src/backend_factory.test.ts`.

**Key patterns from amplify-backend:**

```typescript
// Imports
import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert';

// Test structure — use void before describe/it
void describe('ComponentName', () => {
    beforeEach(() => {
        // setup
    });

    void it('does something specific', () => {
        // arrange
        const input = createInput();

        // act
        const result = doThing(input);

        // assert
        assert.strictEqual(result, expected);
    });

    void it('throws on invalid input', () => {
        assert.throws(() => doThing(invalidInput), {
            message: 'expected error message',
        });
    });
});
```

**Conversion reference:**

| vitest | node:test + node:assert |
|--------|------------------------|
| `import { describe, it, expect, vi, beforeEach } from 'vitest'` | `import { describe, it, beforeEach, mock } from 'node:test'` + `import assert from 'node:assert'` |
| `expect(x).toBe(y)` | `assert.strictEqual(x, y)` |
| `expect(x).toEqual(y)` | `assert.deepStrictEqual(x, y)` |
| `expect(x).toBeTruthy()` | `assert.ok(x)` |
| `expect(x).toBeFalsy()` | `assert.ok(!x)` |
| `expect(x).toBeUndefined()` | `assert.strictEqual(x, undefined)` |
| `expect(x).toBeDefined()` | `assert.notStrictEqual(x, undefined)` |
| `expect(x).toBeNull()` | `assert.strictEqual(x, null)` |
| `expect(x).toContain(y)` | `assert.ok(x.includes(y))` |
| `expect(x).toHaveLength(n)` | `assert.strictEqual(x.length, n)` |
| `expect(x).toMatch(/regex/)` | `assert.match(x, /regex/)` |
| `expect(x).toThrow()` | `assert.throws(() => x())` |
| `expect(x).toThrow('msg')` | `assert.throws(() => x(), { message: 'msg' })` |
| `expect(x).toHaveBeenCalled()` | `assert.strictEqual(x.mock.calls.length > 0, true)` |
| `expect(x).toHaveBeenCalledWith(a, b)` | `assert.deepStrictEqual(x.mock.calls[0].arguments, [a, b])` |
| `expect(x).toHaveBeenCalledTimes(n)` | `assert.strictEqual(x.mock.calls.length, n)` |
| `vi.fn()` | `mock.fn()` |
| `vi.fn(() => value)` | `mock.fn(() => value)` |
| `vi.spyOn(obj, 'method')` | `mock.method(obj, 'method')` |
| `describe('name', () => {})` | `void describe('name', () => {})` |
| `it('name', () => {})` | `void it('name', () => {})` |

- [ ] **Step 1: Convert each test file**

For each of the 12 test files, apply the conversion. Read each file, apply the mapping above, and write the converted version. The `aws-sdk-client-mock` imports and usage stay unchanged — it's framework-agnostic.

Files to convert (do them one at a time, verify each compiles):
1. `test/unit/email/factory.test.ts`
2. `test/unit/email/idempotent-identity-handler.test.ts`
3. `test/unit/email/core-template.test.ts`
4. `test/unit/email/handler.test.ts`
5. `test/unit/email/renderer.test.ts`
6. `test/unit/schema/email-action.test.ts`
7. `test/unit/schema/field-types.test.ts`
8. `test/unit/schema/template-compiler.test.ts`
9. `test/construct/email/dns.test.ts`
10. `test/construct/email/lambda.test.ts`
11. `test/construct/email/warnings.test.ts`
12. `test/construct/email/ses.test.ts`

- [ ] **Step 2: Update amplify-overtone package.json test script**

```json
"test": "tsx --test test/**/*.test.ts"
```

Remove vitest from devDependencies (if not already done in Phase 2):
```json
// Remove these:
"vitest": "^4.1.2",
"@vitest/coverage-v8": "^4.1.2",
```

- [ ] **Step 3: Run tests to verify**

```bash
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
npm run overtone:test
```

Expected: All 12 test files pass with Node test runner output.

- [ ] **Step 4: Remove vitest from amplify-overtone-client**

In `packages/amplify-overtone-client/package.json`, remove vitest from devDependencies:
```json
// Remove:
"vitest": "^4.1.2",
```

Update test script:
```json
"test": "echo 'No tests yet'"
```

- [ ] **Step 5: Remove vitest config files if any exist**

```bash
find packages/ -name "vitest.config.*" -delete
find packages/ -name "vite.config.*" -not -path "*/website/*" -delete
```

- [ ] **Step 6: Run npm install to clean up lockfile**

```bash
npm install
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: migrate from vitest to Node test runner

Convert all 12 test files to node:test + node:assert. Remove vitest
dependency. Add c8 coverage config with 85% thresholds.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4: Scripts Infrastructure

### Task 4.1: Create Scripts TypeScript Config and Shared Utilities

**Files:**

- Create: `scripts/tsconfig.json`
- Create: `scripts/components/package_json.ts`
- Create: `scripts/components/git_client.ts`
- Create: `scripts/components/npm_client.ts`
- Create: `scripts/components/github_client.ts`

- [ ] **Step 1: Create scripts/tsconfig.json**

```json
{
    "extends": "../tsconfig.base.json",
    "compilerOptions": {
        "rootDir": ".",
        "outDir": "../scripts-lib",
        "composite": false,
        "noEmit": true
    },
    "include": ["."]
}
```

- [ ] **Step 2: Port scripts/components/package_json.ts**

Read `/Users/ckoch/Development/aws-amplify/amplify-backend/scripts/components/package-json/package_json.ts` and adapt for overtone. This provides typed read/write of package.json files.

- [ ] **Step 3: Port git_client.ts, npm_client.ts, github_client.ts**

Read each from `/Users/ckoch/Development/aws-amplify/amplify-backend/scripts/components/` and adapt. These are utility wrappers around git, npm, and GitHub API operations.

- [ ] **Step 4: Commit**

```bash
git add scripts/
git commit -m "build(scripts): add tsconfig and shared utility clients

Port package_json, git_client, npm_client, github_client from
amplify-backend. Adapted for overtone package structure.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.2: Port Validation Scripts

**Files:**

- Create: `scripts/check_no_git_diff.ts`
- Create: `scripts/check_package_json.ts`
- Create: `scripts/check_package_lock.ts`
- Create: `scripts/check_package_versions.ts`
- Create: `scripts/check_dependencies.ts`
- Create: `scripts/check_pr_size.ts`
- Create: `scripts/check_changeset_completeness.ts`
- Create: `scripts/components/dependencies_validator.ts`
- Create: `scripts/components/package_lock_validator.ts`

- [ ] **Step 1: Port each validation script**

For each script, read the amplify-backend version from `/Users/ckoch/Development/aws-amplify/amplify-backend/scripts/` and adapt:

- `check_no_git_diff.ts` — Nearly identical, just runs `git diff --exit-code`
- `check_package_json.ts` — Verify all non-private packages have `main` field. Update package paths for overtone
- `check_package_lock.ts` + `package_lock_validator.ts` — Validates no localhost references in lockfile
- `check_package_versions.ts` — Update expected versions: `@nxsflow/amplify-overtone@0.x`, `@nxsflow/amplify-overtone-client@0.x`
- `check_dependencies.ts` + `dependencies_validator.ts` — Update allowlists for overtone's dependency stack (AWS SDK, CDK, Amplify, SES, etc.)
- `check_pr_size.ts` — Keep 1000-line limit, exclude `package-lock.json` and `API.md`
- `check_changeset_completeness.ts` — Update to check overtone package names

- [ ] **Step 2: Verify scripts compile**

```bash
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
npx tsx scripts/check_package_json.ts
```

- [ ] **Step 3: Commit**

```bash
git add scripts/
git commit -m "build(scripts): add validation scripts

Port check_no_git_diff, check_package_json, check_package_lock,
check_package_versions, check_dependencies, check_pr_size, and
check_changeset_completeness from amplify-backend.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.3: Port Test Runner Scripts

**Files:**

- Create: `scripts/run_tests.ts`
- Create: `scripts/get_unit_test_dir_list.ts`

- [ ] **Step 1: Port run_tests.ts**

Read `/Users/ckoch/Development/aws-amplify/amplify-backend/scripts/run_tests.ts` and adapt. This wraps the Node test runner with spec reporter and handles Node version differences for CLI flags.

- [ ] **Step 2: Port get_unit_test_dir_list.ts**

Read `/Users/ckoch/Development/aws-amplify/amplify-backend/scripts/get_unit_test_dir_list.ts` and adapt. This lists all packages that have unit tests, excluding integration-tests (but including specific subdirs if needed).

For overtone, unit test directories are:
- `packages/amplify-overtone` (has `test/` dir)
- `packages/amplify-overtone-client` (when tests exist)

- [ ] **Step 3: Verify**

```bash
cd /Users/ckoch/Development/aws-amplify/amplify-overtone
npx tsx scripts/get_unit_test_dir_list.ts
```

Expected output: list of package directories with tests.

- [ ] **Step 4: Commit**

```bash
git add scripts/run_tests.ts scripts/get_unit_test_dir_list.ts
git commit -m "build(scripts): add test runner scripts

Port run_tests.ts and get_unit_test_dir_list.ts from amplify-backend.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.4: Port API Change Detection Scripts

**Files:**

- Create: `scripts/check_api_extract.ts`
- Create: `scripts/check_api_changes.ts`
- Create: `scripts/components/api-changes-validator/api_changes_validator.ts`
- Create: `scripts/components/api-changes-validator/api_usage_generator.ts`
- Create: `scripts/components/api-changes-validator/api_usage_statements_generators.ts`
- Create: `scripts/components/api-changes-validator/api_report_parser.ts`

- [ ] **Step 1: Port check_api_extract.ts**

Read from amplify-backend and adapt. Validates API.md files have no extraction errors.

- [ ] **Step 2: Port check_api_changes.ts and the api-changes-validator module**

Read the full module from `/Users/ckoch/Development/aws-amplify/amplify-backend/scripts/components/api-changes-validator/`. This detects compile-time breaking changes by creating test projects that import the public API and compiling against baseline.

- [ ] **Step 3: Commit**

```bash
git add scripts/check_api_extract.ts scripts/check_api_changes.ts scripts/components/api-changes-validator/
git commit -m "build(scripts): add API change detection scripts

Port check_api_extract, check_api_changes, and api-changes-validator
module from amplify-backend.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.5: Port Publishing Scripts

**Files:**

- Create: `scripts/publish.ts`
- Create: `scripts/publish_runner.ts`
- Create: `scripts/publish_snapshot.ts`
- Create: `scripts/publish_local.ts`
- Create: `scripts/version_runner.ts`
- Create: `scripts/start_npm_proxy.ts`
- Create: `scripts/stop_npm_proxy.ts`
- Create: `scripts/is_version_packages_commit.ts`
- Create: `scripts/deprecate_release.ts`
- Create: `scripts/restore_release.ts`
- Create: `scripts/components/release_deprecator.ts`
- Create: `scripts/components/release_restorer.ts`
- Create: `scripts/components/dist_tag_mover.ts`
- Create: `scripts/components/release_tag_to_name_and_version.ts`
- Create: `scripts/components/is_version_packages_commit.ts`
- Create: `scripts/components/create_changeset_file.ts`
- Create: `verdaccio.config.yaml`

- [ ] **Step 1: Create verdaccio.config.yaml at root**

Copy from amplify-backend:

```yaml
storage: verdaccio-cache/storage

auth:
  htpasswd:
    file: verdaccio-cache/htpasswd

uplinks:
  npmjs:
    url: https://registry.npmjs.org/
    max_fails: 40
    maxage: 30m
    timeout: 60s
    agent_options:
      keepAlive: true
      maxSockets: 40
      maxFreeSockets: 10

packages:
  '@*/*':
    access: $all
    publish: $all
    proxy: npmjs

  '**':
    access: $all
    publish: $all
    proxy: npmjs

logs:
  - { type: stdout, format: pretty, level: warn }

server:
  keepAliveTimeout: 0

max_body_size: 500mb
```

- [ ] **Step 2: Port publishing scripts**

Read each from amplify-backend and adapt:
- `publish.ts` — entry point calling `runPublish()`
- `publish_runner.ts` — changeset publish with config options
- `publish_snapshot.ts` — sets `snapshotRelease: true`
- `publish_local.ts` — publishes to local verdaccio
- `version_runner.ts` — runs changeset version
- `start_npm_proxy.ts` / `stop_npm_proxy.ts` — verdaccio lifecycle
- `is_version_packages_commit.ts` — detect version commits

- [ ] **Step 3: Port release management scripts**

Read and adapt:
- `deprecate_release.ts` / `restore_release.ts` — entry points
- `release_deprecator.ts` / `release_restorer.ts` — core logic
- `dist_tag_mover.ts` — npm dist-tag management

- [ ] **Step 4: Commit**

```bash
git add scripts/ verdaccio.config.yaml
git commit -m "build(scripts): add publishing and release management scripts

Port publish, version, verdaccio, deprecate, and restore scripts from
amplify-backend. Add verdaccio.config.yaml for local npm proxy.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4.6: Port Remaining Utility Scripts

**Files:**

- Create: `scripts/copy_template.ts`
- Create: `scripts/update_tsconfig_refs.ts`
- Create: `scripts/concurrent_workspace_script.ts`
- Create: `scripts/setup_test_project.ts`

- [ ] **Step 1: Port each utility script**

Read from amplify-backend and adapt:
- `copy_template.ts` — token substitution for new package creation
- `update_tsconfig_refs.ts` — keeps tsconfig project references in sync
- `concurrent_workspace_script.ts` — parallel builds with tsbuildinfo-based skip
- `setup_test_project.ts` — scaffold minimal test project

- [ ] **Step 2: Update .husky/pre-commit**

Now that the scripts exist, update the pre-commit hook:

```bash
npm run update:tsconfig-refs
npm run check:package-lock
npx lint-staged
```

- [ ] **Step 3: Commit**

```bash
git add scripts/ .husky/pre-commit
git commit -m "build(scripts): add utility scripts and update pre-commit hook

Port copy_template, update_tsconfig_refs, concurrent_workspace_script,
setup_test_project. Wire pre-commit to run tsconfig-refs check and
package-lock validation.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 5: GitHub Actions + Dependabot + Verdaccio

### Task 5.1: Create Composite Actions

**Files:**

- Create: `.github/actions/setup_node/action.yml`
- Create: `.github/actions/install_with_cache/action.yml`
- Create: `.github/actions/build_with_cache/action.yml`
- Create: `.github/actions/restore_build_cache/action.yml`
- Create: `.github/actions/restore_install_cache/action.yml`
- Create: `.github/actions/setup_profile/action.yml`

- [ ] **Step 1: Create setup_node action**

Read `/Users/ckoch/Development/aws-amplify/amplify-backend/.github/actions/setup_node/action.yml` and adapt.

```yaml
name: Setup Node
description: Setup Node.js with cache

inputs:
  node-version:
    description: Node.js version
    required: true

runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: npm
```

- [ ] **Step 2: Create install_with_cache action**

Read from amplify-backend and adapt. Key: cache key includes OS + lockfile hash + Node version.

```yaml
name: Install with Cache
description: Run npm ci with node_modules cache

inputs:
  node-version:
    description: Node.js version
    required: true

runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
    - name: Cache node_modules
      uses: actions/cache@v4
      with:
        path: node_modules
        key: ${{ runner.os }}-node-${{ inputs.node-version }}-${{ hashFiles('package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-node-${{ inputs.node-version }}-
    - name: Install dependencies
      shell: bash
      run: npm ci
```

- [ ] **Step 3: Create build_with_cache action**

```yaml
name: Build with Cache
description: Build with install and build output cache

inputs:
  node-version:
    description: Node.js version
    required: true

runs:
  using: composite
  steps:
    - uses: ./.github/actions/install_with_cache
      with:
        node-version: ${{ inputs.node-version }}
    - name: Cache build output
      uses: actions/cache@v4
      with:
        path: |
          packages/*/lib
          packages/*/tsconfig.tsbuildinfo
        key: ${{ runner.os }}-build-${{ inputs.node-version }}-${{ github.sha }}
        restore-keys: |
          ${{ runner.os }}-build-${{ inputs.node-version }}-
    - name: Build
      shell: bash
      run: npm run build
```

- [ ] **Step 4: Create restore_build_cache and restore_install_cache actions**

These are thin wrappers around cache restoration with `fail-on-cache-miss: true`.

`restore_install_cache/action.yml`:
```yaml
name: Restore Install Cache
description: Restore node_modules from cache

inputs:
  node-version:
    description: Node.js version
    required: true

runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
    - name: Restore node_modules
      uses: actions/cache/restore@v4
      with:
        path: node_modules
        key: ${{ runner.os }}-node-${{ inputs.node-version }}-${{ hashFiles('package-lock.json') }}
        fail-on-cache-miss: true
```

`restore_build_cache/action.yml`:
```yaml
name: Restore Build Cache
description: Restore install and build output from cache

inputs:
  node-version:
    description: Node.js version
    required: true

runs:
  using: composite
  steps:
    - uses: ./.github/actions/restore_install_cache
      with:
        node-version: ${{ inputs.node-version }}
    - name: Restore build output
      uses: actions/cache/restore@v4
      with:
        path: |
          packages/*/lib
          packages/*/tsconfig.tsbuildinfo
        key: ${{ runner.os }}-build-${{ inputs.node-version }}-${{ github.sha }}
        fail-on-cache-miss: true
```

- [ ] **Step 5: Create setup_profile action**

Read from amplify-backend and adapt. Creates an AWS CLI profile from temporary credentials.

```yaml
name: Setup AWS Profile
description: Create AWS CLI profile from temporary credentials

inputs:
  profile-name:
    description: AWS profile name
    required: true
  region:
    description: AWS region
    required: true
  access-key-id:
    description: AWS access key ID
    required: true
  secret-access-key:
    description: AWS secret access key
    required: true
  session-token:
    description: AWS session token
    required: true

runs:
  using: composite
  steps:
    - name: Configure AWS profile
      shell: bash
      run: |
        aws configure set aws_access_key_id "${{ inputs.access-key-id }}" --profile "${{ inputs.profile-name }}"
        aws configure set aws_secret_access_key "${{ inputs.secret-access-key }}" --profile "${{ inputs.profile-name }}"
        aws configure set aws_session_token "${{ inputs.session-token }}" --profile "${{ inputs.profile-name }}"
        aws configure set region "${{ inputs.region }}" --profile "${{ inputs.profile-name }}"
```

- [ ] **Step 6: Commit**

```bash
git add .github/actions/
git commit -m "ci: add composite actions for Node setup, caching, and AWS profiles

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5.2: Create health_checks.yml Workflow

**Files:**

- Create: `.github/workflows/health_checks.yml`
- Delete: `.github/workflows/ci.yml`
- Delete: `.github/workflows/publish.yml`

- [ ] **Step 1: Create health_checks.yml**

Read `/Users/ckoch/Development/aws-amplify/amplify-backend/.github/workflows/health_checks.yml` and adapt. This is the largest file — adapt the structure but reduce the matrix (fewer packages, fewer test dimensions).

The workflow should include these jobs:
1. `install` — multi-node matrix install + cache
2. `build` — build + cache
3. `test_with_coverage` — run tests with c8
4. `lint` — biome check
5. `check_dependencies` — validate dependency rules
6. `check_api_extract` — validate API.md
7. `check_api_changes` — detect breaking changes (PR only)
8. `check_pr_size` — PR diff size (PR only)
9. `check_pr_changesets` — changeset presence (PR only)
10. `check_package_versions` — version validation
11. `dependency_review` — license/vulnerability scanning (PR only)
12. `codeql` — security analysis
13. `update_package_versions` — create Version PR (main push only)
14. `publish_package_versions` — npm publish (version PR merge only)
15. E2E placeholders (wired in Phase 6)

Triggers: PR on main, push to main, weekly schedule (Sunday 00:00 UTC), manual dispatch.

Node matrix: `[18, 20, 22]` for test jobs, `22` for everything else.

Write the full workflow file. This will be ~300-500 lines. Reference the amplify-backend version closely but adapt for:
- Biome instead of ESLint+Prettier for lint job
- Smaller package set
- npm instead of pnpm
- Different package names
- E2E jobs as placeholders

- [ ] **Step 2: Delete old workflows**

```bash
rm .github/workflows/ci.yml .github/workflows/publish.yml
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "ci: replace ci.yml and publish.yml with health_checks.yml

Comprehensive CI workflow with install/build caching, test matrix,
lint, dependency review, API validation, CodeQL, version management,
and npm publishing. Weekly schedule.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5.3: Create Supporting Workflows

**Files:**

- Create: `.github/workflows/canary_checks.yml`
- Create: `.github/workflows/snapshot_release.yml`
- Create: `.github/workflows/deprecate_release.yml`
- Create: `.github/workflows/restore_release.yml`
- Create: `.github/workflows/e2e_resource_cleanup.yml` (placeholder)
- Create: `.github/workflows/issue-pending-response.yml`

- [ ] **Step 1: Create canary_checks.yml**

Every-other-day check against latest dependencies (no lockfile):

```yaml
name: Canary Checks

on:
  schedule:
    - cron: '0 6 */2 * *'  # Every other day at 06:00 UTC
  workflow_dispatch:

jobs:
  canary:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install without lockfile
        run: npm install --no-package-lock
      - run: npm run build
      - run: npm run typecheck
      - run: npm test
      - run: npm run lint
```

- [ ] **Step 2: Create snapshot_release.yml**

```yaml
name: Snapshot Release

on:
  workflow_call:

permissions:
  contents: read
  id-token: write

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/build_with_cache
        with:
          node-version: 22
      - name: Publish snapshot
        run: npm run publish:snapshot
        env:
          NPM_CONFIG_PROVENANCE: true
```

- [ ] **Step 3: Create deprecate_release.yml and restore_release.yml**

Read from amplify-backend and adapt. Both are manual-dispatch-only workflows.

- [ ] **Step 4: Create e2e_resource_cleanup.yml placeholder**

```yaml
name: E2E Resource Cleanup

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight UTC
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Placeholder
        run: echo "E2E cleanup will be wired in Phase 6"
```

- [ ] **Step 5: Create issue-pending-response.yml**

```yaml
name: Issue Pending Response

on:
  issue_comment:
    types: [created]

jobs:
  pending-response:
    runs-on: ubuntu-latest
    if: github.event.issue.state == 'open' && github.event.comment.user.login != github.event.issue.user.login
    steps:
      - uses: actions/checkout@v4
      - name: Add pending-response label
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.issues.addLabels({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              labels: ['pending-response']
            });
```

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/
git commit -m "ci: add supporting workflows

Add canary_checks (every other day), snapshot_release, deprecate/restore
release, e2e_resource_cleanup placeholder, and issue-pending-response.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5.4: Add GitHub Configuration Files

**Files:**

- Create: `.github/CODEOWNERS`
- Create: `.github/dependabot.yml`
- Create: `.github/dependency_review_config.yml`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md` (create if doesn't exist)
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/ISSUE_TEMPLATE/bug-report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature-request.yml`

- [ ] **Step 1: Create CODEOWNERS**

```
# Default owners
*  @nxsflow/amplify-overtone

# API approval - public surface and dependencies
**/API.md @nxsflow/amplify-overtone-api-approvers
**/package.json @nxsflow/amplify-overtone-api-approvers

# GitHub actions/checks approval
/.github/ @nxsflow/amplify-overtone-admins
```

Note: You'll need to create these GitHub teams (`amplify-overtone-api-approvers`, `amplify-overtone-admins`) in the `nxsflow` GitHub organization, or adjust to use individual usernames.

- [ ] **Step 2: Create dependabot.yml**

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directories:
      - '/'
      - '/packages/*'
    schedule:
      interval: 'weekly'
      time: '09:00'
      timezone: 'Europe/Berlin'
    versioning-strategy: increase-if-necessary
    allow:
      - dependency-name: '@aws-sdk/*'
      - dependency-name: '@types/aws-*'
      - dependency-name: '@smithy/*'
      - dependency-name: 'aws-cdk'
      - dependency-name: 'aws-cdk-lib'
      - dependency-name: '@aws-cdk/*'
    open-pull-requests-limit: 10
    groups:
      aws-sdk:
        patterns:
          - '@aws-sdk/*'
          - '@types/aws-*'
      changesets:
        patterns:
          - '@changesets/*'
      smithy:
        patterns:
          - '@smithy/*'
    ignore:
      - dependency-name: '@microsoft/api-extractor'
      - dependency-name: '@types/node'
```

- [ ] **Step 3: Create dependency_review_config.yml**

Copy from amplify-backend (license allowlist is universal):

```yaml
allow-licenses:
  - 0BSD
  - Apache-2.0
  - Apache-2.0 AND ISC AND MIT
  - Apache-2.0 AND BSD-3-Clause AND CC0-1.0 AND ISC AND MIT
  - BSD-1-Clause
  - BSD-2-Clause-FreeBSD
  - BSD-2-Clause
  - BSD-3-Clause-Attribution
  - BSD-3-Clause
  - BSD-Source-Code
  - BlueOak-1.0.0
  - bzip2-1.0.6
  - CC-BY-3.0
  - CC-BY-4.0
  - curl
  - ISC
  - JSON
  - MIT
  - MIT AND MITNFA
  - Artistic-2.0 AND ISC
  - NTP
  - OLDAP-2.8
  - OpenSSL
  - PDDL-1.0
  - PostgreSQL
  - Python-2.0
  - Spencer-94
  - Unicode-DFS-2015
  - Unicode-DFS-2016
  - Unlicense
  - WTFPL
  - X11
  - zlib-acknowledgement
  - Zlib
allow-ghsas:
  - 'GHSA-8gc5-j5rx-235r'
  - 'GHSA-jp2q-39xq-3w4g'
```

- [ ] **Step 4: Create PULL_REQUEST_TEMPLATE.md**

```markdown
## Problem

**Issue number, if available:**

## Changes

**Corresponding docs PR, if applicable:**

## Validation

## Checklist

- [ ] If this PR includes a functional change, I have added or updated automated test coverage.
- [ ] If this PR requires a docs update, I have linked to that docs PR above.
- [ ] If this PR modifies E2E tests or resource provisioning, I have set the `run-e2e` label.

_By submitting this pull request, I confirm that my contribution is made under the terms of the Apache 2.0 license._
```

- [ ] **Step 5: Create issue templates**

`ISSUE_TEMPLATE/config.yml`:
```yaml
blank_issues_enabled: false
contact_links:
  - name: Community Support
    url: https://github.com/nxsflow/amplify-overtone/discussions
    about: Ask questions and discuss with the community
```

`ISSUE_TEMPLATE/bug-report.yml`:
```yaml
name: Bug Report
description: Report a bug in Amplify Overtone
labels: ['bug']
body:
  - type: textarea
    attributes:
      label: Environment
      description: Run `npx ampx info` and paste the output
    validations:
      required: true
  - type: textarea
    attributes:
      label: Description
      description: Describe the bug
    validations:
      required: true
  - type: textarea
    attributes:
      label: Steps to reproduce
      description: Minimal steps to reproduce the bug
    validations:
      required: true
  - type: textarea
    attributes:
      label: Expected behavior
      description: What did you expect to happen?
    validations:
      required: true
```

`ISSUE_TEMPLATE/feature-request.yml`:
```yaml
name: Feature Request
description: Suggest a new feature
labels: ['feature-request']
body:
  - type: textarea
    attributes:
      label: Description
      description: Describe the feature you'd like
    validations:
      required: true
  - type: textarea
    attributes:
      label: Use case
      description: What problem does this solve?
    validations:
      required: true
```

- [ ] **Step 6: Commit**

```bash
git add .github/
git commit -m "ci: add CODEOWNERS, dependabot, dependency review, issue/PR templates

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 6: Multi-Account E2E Infrastructure

### Task 6.1: Write AWS Access Documentation

**Files:**

- Create: `docs/superpowers/specs/github-actions-aws-access.md`

- [ ] **Step 1: Write the documentation**

This document explains how GitHub Actions authenticate with AWS for E2E testing. It should cover:

1. **OIDC Federation Setup** — GitHub Actions uses OpenID Connect to assume IAM roles without storing long-lived credentials. GitHub's OIDC provider (`token.actions.githubusercontent.com`) must be registered as an identity provider in each AWS account.

2. **IAM Trust Policy** — Each role trusts the GitHub OIDC provider with conditions on:
   - `sub`: `repo:nxsflow/amplify-overtone:*` (restrict to this repo)
   - `aud`: `sts.amazonaws.com`

3. **Dual Role Pattern**:
   - **Tooling role** — Broad permissions for deploying/destroying CloudFormation stacks, managing S3 buckets, Cognito user pools, SES identities, IAM roles. Used for test setup and cleanup.
   - **Execution role** — Narrower permissions for what the tests themselves need at runtime (invoke Lambda, read S3, send email via SES, etc.)

4. **GitHub Secrets Structure**:
   - `E2E_TEST_ACCOUNTS` — JSON array of account objects:
     ```json
     [
       {
         "accountId": "123456789012",
         "executionRoleArn": "arn:aws:iam::123456789012:role/overtone-e2e-execution",
         "toolingRoleArn": "arn:aws:iam::123456789012:role/overtone-e2e-tooling"
       }
     ]
     ```
   - `E2E_REGIONS` — JSON array: `["us-east-1", "eu-central-1"]`

5. **Step-by-step preparation guide**:
   - Create OIDC identity provider in each AWS account
   - Create tooling and execution IAM roles with trust policies
   - Attach permission policies to each role
   - Add GitHub repository secrets
   - Verify with a manual dispatch of the E2E workflow

6. **Permission policies** — Detailed IAM policy documents for both roles.

7. **Local development** — How `.env` + AWS SSO login works for local E2E testing (existing flow, unchanged).

- [ ] **Step 2: Commit**

```bash
git add -f docs/superpowers/specs/github-actions-aws-access.md
git commit -m "docs: add GitHub Actions AWS access setup guide

OIDC federation, dual role pattern, IAM policies, and step-by-step
preparation for multi-account E2E testing.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6.2: Port E2E Scripts

**Files:**

- Create: `scripts/select_e2e_test_account.ts`
- Create: `scripts/cleanup_e2e_resources.ts`
- Create: `scripts/generate_sparse_test_matrix.ts`
- Create: `scripts/do_include_e2e.ts`

- [ ] **Step 1: Port select_e2e_test_account.ts**

Read from amplify-backend and adapt. Randomly selects an account from `E2E_TEST_ACCOUNTS` environment variable.

- [ ] **Step 2: Port cleanup_e2e_resources.ts**

Read from amplify-backend and adapt. Deletes stale resources:
- CloudFormation stacks (with "overtone" or "amplify" prefix older than 4 hours)
- S3 buckets (empty and delete)
- Cognito user pools
- SES identities
- IAM roles (with test prefix)
- SSM parameters

- [ ] **Step 3: Port generate_sparse_test_matrix.ts**

Read from amplify-backend and adapt. For overtone, the dimensions are simpler:
- Test suites: `[email, auth-inheritance, collaborative, local-first, actions]` (from integration-tests/src/e2e/)
- OS: `[ubuntu-latest]` (start simple)
- Node: `[18, 20, 22]`

- [ ] **Step 4: Port do_include_e2e.ts**

Read from amplify-backend and adapt. Returns true for:
- Push to main
- PR with `run-e2e` label
- Manual dispatch
- Scheduled runs

- [ ] **Step 5: Commit**

```bash
git add scripts/
git commit -m "build(scripts): add E2E infrastructure scripts

Port select_e2e_test_account, cleanup_e2e_resources,
generate_sparse_test_matrix, do_include_e2e from amplify-backend.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6.3: Create E2E Composite Actions

**Files:**

- Create: `.github/actions/select_e2e_account/action.yml`
- Create: `.github/actions/run_with_e2e_account/action.yml`

- [ ] **Step 1: Create select_e2e_account action**

Read from amplify-backend and adapt. Randomly selects account from JSON secret, outputs role ARNs.

```yaml
name: Select E2E Account
description: Randomly select an E2E test account

inputs:
  e2e-test-accounts:
    description: JSON array of test account objects
    required: true

outputs:
  execution-role-arn:
    description: ARN of the execution role
    value: ${{ steps.select.outputs.execution-role-arn }}
  tooling-role-arn:
    description: ARN of the tooling role
    value: ${{ steps.select.outputs.tooling-role-arn }}
  account-id:
    description: AWS account ID
    value: ${{ steps.select.outputs.account-id }}

runs:
  using: composite
  steps:
    - id: select
      shell: bash
      run: |
        ACCOUNT=$(echo '${{ inputs.e2e-test-accounts }}' | node -e "
          const accounts = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
          const selected = accounts[Math.floor(Math.random() * accounts.length)];
          console.log(JSON.stringify(selected));
        ")
        echo "execution-role-arn=$(echo $ACCOUNT | jq -r '.executionRoleArn')" >> $GITHUB_OUTPUT
        echo "tooling-role-arn=$(echo $ACCOUNT | jq -r '.toolingRoleArn')" >> $GITHUB_OUTPUT
        echo "account-id=$(echo $ACCOUNT | jq -r '.accountId')" >> $GITHUB_OUTPUT
```

- [ ] **Step 2: Create run_with_e2e_account action**

Read from amplify-backend and adapt. This is the most complex action — it orchestrates:
1. Cache restoration
2. Account selection
3. OIDC credential retrieval for both roles
4. AWS profile setup
5. Test execution with retry logic

Adapt for overtone's simpler test structure.

- [ ] **Step 3: Commit**

```bash
git add .github/actions/
git commit -m "ci: add E2E account selection and test runner actions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6.4: Wire E2E Jobs into health_checks.yml

**Files:**

- Modify: `.github/workflows/health_checks.yml`
- Modify: `.github/workflows/e2e_resource_cleanup.yml`

- [ ] **Step 1: Add E2E jobs to health_checks.yml**

Add after the existing jobs:

```yaml
  do_include_e2e:
    runs-on: ubuntu-latest
    needs: [build]
    outputs:
      include_e2e: ${{ steps.check.outputs.include_e2e }}
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/restore_build_cache
        with:
          node-version: 22
      - id: check
        run: echo "include_e2e=$(npx tsx scripts/do_include_e2e.ts)" >> $GITHUB_OUTPUT
        env:
          GITHUB_EVENT_NAME: ${{ github.event_name }}
          GITHUB_EVENT_ACTION: ${{ github.event.action }}
          PR_LABELS: ${{ toJson(github.event.pull_request.labels.*.name) }}

  e2e_tests:
    needs: [do_include_e2e]
    if: needs.do_include_e2e.outputs.include_e2e == 'true'
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    strategy:
      fail-fast: false
      matrix:
        test-suite: [actions, auth-inheritance, collaborative, local-first]
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/run_with_e2e_account
        with:
          node-version: 22
          e2e-test-accounts: ${{ secrets.E2E_TEST_ACCOUNTS }}
          test-command: npm run e2e:test -- --test-name-pattern="${{ matrix.test-suite }}"
```

- [ ] **Step 2: Update e2e_resource_cleanup.yml**

Replace the placeholder with the real cleanup workflow:

```yaml
name: E2E Resource Cleanup

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  cleanup:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        region: [us-east-1, eu-central-1]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - name: Assume tooling role
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.E2E_CLEANUP_ROLE_ARN }}
          aws-region: ${{ matrix.region }}
      - name: Cleanup resources
        run: npx tsx scripts/cleanup_e2e_resources.ts
        env:
          AWS_REGION: ${{ matrix.region }}
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "ci: wire E2E tests and resource cleanup into workflows

Add do_include_e2e gate, e2e_tests job matrix, and daily resource
cleanup across regions.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 7: CLAUDE.md + Skills

### Task 7.1: Update CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite CLAUDE.md**

Update to reflect all infrastructure changes:
- npm (not pnpm) — all script commands
- tsc (not tsup) — build output in `lib/` not `dist/`
- Node test runner + c8 (not vitest)
- API Extractor workflow
- New scripts and their purposes
- verdaccio for local publishing
- Multi-account E2E setup overview
- Remove duplicated biome config details (let biome.json be the source of truth)

Keep the package descriptions, versioning info, and test organization sections but update all commands.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for new infrastructure

Reflect npm, tsc, Node test runner, API Extractor, verdaccio, and
updated script conventions.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7.2: Update Claude Code Skills

**Files:**

- Modify: `.claude/skills/commit/SKILL.md`
- Modify: `.claude/skills/versioning-and-releases/SKILL.md`
- Modify: `.claude/skills/cdk-construct-development/SKILL.md`
- Modify: `.claude/skills/cdk-testing/SKILL.md`
- Modify: `.claude/skills/amplify-custom-resources/SKILL.md`

- [ ] **Step 1: Update commit skill**

Replace all `pnpm changeset` with `npm run changeset`. Update any pnpm-specific commands.

- [ ] **Step 2: Update versioning-and-releases skill**

- Replace pnpm commands with npm equivalents
- Add verdaccio/local publish workflow: `npm run vend`
- Add deprecation/restore scripts: `npm run deprecate`, `npm run restore`
- Update branch strategy if needed
- Remove `pnpm changeset pre` → `npx changeset pre`

- [ ] **Step 3: Update cdk-construct-development skill**

- Change build from tsup to tsc
- Update output paths from `dist/` to `lib/`
- Remove tsup.config.ts references
- Add API Extractor workflow: `npm run check:api`, `npm run update:api`
- Update external dependencies section (no more tsup `external` config — peer deps are naturally excluded by tsc)

- [ ] **Step 4: Update cdk-testing skill**

- Replace vitest with Node test runner patterns
- Update all example code to use `node:test` and `node:assert`
- Replace `vi.fn()` → `mock.fn()`, `vi.spyOn()` → `mock.method()`
- Replace `expect()` chains with `assert.*` calls
- Add reference to amplify-backend test patterns for setup/execution/teardown
- Update test commands from `pnpm test` to `npm test`

- [ ] **Step 5: Update amplify-custom-resources skill**

- Replace `dist/` references with `lib/`
- Update any tsup-specific guidance

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/
git commit -m "docs: update Claude Code skills for new infrastructure

Update commit, versioning, cdk-construct-development, cdk-testing,
and amplify-custom-resources skills to reflect npm, tsc, Node test
runner, and API Extractor.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7.3: Update Claude Code Settings

**Files:**

- Modify: `.claude/settings.json`

- [ ] **Step 1: Update permissions**

Replace pnpm-specific permissions with npm equivalents:
- Remove: `pnpm build`, `pnpm test`, `pnpm lint`, etc.
- Add: `npm run build`, `npm run test`, `npm run lint`, `npm ci`, `npm install`, etc.
- Add: `npx api-extractor`, `npx c8`
- Keep: biome, git, gh, aws commands

- [ ] **Step 2: Commit**

```bash
git add .claude/settings.json
git commit -m "chore: update Claude Code permissions for npm

Co-Authored-By: Claude <noreply@anthropic.com>"
```
