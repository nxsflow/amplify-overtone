# @nxsflow/amplify-overtone

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
