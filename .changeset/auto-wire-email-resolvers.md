---
"@nxsflow/amplify-overtone": minor
---

Auto-wire email resolvers via construct container discovery

The email factory now automatically wires AppSync resolvers, the send Lambda
data source, and Cognito env vars during `defineBackend()` — no manual
`addEmailResolvers()` call required. The `userLookupLambda` field has been
removed from `EmailResources` as user lookup is now handled internally by
the send Lambda.
