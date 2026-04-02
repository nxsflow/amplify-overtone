---
title: defineEmail()
description: Configure transactional email infrastructure for your Amplify backend.
---

# defineEmail()

`defineEmail()` is a singleton factory that provisions Amazon SES resources — domain identity, named senders, a send-email Lambda function, and optional Route 53 DNS records.

## Usage Modes

### Without Custom Domain (Simplest)

Each sender provides a full email address that you verify individually in SES:

```ts
import { defineEmail } from "@nxsflow/amplify-overtone";

export const email = defineEmail({
    senders: {
        noreply: {
            senderEmail: "noreply@gmail.com",
            displayName: "MyApp",
        },
    },
});
```

### With Custom Domain

Senders provide a prefix. The domain identity handles authentication for all senders:

```ts
export const email = defineEmail({
    domain: "mail.example.com",
    senders: {
        noreply: {
            senderPrefix: "noreply",
            displayName: "MyApp",
        },
        support: {
            senderPrefix: "support",
            displayName: "MyApp Support",
        },
    },
});
```

### With Route 53 DNS Automation

Provide your hosted zone to auto-create MX, CNAME, and TXT records:

```ts
export const email = defineEmail({
    domain: "mail.example.com",
    hostedZoneId: "Z0123456789ABCDEFGHIJ",
    hostedZoneDomain: "example.com",
    senders: {
        noreply: {
            senderPrefix: "noreply",
            displayName: "MyApp",
        },
    },
});
```

## Configuration

| Property | Type | Description |
|----------|------|-------------|
| `domain` | `string` | Custom email domain (e.g., `"mail.example.com"`) |
| `hostedZoneId` | `string` | Route 53 hosted zone ID for DNS automation |
| `hostedZoneDomain` | `string` | Root domain of the hosted zone (e.g., `"example.com"`) |
| `senders` | `Record<string, SenderConfig>` | Named sender configurations |
| `defaultSender` | `string` | Default sender key (defaults to `"noreply"`) |
| `sandboxRecipients` | `string[]` | Recipient addresses to verify in SES sandbox mode |
| `timeoutSeconds` | `number` | Lambda timeout (defaults to `15`) |
