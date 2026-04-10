---
"@nxsflow/amplify-overtone": minor
---

Add `.template()` API with type-safe callbacks, `n.userId()` for Cognito user resolution, and `addEmailResolvers()` for `a.schema()` integration

- Replace 4 built-in templates with a single core template (subject, header, body, CTA, footer)
- `.template()` accepts static strings or `(args) => string` callbacks with full TypeScript autocomplete
- `n.userId()` returns a decorated `a.string().required()` that triggers pipeline resolver Cognito lookup
- `n.email()` integrates directly into `a.schema()` — no separate `n.schema()` needed
- `addEmailResolvers()` + `extractEmailActions()` wire AppSync pipeline resolvers at CDK time
- User-lookup Lambda resolves Cognito `name`, `email`, `given_name`, `family_name` attributes
- `recipient` convention: `recipient: n.userId()` auto-wires the To address from resolved email
