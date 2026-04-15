---
"@nxsflow/amplify-overtone-client": minor
---

Re-export `generateClient` from `aws-amplify/data` as the initial client entry point

Thin wrapper that provides a seam for future Overtone-specific client features (sync engine, IndexedDB, collaborative sessions) without changing the import path.
