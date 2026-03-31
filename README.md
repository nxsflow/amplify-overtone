# Amplify Overtone

Extend [AWS Amplify Gen 2](https://docs.amplify.aws/) with email, collaboration, and local-first support.

## Status

| Capability                                       | Status      |
| ------------------------------------------------ | ----------- |
| Email (`defineEmail()`)                          | In progress |
| Collaboration (CRDT-based conflict-free editing) | Upcoming    |
| Local-first (offline-capable IndexedDB sync)     | Upcoming    |

## Packages

| Package                            | npm                                                                                                                                     | Description                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `@nxsflow/amplify-overtone`        | [![npm](https://img.shields.io/npm/v/@nxsflow/amplify-overtone)](https://www.npmjs.com/package/@nxsflow/amplify-overtone)               | Backend: CDK constructs and resolvers     |
| `@nxsflow/amplify-overtone-client` | [![npm](https://img.shields.io/npm/v/@nxsflow/amplify-overtone-client)](https://www.npmjs.com/package/@nxsflow/amplify-overtone-client) | Client: runtime for frontend applications |

## Getting Started

```bash
pnpm add @nxsflow/amplify-overtone
```

> The packages are not yet published to npm. Check back soon.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and release workflow.

## License

[Apache-2.0](LICENSE)
