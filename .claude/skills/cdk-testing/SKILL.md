---
name: cdk-testing
description: Testing patterns for @nxsflow/amplify-overtone — test organization, CDK assertions API, concrete assertion recipes for Lambda/IAM/custom resources, and test helpers. Use when writing tests, adding coverage, or debugging test failures.
---

# CDK Testing for @nxsflow/amplify-overtone

Comprehensive guide for testing CDK constructs and factory logic in this library.

## Test Organization

```
packages/amplify-overtone/test/
├── unit/                    # No CDK Stack needed — fast, isolated
│   ├── factory.test.ts      # defineOvertone(), singleton, prop validation
│   └── types.test.ts        # (future) type guard / validation tests
└── construct/               # CDK Template assertions — synthesizes stacks
    ├── helpers.ts            # Shared createOvertoneTemplate() utility
    ├── resources.test.ts     # Core construct resources
    ├── lambda.test.ts        # Handler Lambda function
    └── iam.test.ts           # IAM policy grants

packages/integration-tests/  # E2E tests against deployed infrastructure (private)
```

Vitest config for the construct package: `packages/amplify-overtone/vitest.config.ts` matches `include: ["test/**/*.test.ts"]`.

**When to write which:**

- **Unit tests** (`packages/amplify-overtone/test/unit/`): Testing pure logic — factory behavior, prop validation, error messages. No `App` or `Stack` needed. These run fast.
- **Construct tests** (`packages/amplify-overtone/test/construct/`): Testing the CloudFormation output of `OvertoneConstruct`. Always use `Template.fromStack()` to assert on synthesized resources.
- **Integration tests** (`packages/integration-tests/`): E2E tests against deployed AWS infrastructure. Uses the test infrastructure defined in `packages/test-infra/`.

---

## Unit Test Patterns

### Singleton Reset

`OvertoneFactory` uses a static counter to enforce one `defineOvertone()` per backend. Reset between tests:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { OvertoneFactory } from "../../src/factory.js"; // relative within packages/amplify-overtone/
import { defineOvertone } from "../../src/index.js";

describe("defineOvertone", () => {
  beforeEach(() => {
    OvertoneFactory.factoryCount = 0;
  });

  it("returns an object with a getInstance method", () => {
    const factory = defineOvertone({});
    expect(factory).toBeDefined();
    expect(typeof factory.getInstance).toBe("function");
  });

  it("throws on second call", () => {
    defineOvertone({});
    expect(() => defineOvertone({})).toThrow();
  });
});
```

### Prop Validation

Test that invalid props produce clear error messages:

```typescript
it("rejects invalid configuration", () => {
  expect(() => defineOvertone({ invalidProp: "value" } as any)).toThrow(
    /invalid/i,
  );
});
```

### No CDK Dependency

Unit tests should never import `aws-cdk-lib`. If a test needs `App` or `Stack`, it belongs in `test/construct/`.

---

## CDK Assertions API Reference

Import everything from `aws-cdk-lib/assertions`:

```typescript
import { Capture, Match, Template } from "aws-cdk-lib/assertions";
```

### Template Methods

| Method                                        | Purpose                                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| `Template.fromStack(stack)`                   | Synthesize a stack and wrap it for assertions                  |
| `template.hasResourceProperties(type, props)` | Assert a resource exists with these properties (partial match) |
| `template.hasResource(type, props)`           | Match including metadata, condition, DependsOn                 |
| `template.resourceCountIs(type, count)`       | Assert exact number of resources of this type                  |
| `template.findResources(type, props?)`        | Return all matching resources as an object                     |
| `template.hasOutput(logicalId, props)`        | Validate stack outputs                                         |

### Match Helpers

| Matcher                           | Purpose                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| `Match.objectLike({})`            | Partial object match (default for `hasResourceProperties`) |
| `Match.objectEquals({})`          | Exact object match — fails if extra keys present           |
| `Match.anyValue()`                | Matches anything except absent                             |
| `Match.absent()`                  | Asserts key does not exist                                 |
| `Match.not(inner)`                | Inverts a matcher                                          |
| `Match.serializedJson(inner)`     | Parse a JSON string, then apply inner matcher              |
| `Match.arrayWith([...])`          | Array contains these elements (order-independent)          |
| `Match.exact(value)`              | Exact primitive match                                      |
| `Match.stringLikeRegexp(pattern)` | Matches a string against a regex pattern                   |

### Capture

Capture a dynamic value from the template for later assertion:

```typescript
const arnCapture = new Capture();
template.hasResourceProperties("AWS::IAM::Policy", {
  PolicyDocument: {
    Statement: [{ Resource: arnCapture }],
  },
});
expect(arnCapture.asString()).toContain(":lambda:");
```

### Key Principles

1. **Fresh `App` + `Stack` per test** — CDK construct trees are stateful. Never reuse across tests.
2. **Assert on CloudFormation output** — use `Template.fromStack()`, not construct properties.
3. **No mocking needed** — CDK synthesis doesn't call AWS. All assertions are against the template JSON.
4. **Reset `OvertoneFactory.factoryCount`** in `beforeEach` when testing the factory.

---

## Concrete OvertoneConstruct Assertion Recipes

### Test Helper

All construct tests share this helper:

```typescript
// packages/amplify-overtone/test/construct/helpers.ts
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { OvertoneConstruct } from "../../src/construct.js";
import type { OvertoneProps } from "../../src/types.js";

