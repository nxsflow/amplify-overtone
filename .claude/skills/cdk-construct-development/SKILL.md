---
name: cdk-construct-development
description: Patterns for developing and testing CDK constructs inside the Amplify Overtone library. Use when writing or extending OvertoneConstruct, working with the ConstructFactory pattern, or testing CDK constructs with aws-cdk-lib/assertions.
---

# CDK Construct Development for Amplify Overtone

This skill covers how to write, extend, and test CDK constructs in this library.

## The ConstructFactory Pattern

Every Amplify category implements this interface from `@aws-amplify/plugin-types`:

```typescript
type ConstructFactory<T extends ResourceProvider = ResourceProvider> = {
  readonly provides?: string;
  getInstance: (props: ConstructFactoryGetInstanceProps) => T;
};

type ResourceProvider<T = Record<string, unknown>> = {
  resources: T;
};
```

`OvertoneFactory` in `packages/amplify-overtone/src/factory.ts` implements this. `defineBackend()` calls `getInstance()` to lazily create the CDK construct.

### Critical: `getInstance` is called once per Amplify backend

The `OvertoneFactory` enforces this with a static counter. Calling `defineOvertone()` twice throws. Tests must reset this counter between test cases or use separate test files.

---

## Writing CDK Constructs in this Library

### Structure

```
packages/amplify-overtone/src/
├── types.ts         ← OvertoneProps, OvertoneResources interfaces
├── construct.ts     ← OvertoneConstruct extends Construct
├── factory.ts       ← OvertoneFactory, defineOvertone()
└── index.ts         ← public barrel export
```

### Construct Template

```typescript
// packages/amplify-overtone/src/construct.ts
import { Stack } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import type { OvertoneProps, OvertoneResources } from "./types.js";

export class OvertoneConstruct extends Construct {
  public readonly resources: OvertoneResources;

  constructor(scope: Construct, id: string, props: OvertoneProps) {
    super(scope, id);

    // Create Lambda
    const handlerFn = new NodejsFunction(this, "OvertoneHandlerFunction", {
      entry: new URL("./functions/handler/handler.ts", import.meta.url)
        .pathname,
      // ...
    });

    // Create additional AWS resources as needed
    // ...

    // Expose resources
    this.resources = {
      lambda: handlerFn,
      lambdaFunctionName: handlerFn.functionName,
    };
  }
}
```

---

## Testing CDK Constructs

### Unit Testing with `aws-cdk-lib/assertions`

CDK provides a powerful assertions API. Use it for construct unit tests:

```typescript
// packages/amplify-overtone/test/construct.test.ts
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { OvertoneConstruct } from "../src/construct.js";

describe("OvertoneConstruct construct", () => {
  it("creates a Lambda function", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    new OvertoneConstruct(stack, "Overtone", {});

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Timeout: 15,
    });
  });

  it("creates exactly one Lambda function", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    new OvertoneConstruct(stack, "Overtone", {});

    const template = Template.fromStack(stack);
    template.resourceCountIs("AWS::Lambda::Function", 1);
  });

  it("creates supporting AWS resources", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    new OvertoneConstruct(stack, "Overtone", {});

    const template = Template.fromStack(stack);
    // Assert on any additional resources created by the construct
    expect(template.toJSON()).toBeDefined();
  });
});
```

### Key Testing Principles

1. **Always create a fresh `App` + `Stack` per test** — CDK construct trees are stateful
2. **Use `Template.fromStack()` for assertions** — never inspect construct properties directly
3. **Test the CloudFormation output**, not the TypeScript API — that's what actually deploys
4. **Mock external services**: CDK constructs don't call AWS at synthesis time, so no mocking needed for CDK tests
5. **Reset `OvertoneFactory.factoryCount`** between tests if testing the factory (use `beforeEach`)

### Template Assertion Cheatsheet

```typescript
const template = Template.fromStack(stack);

// Assert a resource exists with specific properties
template.hasResourceProperties("AWS::Lambda::Function", {
  Runtime: "nodejs22.x",
  Timeout: 15,
});

// Count resources
template.resourceCountIs("AWS::Lambda::Function", 1);

// Find all resources of a type
const records = template.findResources("AWS::IAM::Policy");

// Assert an output exists
template.hasOutput("OvertoneOutput", { Value: "some-value" });

// Assert IAM policy statement
template.hasResourceProperties("AWS::IAM::Policy", {
  PolicyDocument: {
    Statement: [
      {
        Action: ["execute-api:Invoke"],
        Effect: "Allow",
      },
    ],
  },
});
```

---

## tsup Build Notes

The library uses tsup with `external: ["aws-cdk-lib", "constructs", "@aws-amplify/plugin-types"]`.

- All CDK imports are externalized — they must be provided by the consumer's project
- Use `.js` extensions in source imports (tsup resolves them to `.ts` during build)
- `dts: true` generates `.d.ts` files from TypeScript source
- Build output: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts`

### Lambda handler bundling

Lambda handlers inside the construct (e.g. `packages/amplify-overtone/src/functions/handler/handler.ts`) need to be bundled separately from the library. The `NodejsFunction` CDK construct handles this at synthesis time using esbuild. The handler file is **not** exported from the library barrel — it's embedded in the construct.

---

## Peer Dependency Convention

| Package                     | Range     | Rule                                             |
| --------------------------- | --------- | ------------------------------------------------ |
| `aws-cdk-lib`               | `^2.0.0`  | Permissive — consumer controls their CDK version |
| `constructs`                | `^10.0.0` | CDK base class                                   |
| `@aws-amplify/plugin-types` | `^1.0.0`  | ConstructFactory interface                       |

**Rules:**

- Never bundle peer deps — they're externalized in tsup config
- Test against the minimum supported version, not latest
- Keep ranges permissive (`^2.0.0` not `^2.170.0`) — consumers have their own CDK constraints
- Bumping a peer dep minimum range is a **major** version bump for this library

---

## Common Pitfalls

### "Cannot find module 'constructs'" in tests

Add `aws-cdk-lib` and `constructs` as devDependencies. They're peer deps for consumers but needed for testing.

### "Stack is not in any Construct node" error

You must use `new App()` as the root. Don't try to instantiate a construct outside a Stack.

### CDK synthesis warnings about deprecated APIs

Check the CDK changelog. Use `aws-cdk-lib/aws-*` (L2) not `@aws-cdk/aws-*` (old L1).
