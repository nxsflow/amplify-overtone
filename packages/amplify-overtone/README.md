# @nxsflow/amplify-overtone

Backend package for [Amplify Overtone](https://github.com/nxsflow/amplify-overtone) — extends AWS Amplify Gen 2 with email, collaboration, and local-first support.

## Install

```bash
npm install @nxsflow/amplify-overtone
# or: pnpm add @nxsflow/amplify-overtone
# or: yarn add @nxsflow/amplify-overtone
```

## Email (`defineEmail()`)

Transactional email via Amazon SES — custom domains, named senders, built-in templates, and DNS automation.

```typescript
import { defineEmail } from "@nxsflow/amplify-overtone";

// Custom domain with Route 53 (automatic DNS)
export const email = defineEmail({
  domain: "mail.example.com",
  hostedZoneId: "Z0123456789ABCDEFGHIJ",
  hostedZoneDomain: "example.com",
  senders: {
    noreply: { senderPrefix: "noreply", displayName: "MyApp" },
  },
});

// Or without a custom domain
export const email = defineEmail({
  senders: {
    noreply: { senderEmail: "noreply@gmail.com", displayName: "MyApp" },
  },
});
```

### Built-in Templates

| Template            | Default Subject                    |
| ------------------- | ---------------------------------- |
| `confirmation-code` | Your confirmation code             |
| `password-reset`    | Reset your password                |
| `invite`            | You've been invited to collaborate |
| `getting-started`   | Welcome — get started              |

## Roadmap

Collaboration, local-first storage, notifications, and AI agents are coming. See the [full roadmap](https://github.com/nxsflow/amplify-overtone#roadmap).

## License

[Apache-2.0](https://github.com/nxsflow/amplify-overtone/blob/main/LICENSE)