const defaultProps: OvertoneProps = {};

export function createOvertoneTemplate(
  overrides?: Partial<OvertoneProps>,
): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack");
  new OvertoneConstruct(stack, "Overtone", { ...defaultProps, ...overrides });
  return Template.fromStack(stack);
}
```

Common `beforeEach` pattern:

```typescript
import { type Template } from "aws-cdk-lib/assertions";
import { beforeEach, describe, expect, it } from "vitest";
import { createOvertoneTemplate } from "./helpers.js";

let template: Template;

beforeEach(() => {
  template = createOvertoneTemplate();
});
```

---

### Core Resources (`packages/amplify-overtone/test/construct/resources.test.ts`)

```typescript
import { Match, type Template } from "aws-cdk-lib/assertions";
import { beforeEach, describe, expect, it } from "vitest";
import { createOvertoneTemplate } from "./helpers.js";

describe("Core resources", () => {
  let template: Template;

  beforeEach(() => {
    template = createOvertoneTemplate();
  });

  it("creates the primary resource", () => {
    // Assert the main AWS resource type created by OvertoneConstruct
    // Replace "AWS::SomeService::SomeResource" with the actual resource type
    expect(template.toJSON().Resources).toBeDefined();
  });

  it("creates exactly one handler Lambda", () => {
    template.resourceCountIs("AWS::Lambda::Function", 1);
  });
});
```

### Lambda Function (`packages/amplify-overtone/test/construct/lambda.test.ts`)

```typescript
import { Match, type Template } from "aws-cdk-lib/assertions";
import { beforeEach, describe, expect, it } from "vitest";
import { createOvertoneTemplate } from "./helpers.js";

describe("Handler Lambda", () => {
  let template: Template;

  beforeEach(() => {
    template = createOvertoneTemplate();
  });

  it("creates a Lambda function with Node 22", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Timeout: 15,
    });
  });

  it("passes required environment variables", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          // Add expected environment variable keys here
        }),
      },
    });
  });
});
```

### IAM Policy (`packages/amplify-overtone/test/construct/iam.test.ts`)

```typescript
import { Match, type Template } from "aws-cdk-lib/assertions";
import { beforeEach, describe, expect, it } from "vitest";
import { createOvertoneTemplate } from "./helpers.js";

describe("IAM permissions", () => {
  let template: Template;

  beforeEach(() => {
    template = createOvertoneTemplate();
  });

  it("grants required permissions to the Lambda", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            // Replace with actual actions granted by OvertoneConstruct
            Action: Match.anyValue(),
            Effect: "Allow",
          }),
        ]),
      },
    });
  });
});
```
