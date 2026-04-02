---
title: Email
description: Transactional email via Amazon SES — custom domains, named senders, built-in templates, and DNS automation.
---

# Email

Transactional email via Amazon SES — custom domains, named senders, built-in templates, and DNS automation.

## Overview

Amplify Overtone's email category lets you declare email infrastructure in your Amplify backend. Call `defineEmail()` to provision:

- **SES domain identity** with DKIM/SPF/DMARC authentication
- **Named senders** (e.g., `noreply@mail.example.com`, `support@mail.example.com`)
- **Send-email Lambda function** with typed payloads
- **Optional Route 53 DNS records** for automatic domain verification

## Quick Start

```ts
import { defineEmail } from "@nxsflow/amplify-overtone";

export const email = defineEmail({
    domain: "mail.example.com",
    senders: {
        noreply: {
            senderPrefix: "noreply",
            displayName: "MyApp",
        },
    },
});
```

See [defineEmail()](/docs/email/define-email) for the full API reference.
