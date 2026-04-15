# Amplify Overtone

Extends AWS Amplify Gen 2 with email, collaboration, and local-first support. Monorepo with two published packages and integration test infrastructure.

## Packages

| Package                            | npm name                           | Purpose                                                              |
| ---------------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| `packages/amplify-overtone`        | `@nxsflow/amplify-overtone`        | Backend: schema builder, CDK constructs, resolvers                   |
| `packages/amplify-overtone-client` | `@nxsflow/amplify-overtone-client` | Frontend: sync engine, IndexedDB storage, collaborative session API  |
| `packages/integration-tests`       | (private)                          | E2E tests: deploy real Amplify backends, verify behavior per feature |
| `packages/test-infra`              | (private)                          | Amplify Gen 2 app: Cognito user pool, S3 + SES receipt rules         |

## Root Scripts

**Always use root scripts instead of `npm run -w`** — they are shorter, permission-allowlisted, and consistent.

### Global

| Script               | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run build`      | Build all packages (tsc composite)               |
| `npm test`           | Run all unit/construct tests (Node test runner)  |
| `npm run typecheck`  | Typecheck all packages                           |
| `npm run lint`       | Lint all files (Biome) + validate package.json   |
| `npm run format`     | Auto-format all files (Biome)                    |
| `npm run check:api`  | Build + run API Extractor + validate API reports |
| `npm run update:api` | Regenerate API.api.md files                      |
| `npm run watch`      | Build in watch mode                              |
| `npm run clean`      | Remove node_modules, build output, coverage      |
| `npm run vend`       | Start local verdaccio + publish packages locally |
| `npm run aws:login`  | AWS SSO login (reads AWS_PROFILE from .env)      |

### Backend (`@nxsflow/amplify-overtone`)

| Script                       | Description                        |
| ---------------------------- | ---------------------------------- |
| `npm run overtone:build`     | Build backend package              |
| `npm run overtone:test`      | Run backend unit + construct tests |
| `npm run overtone:typecheck` | Typecheck backend package          |

### Client (`@nxsflow/amplify-overtone-client`)

| Script                     | Description              |
| -------------------------- | ------------------------ |
| `npm run client:build`     | Build client package     |
| `npm run client:test`      | Run client tests         |
| `npm run client:typecheck` | Typecheck client package |

### Test Infrastructure (`@nxsflow/test-infra`)

| Script                         | Description                                                |
| ------------------------------ | ---------------------------------------------------------- |
| `npm run test-infra:typecheck` | Typecheck test-infra                                       |
| `npm run test-infra:deploy`    | Deploy test infra (writes `amplify_outputs.json` in-place) |
| `npm run test-infra:destroy`   | Tear down test infrastructure                              |

### Integration Tests (`@nxsflow/integration-tests`)

| Script                  | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `npm run e2e:typecheck` | Typecheck integration tests                         |
| `npm run e2e:test`      | Run e2e tests (requires deployed test-infra + .env) |

### Quick Start

```bash
npm install                                          # install all workspace deps
npm run build                                        # build all packages
npm test                                             # run all unit tests
npm run lint                                         # check for lint errors
```

### Integration Tests

```bash
cp .env.example .env                                 # fill in real values (incl. AWS_PROFILE)
npm run test-infra:deploy                            # deploy test infra (once)
npm run e2e:test                                     # run e2e tests
```

## Conventions

- **Tooling**: npm workspaces, tsc (composite builds), Node test runner + c8 (unit tests), tsx (test execution), biome
- **TypeScript**: strict mode, `moduleResolution: Node16`, `target: ES2022`, composite builds
- **Build output**: `lib/` (not `dist/`) — ESM only, no CJS
- **Imports**: use `.js` extension in source (resolved to `.ts` by Node16 module resolution)
- **Exports**: named exports only (`noDefaultExport` biome rule), except config files
- **Node builtins**: use `node:` prefix (`useNodejsImportProtocol` biome rule)
- **Peer deps**: never bundled — `aws-cdk-lib`, `constructs`, `@aws-amplify/plugin-types` for backend; `aws-amplify` for client
- **API tracking**: Microsoft API Extractor generates `API.api.md` per publishable package. Run `npm run update:api` after changing public API.
- **Test infra outputs**: `packages/test-infra/amplify_outputs.json` (generated by `npm run test-infra:deploy`, gitignored). Test user credentials are in Secrets Manager, fetched at runtime by `loadTestInfraConfig()`.
- **Scripts**: `scripts/` directory contains build infrastructure scripts run via `tsx`. See `scripts/tsconfig.json` for TypeScript config.
- **Local publishing**: `npm run vend` starts a local verdaccio proxy and publishes all packages to it for testing in downstream projects.
