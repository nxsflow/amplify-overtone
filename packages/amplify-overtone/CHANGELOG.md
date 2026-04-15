# @nxsflow/amplify-overtone

## 0.3.0-beta.9

### Patch Changes

- Promote to beta: stable hash-based sandbox recipient IDs, wildcard IAM policy for identity handler, SES identity drift recovery.

## 0.3.0-alpha.8

### Patch Changes

- a9e0b91: Use hash-based construct IDs for sandbox recipient identities instead of array indices. Prevents identity shuffling, accidental deletions, and IAM permission errors when reordering or removing entries from sandboxRecipients.

## 0.3.0-alpha.7

### Minor Changes

- b6ef127: Make email address identity creation idempotent to prevent deployment failures when SES identities already exist
- 75814bd: Replace AwsCustomResource with Lambda-backed CustomResource for idempotent email identity and add unit tests for the identity handler

### Patch Changes

- 9a02973: Align email templates with Overtone brand guidelines and fix plain text content parity
- 2ee6ed1: Fix custom output key to match AWS::Amplify::Custom schema (must be customOutputs, not customEmailOutputs)
- ecc52fd: Fix amplify_outputs.json structure for custom email outputs
- 22e3eea: Handle SES identity drift by re-creating identities on every deploy if they were deleted externally
- 55d915e: Fix npm alpha dist-tag not advancing on pre-release publishes

## 0.3.0-alpha.0

### Minor Changes

- b6ef127: Make email address identity creation idempotent to prevent deployment failures when SES identities already exist
- 75814bd: Replace AwsCustomResource with Lambda-backed CustomResource for idempotent email identity and add unit tests for the identity handler

### Patch Changes

- 9a02973: Align email templates with Overtone brand guidelines and fix plain text content parity
- 2ee6ed1: Fix custom output key to match AWS::Amplify::Custom schema (must be customOutputs, not customEmailOutputs)
- ecc52fd: Fix amplify_outputs.json structure for custom email outputs
- 22e3eea: Handle SES identity drift by re-creating identities on every deploy if they were deleted externally
- 55d915e: Fix npm alpha dist-tag not advancing on pre-release publishes

## 0.2.0

### Minor Changes

- f5fcc04: Add `defineEmail()` for Amazon SES email infrastructure with named senders, 4 built-in templates, and automatic DNS record management

### Patch Changes

- 08d0cc4: Add README with install instructions, defineEmail() API examples, and built-in template reference
- 6e7d14f: Fix `defineEmail()` packaging: include `src/email/templates` in published files, add JSDoc to all discriminated union properties, and use opaque `EmailDefinition` return type to avoid leaking `@aws-amplify/plugin-types` to consumers
- b11cca7: Include README.md in published package tarball
- 0b71760: Flatten `EmailProps` from discriminated union to single interface for full per-property IntelliSense and JSDoc support in IDEs

## 0.2.0-alpha.2

### Patch Changes

- Include README.md in published package tarball

## 0.2.0-alpha.1

### Patch Changes

- Add README with install instructions, defineEmail() API examples, and built-in template reference

## 0.2.0-alpha.0

### Minor Changes

- f5fcc04: Add `defineEmail()` for Amazon SES email infrastructure with named senders, 4 built-in templates, and automatic DNS record management
