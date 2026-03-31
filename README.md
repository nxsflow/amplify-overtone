# Amplify Overtone

## Vision

AWS is the most comprehensive cloud platform — but leveraging its full power as a developer remains hard. CDK codifies infrastructure, yet IAM policies, service integrations, and operational complexity still create hurdles. [AWS Amplify Gen 2](https://docs.amplify.aws/) bridges this gap with a developer-first, code-first approach that makes building full-stack applications fast. But Amplify today covers only a slice of what real applications need.

Every application sends emails. Every application needs teams collaborating on shared resources with proper permissions. Every application needs a notification system. And every application needs to work when the user goes offline.

**Amplify Overtone closes this gap.** It extends Amplify Gen 2 with the capabilities that production apps demand — declared in your schema, generated as CDK constructs, and consumed through type-safe client APIs. For v1, we're shipping four new categories: **Email**, **Collaboration**, **Notifications**, and **Local-First**.

## Packages

| Package                            | npm                                                                                                                                     | Description                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `@nxsflow/amplify-overtone`        | [![npm](https://img.shields.io/npm/v/@nxsflow/amplify-overtone)](https://www.npmjs.com/package/@nxsflow/amplify-overtone)               | Backend: schema builder, CDK constructs, resolvers      |
| `@nxsflow/amplify-overtone-client` | [![npm](https://img.shields.io/npm/v/@nxsflow/amplify-overtone-client)](https://www.npmjs.com/package/@nxsflow/amplify-overtone-client) | Frontend: sync engine, IndexedDB storage, headless APIs |

## Roadmap

### Email

Transactional email via Amazon SES — custom domains, named senders, built-in templates, and DNS automation.

- [#4 `defineEmail()` — SES email infrastructure](https://github.com/nxsflow/amplify-overtone/issues/4) — **in progress**
- [#5 `n.email()` — schema-defined email actions](https://github.com/nxsflow/amplify-overtone/issues/5) — declarative email sending from the schema with typed arguments, sender selection, and AppSync resolver generation
- [#6 Client API for email actions](https://github.com/nxsflow/amplify-overtone/issues/6) — type-safe `client.actions.*` for invoking email actions from the frontend

### Collaboration

CRDT-based conflict-free editing powered by Automerge — dual-table storage, real-time operation broadcasting, authorization inheritance, and a collaborative session API.

- [#7 Collaborative data](https://github.com/nxsflow/amplify-overtone/issues/7) — `.collaborative()` models with OpsLog, compaction, version vectors, presence, and first-class authorization fields (`n.owner()`, `n.editors()`, etc.)

### Local-First

Offline-capable IndexedDB storage via cr-sqlite — zero-latency reads, background sync, offline mutation queues, and lease-based authorization with role-based TTLs.

- [#8 Local-first storage](https://github.com/nxsflow/amplify-overtone/issues/8) — `.localFirst()` models with sync engine (Web Worker), offline queue, and lease expiry lifecycle

### Notifications

Full notification subsystem — in-app notifications via AppSync subscriptions, OS-level push via APNs/FCM/Web Push, email channel bridging, and user preference management. Headless client API for toasts, badge counts, and notification settings.

- [#3 Notification subsystem](https://github.com/nxsflow/amplify-overtone/issues/3) — `defineNotifications()` factory, `n.notify()` schema actions, Step Function orchestrator, and headless `useNotifications()` / `useNotificationPreferences()` hooks

## Getting Started

```bash
pnpm add @nxsflow/amplify-overtone
```

> The packages are not yet published to npm. Check back soon.

## Contributing

We welcome contributions! Each roadmap issue above is a good starting point — they contain detailed design specs, API examples, and architecture decisions. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and release workflow.

## License

[Apache-2.0](LICENSE)
