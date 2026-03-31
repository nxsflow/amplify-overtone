---
name: amplify-gen2-overview
description: Overview of AWS Amplify Gen 2 for understanding its code-first, CDK-centric architecture. Use this to understand Amplify's purpose, project structure, and core concepts before diving into specific domains.
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, AskUserQuestion
---

# AWS Amplify Gen 2 Overview

This skill provides a comprehensive overview of AWS Amplify Gen 2, the code-first developer experience for building fullstack cloud applications.

## When to Use This Skill

Invoke this skill when:

- User is new to Amplify and needs to understand its purpose
- User asks about Amplify project structure or architecture
- User needs to understand the difference between Gen 1 and Gen 2
- User wants to set up a new Amplify project
- User asks about Amplify's relationship to CDK

## CRITICAL: Gen 2 Only

**AWS Amplify Gen 2 is the ONLY supported version.** Gen 1 (CLI-driven) is deprecated.

**Gen 2 Characteristics:**

- Code-first TypeScript backend definitions
- File-based conventions (`amplify/auth/resource.ts`, etc.)
- Built on AWS CDK
- Per-developer cloud sandboxes
- Git branch-based deployments

**DO NOT use Gen 1 patterns:**

- ❌ `amplify add auth` CLI commands
- ❌ `amplify push` CLI commands
- ❌ GraphQL schema files (`.graphql`)
- ❌ `amplify/backend/` directory structure

---

## What is AWS Amplify Gen 2?

AWS Amplify Gen 2 is a **TypeScript-based, code-first developer experience** for building fullstack cloud applications.

### Key Benefits

1. **Code-First DX**: Define backends in TypeScript with full type safety
2. **Built on CDK**: Extend with any AWS service using AWS CDK constructs
3. **Per-Developer Sandboxes**: Isolated cloud environments for each developer
4. **Git-Based Deployments**: Branch-to-environment mapping (main → production)
5. **Zero Config CI/CD**: Automatic deployments on git push
6. **End-to-End Types**: TypeScript types flow from backend to frontend

### Core Domains

| Domain        | Purpose                        | AWS Services          |
| ------------- | ------------------------------ | --------------------- |
| **Auth**      | Authentication & authorization | Amazon Cognito        |
| **Data**      | Real-time APIs & databases     | AWS AppSync, DynamoDB |
| **Storage**   | File storage & management      | Amazon S3             |
| **Functions** | Serverless compute             | AWS Lambda            |
| **AI**        | Generative AI capabilities     | Amazon Bedrock        |

All other AWS services can be added via CDK constructs as Custom Resources.

---

## The ConstructFactory Pattern

Every Amplify category returns a `ConstructFactory<T>` from `@aws-amplify/plugin-types`. This is the interface this library implements:

```typescript
type ConstructFactory<T extends ResourceProvider = ResourceProvider> = {
  readonly provides?: string;
  getInstance: (props: ConstructFactoryGetInstanceProps) => T;
};
```

`defineBackend()` calls `getInstance()` on each factory, which lazily creates the CDK construct. This allows:

- Deferred instantiation until deployment time
- Dependency resolution between resources
- Integration with the Amplify resource graph

### How Amplify Overtone fits in

```typescript
import { n } from "@nxsflow/amplify-overtone";
import { defineBackend } from "@aws-amplify/backend";

const schema = n.schema({
  /* ... */
});
const data = defineData({
  schema,
  /* ... */
});
const backend = defineBackend({ auth, data }); // overtone constructs are applied separately
```

---

## Core Concepts

### Resource Definitions

Resources are defined using `define*` helper functions and combined in `amplify/backend.ts`:

```typescript
import { defineBackend } from "@aws-amplify/backend";

const backend = defineBackend({
  auth,
  data,
});
```

### CDK Integration

After `defineBackend()`, access the underlying CDK resources:

```typescript
const overtoneResources = backend.data.resources;
// overtoneResources.graphqlApi — IGraphqlApi
// overtoneResources.tables — Record<string, ITable>
```

---

## Quick Reference

### CLI Commands

| Command                     | Description                   |
| --------------------------- | ----------------------------- |
| `npm create amplify@latest` | Initialize Amplify in project |
| `npx ampx sandbox`          | Start development sandbox     |
| `npx ampx sandbox delete`   | Delete sandbox resources      |
| `npx ampx generate outputs` | Generate client config        |

### Helper Functions

| Function         | Import                      | Purpose                  |
| ---------------- | --------------------------- | ------------------------ |
| `defineBackend`  | `@aws-amplify/backend`      | Create backend entry     |
| `defineAuth`     | `@aws-amplify/backend`      | Configure authentication |
| `defineData`     | `@aws-amplify/backend`      | Configure data/API       |
| `defineFunction` | `@aws-amplify/backend`      | Define Lambda function   |
| `n.schema`       | `@nxsflow/amplify-overtone` | Define overtone schema   |
