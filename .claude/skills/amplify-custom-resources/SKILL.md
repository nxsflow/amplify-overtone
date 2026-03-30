---
name: amplify-gen2-custom-resources
description: AWS Amplify Gen 2 Custom Resources for extending backends with AWS CDK. Use when adding AWS services beyond built-in Amplify domains, always preferring Amplify-native resources where possible.
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, AskUserQuestion
---

# AWS Amplify Gen 2 Custom Resources

This skill covers extending Amplify Gen 2 backends with custom AWS resources using AWS CDK.

## When to Use This Skill

Invoke this skill when:

- User needs AWS services not built into Amplify (SQS, SNS, etc.)
- User wants to add API Gateway REST APIs
- User needs custom CDK constructs
- User asks about extending Amplify with CDK
- User wants to integrate external AWS services

## CRITICAL: Prefer Amplify-Native Resources

**Always use Amplify-native resources when possible, then extend with CDK.**

```typescript
// ✅ Good - Use Amplify Function, then connect to CDK resources
import { defineFunction } from '@aws-amplify/backend';
export const handler = defineFunction({ name: 'api-handler' });

// In backend.ts, connect Amplify function to API Gateway
const api = new apigateway.RestApi(stack, 'Api');
api.root.addMethod('POST', new apigateway.LambdaIntegration(
    backend.handler.resources.lambda
));

// ❌ Bad - Create Lambda directly in CDK when Amplify can handle it
const fn = new lambda.Function(stack, 'Handler', { ... });
```

---

## CRITICAL: Always Create Separate Constructs

**Never add CDK resources directly in `backend.ts`. Always create separate construct files.**

```
amplify/
├── custom/
│   ├── sqs-queue/
│   │   └── resource.ts       # SqsQueueConstruct
│   └── notification-system/
│       └── resource.ts       # NotificationConstruct
└── backend.ts                # Wire everything together
```

---

## Key Pattern: Amplify Resources + Custom Constructs

When passing Amplify resources to custom constructs:

- **`backend.myFunction.resources.lambda`** → CDK `IFunction` interface (use IN constructs)
- **`backend.myFunction.addEnvironment()`** → Amplify wrapper (for typed `$amplify/env`)

```typescript
// In backend.ts
const construct = new MyConstruct(stack, "MyConstruct", {
    processorFunction: backend.myFunction.resources.lambda, // IFunction for CDK
});

// Add env vars via Amplify wrapper for typed access
backend.myFunction.addEnvironment("QUEUE_URL", construct.queueUrl);
```

---

## Accessing Amplify Resources in Constructs

```typescript
// Use CDK interfaces when accepting Amplify resources as props
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import type { IUserPool } from "aws-cdk-lib/aws-cognito";
import type { IBucket } from "aws-cdk-lib/aws-s3";

export interface MyConstructProps {
    lambdaFunction: IFunction;   // backend.myFn.resources.lambda
    userPool?: IUserPool;        // backend.auth.resources.userPool
    bucket?: IBucket;            // backend.storage.resources.bucket
}
```

---

## Best Practices

### 1. Use Separate Stacks

```typescript
// Each construct gets its own stack
new SqsConstruct(backend.createStack("SqsStack"), "Sqs", {...});
new SnsConstruct(backend.createStack("SnsStack"), "Sns", {...});
```

### 2. Export Values for Typed Environment Access

```typescript
// In construct
export class MyConstruct extends Construct {
    public readonly queueUrl: string; // Export for addEnvironment
}

// In backend.ts
backend.myFunction.addEnvironment("QUEUE_URL", construct.queueUrl);

// In handler — typed!
import { env } from "$amplify/env/my-function";
const url = env.QUEUE_URL;
```

### 3. Grant Permissions via Methods

```typescript
export class MyConstruct {
    grantPublish(fn: IFunction) {
        this.topic.grantPublish(fn);
    }
}

// In backend.ts
myConstruct.grantPublish(backend.sender.resources.lambda);
```

---

## Quick Reference

### Amplify Resource Access

| Resource  | Access Pattern                      |
| --------- | ----------------------------------- |
| Lambda    | `backend.myFn.resources.lambda`     |
| UserPool  | `backend.auth.resources.userPool`   |
| S3 Bucket | `backend.storage.resources.bucket`  |
| GraphQL   | `backend.data.resources.graphqlApi` |

### CDK Interface Types

```typescript
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import type { IUserPool } from "aws-cdk-lib/aws-cognito";
import type { IBucket } from "aws-cdk-lib/aws-s3";
import type { IGraphqlApi } from "aws-cdk-lib/aws-appsync";
```
