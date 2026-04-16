---
title: Getting Started
description: Install and configure Amplify Overtone in your Amplify Gen 2 project.
---

# Getting Started

## Installation

```bash
npm install @nxsflow/amplify-overtone
# or: pnpm add @nxsflow/amplify-overtone
# or: yarn add @nxsflow/amplify-overtone
```

## Setup

Add Amplify Overtone to your Amplify backend definition:

```ts
import { defineBackend } from "@aws-amplify/backend";
import { defineEmail } from "@nxsflow/amplify-overtone";

const email = defineEmail({
    senders: {
        noreply: {
            senderEmail: "noreply@example.com",
            displayName: "MyApp",
        },
    },
});

const backend = defineBackend({
    email,
});
```

For more details on email configuration, see the [Email](/docs/email) section.
