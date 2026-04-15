# @nxsflow/amplify-overtone-client

## 0.2.0-alpha.0

### Minor Changes

- f049a66: Re-export `generateClient` from `aws-amplify/data` as the initial client entry point

  Thin wrapper that provides a seam for future Overtone-specific client features (sync engine, IndexedDB, collaborative sessions) without changing the import path.
