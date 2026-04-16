---
"@nxsflow/amplify-overtone": patch
"@nxsflow/amplify-overtone-client": patch
---

Align monorepo infrastructure with aws-amplify/amplify-backend patterns: migrate from pnpm to npm workspaces, replace tsup with tsc composite builds (output in lib/ instead of dist/), migrate tests from vitest to Node test runner (node:test + node:assert), add Microsoft API Extractor for public API tracking, add c8 coverage, add husky + lint-staged, and set up comprehensive GitHub Actions CI with health checks, canary builds, and multi-account E2E infrastructure
