---
"@nxsflow/amplify-overtone": patch
---

Fix `defineEmail()` packaging: include `src/email/templates` in published files, add JSDoc to all discriminated union properties, and use opaque `EmailDefinition` return type to avoid leaking `@aws-amplify/plugin-types` to consumers
