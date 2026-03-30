# @nxsflow/amplify-overtone — Technical Specification

> _"Overtone adds the richness that Amplify's core signal doesn't cover — collaboration, offline-first, and schema-defined actions."_

## 1. Overview

### 1.1 Purpose

`@nxsflow/amplify-overtone` is a TypeScript library that extends AWS Amplify Gen 2's data layer with three core capabilities:

1. **Collaborative Data** — CRDT-based conflict-free editing with an operations log
2. **Authorization Inheritance** — Declarative permission propagation from parent to child models
3. **Local-First Storage** — Offline-capable IndexedDB sync with lease-based authorization
4. **Schema-Defined Actions** — Typed, server-executed operations (Email, Push Notifications, Webhooks) invocable from the client

The library acts as a **schema compiler**: it accepts an extended schema definition, produces standard Amplify-compatible CDK constructs plus additional infrastructure, and generates type-safe client definitions.

### 1.2 Design Principles

- **Companion, not fork.** `n` (nxsflow) works alongside Amplify's `a` namespace. Standard Amplify types (`a.string()`, `a.id()`, `a.integer()`, etc.) are used for field definitions. `n` extends with higher-level abstractions.
- **Declarative over imperative.** Developers express _what_ they want (collaborative, local-first, auth-inherited) in the schema. The library decides _how_ (DDB tables, resolvers, streams, client-side sync).
- **Opt-in per model.** Each capability (`.collaborative()`, `.localFirst()`, `.inheritsAuthRules()`) is independently toggleable per model.
- **Type-safe end-to-end.** The schema definition produces TypeScript types for the client. Actions, models, and relations are fully typed.

### 1.3 Package Structure

```
@nxsflow/amplify-overtone    — Main package (schema builder, CDK constructs, codegen)
├── /schema                  — Schema builder (n.schema, n.model, n.email, etc.)
├── /constructs              — CDK constructs (OpsLog tables, auth propagation, SES)
├── /resolvers               — AppSync VTL/JS resolver templates
├── /client                  — Client-side runtime (sync engine, IndexedDB, CRDT merge)
├── /codegen                 — Type generation from schema AST
└── /utils                   — Shared utilities (version vectors, lease management)
```

---

## 2. Schema Definition Layer

### 2.1 `n.schema()`

`n.schema()` is the top-level entry point. It wraps `a.schema()` internally but additionally processes nxsflow-specific extensions.

```typescript
import { n } from "@nxsflow/amplify-overtone";
import { a } from "@aws-amplify/backend";

const schema = n
  .schema({
    // Models (data)
    Document: n.model({
      /* ... */
    }),
    DocumentParagraph: n.model({
      /* ... */
    }),

    // Actions (side effects)
    inviteEmail: n.email({
      /* ... */
    }),
  })
  .conflicts("automerge"); // Global CRDT strategy
```

**Processing pipeline:**

```
n.schema(definition)
  │
  ├─ 1. Parse & validate the extended schema AST
  ├─ 2. Extract standard Amplify fields → delegate to a.schema()
  ├─ 3. Extract nxsflow extensions:
  │     ├─ collaborative models → generate OpsLog table definitions
  │     ├─ auth inheritance → generate propagation triggers
  │     ├─ local-first models → generate sync metadata fields
  │     └─ actions → generate resolver + infra definitions
  ├─ 4. Produce CDK construct descriptors
  └─ 5. Produce client codegen input
```

**Return type:** `n.schema()` returns an object compatible with Amplify's `defineData({ schema })` but enriched with metadata consumed by the nxsflow CDK constructs.

### 2.2 `n.model()`

`n.model()` extends `a.model()` with additional chainable methods.

```typescript
Document: n.model({
  documentId: a.id().required(),
  name: a.string(),
  owner: n.owner().required(),
  coOwners: n.coOwners(),
  editors: n.editors(),
  readers: n.readers(),
  paragraphs: n.hasMany("DocumentParagraph", "documentId").inheritsAuthRules(),
})
  .identifier(["documentId"])
  .collaborative()
  .localFirst();
```

**Chainable methods on `n.model()`:**

| Method                | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `.identifier(fields)` | Pass-through to `a.model().identifier()`             |
| `.collaborative()`    | Enable CRDT-based conflict resolution for this model |
| `.localFirst()`       | Enable IndexedDB-first storage with background sync  |
| `.authorization(fn)`  | Standard Amplify auth rules (pass-through)           |

**Behavior rules:**

- `.localFirst()` implies `.collaborative()`. A model cannot be local-first without conflict resolution.
- `.collaborative()` does NOT imply `.localFirst()`. A model can use server-side CRDT without offline support.
- If a model has `.inheritsAuthRules()` on a relation from a parent that is `.collaborative()`, the child is automatically `.collaborative()` as well.

### 2.3 Authorization Fields

Instead of Amplify's `.authorization()` chain, nxsflow models authorization as **first-class data fields**. This makes permissions queryable, indexable, and inheritable.

```typescript
owner: n.owner().required(); // Single owner (string: user sub/identity)
coOwners: n.coOwners(); // Array of user subs with full owner-level access
editors: n.editors(); // Array of user subs with read + update access
readers: n.readers(); // Array of user subs with read-only access
```

**Underlying DynamoDB representation:**

```json
{
  "documentId": "doc-123",
  "name": "My Document",
  "owner": "user-sub-aaa",
  "coOwners": ["user-sub-bbb"],
  "editors": ["user-sub-ccc", "user-sub-ddd"],
  "readers": ["user-sub-eee"]
}
```

**Generated AppSync authorization logic:**

For each operation, the resolver checks:

- **Create:** caller must be `owner` or in `coOwners`
- **Read:** caller must be `owner`, in `coOwners`, `editors`, or `readers`
- **Update:** caller must be `owner`, in `coOwners`, or `editors`
- **Delete:** caller must be `owner` or in `coOwners`
- **Manage permissions (add/remove editors/readers):** caller must be `owner` or in `coOwners`

These rules are generated as AppSync JS resolvers at deploy time.

### 2.4 Relations & Authorization Inheritance

#### 2.4.1 `n.hasMany()` with `.inheritsAuthRules()`

```typescript
paragraphs: n.hasMany("DocumentParagraph", "documentId").inheritsAuthRules();
```

**Semantics:** Every `DocumentParagraph` inherits its authorization from the `Document` identified by `documentId`. The child model does NOT need its own `owner`/`editors`/`readers` fields in the schema definition.

**Implementation strategy — Denormalization with event-driven propagation:**

1. **On child creation:** The AppSync resolver reads the parent's auth fields and copies them to the child record as `__inheritedOwner`, `__inheritedCoOwners`, `__inheritedEditors`, `__inheritedReaders` (prefixed to avoid field name collisions).

2. **On parent auth change:** A DynamoDB Stream triggers a Lambda function that queries all children by `documentId` (via GSI) and updates their inherited auth fields.

3. **On child read/update/delete:** The resolver checks the inherited auth fields on the child record directly (no parent lookup required at read time — this is critical for performance).

**Generated infrastructure:**

- GSI on child table: `documentId` as partition key (for efficient fan-out queries)
- DynamoDB Stream on parent table (filtered to auth field changes)
- Lambda function: `AuthPropagation-{modelName}`

#### 2.4.2 `n.belongsTo()`

```typescript
DocumentParagraph: n.model({
  documentId: a.string().required(),
  document: n.belongsTo("Document", "documentId"),
  content: a.string(),
  sortOrder: a.integer(),
});
```

`n.belongsTo()` behaves identically to `a.belongsTo()` but is auth-inheritance-aware. If the parent's `hasMany` declares `.inheritsAuthRules()`, the child's resolver logic is auto-generated.

#### 2.4.3 Deep Inheritance

For chains like `Document → DocumentParagraph → ParagraphComment`:

```typescript
DocumentParagraph: n.model({
  documentId: a.string().required(),
  document: n.belongsTo("Document", "documentId"),
  comments: n.hasMany("ParagraphComment", "paragraphId").inheritsAuthRules(),
});
```

The auth propagation must resolve transitively. `ParagraphComment` inherits from `DocumentParagraph`, which inherits from `Document`. The Lambda propagation function must handle cascading updates:

1. `Document` auth changes → update all `DocumentParagraph` records → update all `ParagraphComment` records.
2. This is implemented as a **recursive fan-out**: each level's DDB Stream triggers the next level's propagation.

**Depth limit:** Maximum 3 levels of inheritance. Beyond that, the developer must use `n.authRoot("Document", "documentId")` to skip intermediate levels and point directly to the root.

### 2.5 Collaborative Models (CRDT)

#### 2.5.1 CRDT Strategy

The library uses **Automerge** as its CRDT engine. Rationale:

- Native JSON document model (maps directly to DynamoDB items)
- Binary-efficient sync protocol
- Strong TypeScript support
- Supports both text and structured data (unlike Yjs which is optimized primarily for sequential text)

The CRDT strategy is set at the schema level:

```typescript
n.schema({
  /* ... */
}).conflicts("automerge");
```

Currently only `"automerge"` is supported. The architecture allows future strategies but mixing strategies within a schema is not permitted.

#### 2.5.2 Dual Storage Model

Each `.collaborative()` model produces TWO DynamoDB tables:

1. **State Table** (`{ModelName}-Table`): Holds the materialized/merged current state. Used for fast reads, GSI queries, and non-collaborative access patterns. This is the standard Amplify-generated table.

2. **OpsLog Table** (`{ModelName}-OpsLog`): Holds Automerge sync messages (binary operations). Schema:

```
OpsLog Table Schema:
  PK: documentId (same as parent record ID)
  SK: {clientId}#{timestamp}#{sequenceNumber}
  Attributes:
    - ops: Binary (Automerge encoded operations)
    - clientId: String (unique per client instance)
    - timestamp: Number (Unix ms)
    - ttl: Number (Unix seconds — for automatic cleanup after compaction)
```

#### 2.5.3 Read Path

Two read modes:

**Standard read** (`client.models.Document.get({ id })`):

- Reads only from the State Table
- Returns the last-compacted state
- Fast, cheap, eventually consistent with ongoing edits

**Collaborative read** (`client.models.Document.observe({ id })`):

- Returns an Observable/subscription
- On initial load: reads State Table + OpsLog, merges with Automerge
- On subsequent updates: receives real-time OpsLog entries via AppSync subscription, applies incrementally
- This is the mode used by collaborative editing UIs

#### 2.5.4 Write Path

**All writes to collaborative models go through the OpsLog:**

1. Client computes Automerge operations locally
2. Client sends ops to OpsLog table via AppSync mutation
3. AppSync subscription broadcasts the ops to all connected clients
4. A DynamoDB Stream on the OpsLog triggers a **Compaction Lambda** that:
   a. Reads the current State Table record
   b. Applies new ops via Automerge
   c. Writes the merged state back to State Table
   d. Marks compacted ops with a TTL (default: 7 days)

**Important:** The State Table is NEVER written to directly by clients. It is only updated by the Compaction Lambda.

#### 2.5.5 Compaction Strategy

The OpsLog grows unboundedly without compaction. The Compaction Lambda runs on every OpsLog write (via Stream) and:

1. Loads the current Automerge document from the State Table (`__automergeState` binary field)
2. Applies all new ops
3. Saves the updated Automerge document back
4. Sets TTL on processed OpsLog entries

**Full compaction** (periodic, via EventBridge schedule — e.g., daily):

- Creates a fresh Automerge snapshot
- Replaces the `__automergeState` field
- Allows old ops to expire via TTL

#### 2.5.6 Version Vectors

Each client maintains a **version vector** — a map of `{ clientId: lastSeenSequenceNumber }`. When syncing:

1. Client sends its version vector to the server
2. Server returns only ops not yet seen by that client
3. Client applies ops and updates its local version vector

This is stored on the client (IndexedDB for local-first models, in-memory otherwise).

### 2.6 Local-First Models

#### 2.6.1 `.localFirst()` Behavior

```typescript
Document: n.model({
  /* ... */
})
  .collaborative()
  .localFirst();
```

A local-first model:

- Stores all data in IndexedDB (via **cr-sqlite** WASM — SQLite with CRDT support)
- Reads always hit local storage first (zero latency)
- Writes go to local storage immediately, then sync to DynamoDB in the background
- Works fully offline

#### 2.6.2 Local Storage Architecture

**cr-sqlite** is chosen over raw IndexedDB because:

- Full SQL query support locally (not just key-value)
- Built-in CRDT column types
- Reactive queries (subscribe to query result changes)
- Efficient binary sync protocol

**Local schema** (auto-generated per model):

```sql
CREATE TABLE Document (
  documentId TEXT PRIMARY KEY,
  name TEXT,
  owner TEXT NOT NULL,
  coOwners TEXT,  -- JSON array
  editors TEXT,   -- JSON array
  readers TEXT,   -- JSON array
  __automergeState BLOB,
  __syncVersion TEXT,    -- version vector as JSON
  __lastSyncedAt INTEGER, -- Unix ms
  __leaseExpiresAt INTEGER, -- Unix ms
  __pendingOps INTEGER DEFAULT 0
);
```

#### 2.6.3 Sync Protocol

**Online → Offline transition:**

1. All data is already local (no special handling needed)
2. Writes continue to local storage
3. OpsLog entries are queued in a local `__pendingSync` table

**Offline → Online transition (reconnect):**

1. Renew authorization lease (see §2.6.4)
2. Check if permissions changed during offline period
3. If permissions revoked: delete local data, discard pending ops, notify user
4. If permissions intact: push pending OpsLog entries to server, pull new ops from server, Automerge merge locally

**Conflict during sync:** Not possible in the traditional sense — Automerge guarantees conflict-free merge. However, **intent conflicts** can occur (e.g., two users delete the same paragraph). These are resolved by Automerge's deterministic merge semantics (last-writer-wins for scalar fields, set-union for collections).

#### 2.6.4 Lease-Based Offline Authorization

**Problem:** When offline, the server cannot validate permissions. A user whose access was revoked could continue reading/editing locally indefinitely.

**Solution:** Authorization leases with role-based TTLs.

**Lease structure:**

```typescript
interface AuthorizationLease {
  modelId: string; // e.g., "doc-123"
  modelName: string; // e.g., "Document"
  userId: string; // user sub
  role: "owner" | "coOwner" | "editor" | "reader";
  grantedAt: number; // Unix ms
  expiresAt: number; // Unix ms
  lastVerifiedAt: number; // Unix ms — last successful server check
}
```

**Default TTLs by role:**

| Role      | Offline Lease Duration | Post-Expiry Behavior                              |
| --------- | ---------------------- | ------------------------------------------------- |
| `owner`   | Unlimited              | Never restricted offline                          |
| `coOwner` | 7 days                 | Falls to read-only, then data retained but locked |
| `editor`  | 48 hours               | Falls to read-only                                |
| `reader`  | 7 days                 | Local data is **deleted** (privacy/security)      |

**TTL configuration in schema:**

```typescript
n.schema({
  /* ... */
}).localFirst({
  leases: {
    coOwner: "7d",
    editor: "48h",
    reader: "7d",
  },
});
```

**Lease lifecycle:**

1. **Grant:** On first sync, server issues a lease stored in IndexedDB
2. **Renewal:** Every successful sync renews the lease
3. **Expiry check:** Client checks lease on every read. If expired:
   - Editor → model switches to read-only locally. UI receives an event: `onLeaseExpired({ modelId, role, action: "readOnly" })`
   - Reader → local data is purged. UI receives: `onLeaseExpired({ modelId, role, action: "purged" })`
4. **Revocation on reconnect:** Server compares current permissions with lease. If revoked, sends a `REVOKE` message that triggers immediate local cleanup.

**Developer-facing API:**

```typescript
// Listen for lease events in the UI
client.models.Document.onLeaseExpired(({ modelId, role, action }) => {
  if (action === "readOnly") {
    showBanner(
      "Your editing access has expired. Reconnect to continue editing.",
    );
  }
  if (action === "purged") {
    showBanner("Your access to this document has expired.");
    navigateAway();
  }
});
```

---

## 3. Schema-Defined Actions

### 3.1 Concept

Actions are **server-executed operations** defined in the schema and callable from the client. They follow the same declarative pattern as models but instead of CRUD operations, they trigger side effects (send email, push notification, webhook, etc.).

Actions are NOT models. They do not have tables. They produce AppSync mutations with custom resolvers.

### 3.2 Email Actions — `n.email()`

#### 3.2.1 Schema Definition

```typescript
inviteEmail: n.email({
  sender: "noreply", // key from defineEmail() senders
  subject: ({ inviter }) => `${inviter} has invited you to collaborate`,
  template: "invite-v1", // key from defineEmail() templates
})
  .arguments({
    recipientEmail: a.email().required(),
    invitee: a.string().required(),
    inviter: a.string().required(),
    documentId: a.id().required(),
    documentName: a.string().required(),
  })
  .returns(
    a.customType({
      messageId: a.string().required(),
      status: a.enum(["sent", "queued", "failed"]),
    }),
  )
  .authorization((allow) => [allow.authenticated()]);
```

#### 3.2.2 Backend Infrastructure — `defineEmail()`

```typescript
// In backend definition file
import { defineEmail } from "@nxsflow/amplify-overtone";

const email = defineEmail({
  domain: "notifications.nexflow.it",
  senders: {
    noreply: "noreply", // → noreply@notifications.nexflow.it
    support: "support", // → support@notifications.nexflow.it
  },
  templates: {
    "invite-v1": {
      source: "./templates/invite.html", // HTML template with {{variable}} placeholders
      textFallback: "./templates/invite.txt",
    },
    "welcome-v1": {
      source: "./templates/welcome.html",
    },
  },
});
```

**Generated CDK constructs:**

- SES domain identity verification (DNS records via Route53 if available)
- SES email templates (from HTML source files)
- IAM role for AppSync to invoke SES
- AppSync JS resolver for the `inviteEmail` mutation

#### 3.2.3 Template Variables

Templates use `{{variableName}}` placeholders. All `.arguments()` fields are available as template variables. Additionally, the following built-in variables are injected:

- `{{__callerUserId}}` — Cognito user sub of the caller
- `{{__callerEmail}}` — Cognito email of the caller (if available)
- `{{__timestamp}}` — ISO 8601 timestamp of invocation

The resolver validates that all required template variables are present in the arguments before sending.

#### 3.2.4 Client Invocation

```typescript
const { data, errors } = await client.actions.inviteEmail({
  recipientEmail: "carsten@example.com",
  invitee: "Carsten",
  inviter: "Gunnar",
  documentId: "doc-123",
  documentName: "Q4 Strategy",
});

if (data) {
  console.log(`Email sent: ${data.messageId}`);
}
```

**Type safety:** The argument types and return type are inferred from the schema definition. `client.actions.inviteEmail` is a fully typed function.

### 3.3 Push Notification Actions — `n.pushNotification()`

```typescript
documentSharedPush: n.pushNotification({
  channel: "document-updates",
  title: ({ documentName }) => `New shared document: ${documentName}`,
  body: ({ inviter }) => `${inviter} shared a document with you`,
})
  .arguments({
    recipientUserId: a.string().required(),
    documentName: a.string().required(),
    inviter: a.string().required(),
  })
  .authorization((allow) => [allow.authenticated()]);
```

**Generated infrastructure:** Amazon SNS topic or Amazon Pinpoint campaign (configurable). AppSync resolver to publish.

### 3.4 Webhook Actions — `n.webhook()`

```typescript
onDocumentFinalized: n.webhook({
  method: "POST",
  headers: { "X-Source": "nxsflow" },
  timeout: 10, // seconds
})
  .arguments({
    documentId: a.id().required(),
    callbackUrl: a.url().required(),
    payload: a.json(),
  })
  .authorization((allow) => [allow.groups(["admins"])]);
```

**Generated infrastructure:** Lambda function that performs the HTTP call (AppSync cannot make arbitrary HTTP requests). Retry policy: 3 attempts with exponential backoff.

### 3.5 Action Audit Log

All actions optionally log to a shared `ActionAuditLog` DynamoDB table:

```
ActionAuditLog Table Schema:
  PK: actionName (e.g., "inviteEmail")
  SK: {timestamp}#{requestId}
  Attributes:
    - callerUserId: String
    - arguments: Map (sanitized — no PII in logs by default)
    - status: String ("success" | "failed")
    - errorMessage: String (if failed)
    - duration: Number (ms)
    - ttl: Number (90 days default)
```

Enable per action:

```typescript
inviteEmail: n.email({
  /* ... */
})
  .arguments({
    /* ... */
  })
  .audit({ enabled: true, retainDays: 90, includePII: false });
```

---

## 4. CDK Construct Generation

### 4.1 Overview

`n.schema()` produces a construct descriptor that is consumed by a custom CDK construct: `OvertoneConstruct`.

```typescript
// backend.ts
import { defineBackend } from "@aws-amplify/backend";
import { OvertoneConstruct } from "@nxsflow/amplify-overtone/constructs";

const backend = defineBackend({ auth, data, email });

// Apply Amplify Overtone extensions to the Amplify-generated stack
new OvertoneConstruct(backend.data.stack, "Overtone", {
  schema: schema, // The n.schema() output
  amplifyData: backend.data, // Reference to Amplify's data construct
  email: email, // Optional: defineEmail() output
});
```

### 4.2 Generated Resources Per Feature

#### Collaborative Models

| Resource                         | Purpose                          |
| -------------------------------- | -------------------------------- |
| DynamoDB Table: `{Model}-OpsLog` | Stores Automerge operations      |
| DynamoDB Stream on OpsLog        | Triggers compaction              |
| Lambda: `{Model}-Compaction`     | Merges ops into state table      |
| EventBridge Rule                 | Periodic full compaction (daily) |
| AppSync Resolvers                | OpsLog mutations + subscriptions |

#### Auth Inheritance

| Resource                          | Purpose                                |
| --------------------------------- | -------------------------------------- |
| DynamoDB Stream on parent table   | Detects auth field changes             |
| Lambda: `AuthPropagation-{Model}` | Fans out auth updates to children      |
| GSI on child table: `byParentId`  | Efficient child lookup for propagation |

#### Local-First

| Resource                         | Purpose                                    |
| -------------------------------- | ------------------------------------------ |
| AppSync Resolver: `sync-{Model}` | Delta sync endpoint (version-vector based) |
| Additional fields on model       | `__syncVersion`, `__lastModifiedBy`        |

#### Email Actions

| Resource                         | Purpose                   |
| -------------------------------- | ------------------------- |
| SES Domain Identity              | Verified sending domain   |
| SES Templates                    | Email templates           |
| IAM Role                         | AppSync → SES permissions |
| AppSync Resolver: `{actionName}` | Mutation resolver         |

---

## 5. Client Runtime

### 5.1 Client Generation

The client is generated at build time (Amplify codegen pipeline). It extends Amplify's generated client with:

```typescript
// Auto-generated client type
interface NxsflowClient {
  models: {
    Document: {
      // Standard Amplify CRUD (pass-through)
      get(input: { documentId: string }): Promise<Document>;
      list(input?: ListInput): Promise<Document[]>;
      create(input: CreateDocumentInput): Promise<Document>;
      update(input: UpdateDocumentInput): Promise<Document>;
      delete(input: { documentId: string }): Promise<void>;

      // nxsflow collaborative extensions
      observe(input: { documentId: string }): Observable<Document>;
      getCollaborativeSession(input: {
        documentId: string;
      }): CollaborativeSession<Document>;

      // nxsflow local-first extensions
      onLeaseExpired(handler: LeaseExpiredHandler): Unsubscribe;
      getSyncStatus(input: { documentId: string }): SyncStatus;
      forcePush(): Promise<SyncResult>;
    };
    DocumentParagraph: {
      // ... similar, but no explicit auth management
    };
  };
  actions: {
    inviteEmail(input: InviteEmailInput): Promise<InviteEmailOutput>;
    documentSharedPush(input: PushInput): Promise<PushOutput>;
  };
}
```

### 5.2 Collaborative Session API

```typescript
const session = await client.models.Document.getCollaborativeSession({
  documentId: "doc-123",
});

// Get current state (Automerge document)
const doc = session.document;

// Make a change
session.change((doc) => {
  doc.name = "Updated Name";
});

// Listen for remote changes
session.onRemoteChange((updatedDoc, patches) => {
  // patches describes what changed — for efficient UI updates
  console.log("Remote change:", patches);
});

// Get presence info (who's editing)
session.onPresenceChange((peers) => {
  // peers: { userId, cursor?, lastActiveAt }[]
});

// Close session
session.close();
```

### 5.3 Sync Engine (Local-First)

The sync engine runs as a background process in the client (Web Worker for browser, background thread for React Native).

**Sync loop:**

```
┌─────────────────────────────────────────────────────┐
│                    Sync Engine                       │
│                                                      │
│  1. Check connectivity                               │
│  2. If online:                                       │
│     a. Renew leases for all local-first models       │
│     b. Push pending local ops to OpsLog              │
│     c. Pull new ops since last version vector        │
│     d. Apply ops to local cr-sqlite                  │
│     e. Update version vectors                        │
│     f. Update __lastSyncedAt                         │
│  3. If offline:                                      │
│     a. Check lease expiry for all models             │
│     b. Emit events for expired leases                │
│     c. Purge data for expired reader leases          │
│  4. Sleep for sync interval (default: 30s online,    │
│     60s offline for lease checks)                    │
│  5. Repeat                                           │
└─────────────────────────────────────────────────────┘
```

### 5.4 Offline Queue

When offline, mutations are queued:

```typescript
interface PendingMutation {
  id: string; // UUID
  modelName: string;
  recordId: string;
  type: "create" | "update" | "delete";
  ops: Uint8Array; // Automerge operations
  createdAt: number;
  retryCount: number;
}
```

The queue is persisted in IndexedDB. On reconnect, mutations are replayed in order. If a mutation fails (e.g., permission denied after revocation), it is moved to a dead-letter queue and the user is notified.

---

## 6. Full Example

### 6.1 Backend Definition

```typescript
// amplify/backend.ts
import { defineBackend } from "@aws-amplify/backend";
import { defineAuth } from "@aws-amplify/backend";
import { defineEmail, n } from "@nxsflow/amplify-overtone";
import { a } from "@aws-amplify/backend";
import { OvertoneConstruct } from "@nxsflow/amplify-overtone/constructs";

const auth = defineAuth({
  loginWith: { email: true },
});

const email = defineEmail({
  domain: "notifications.nexflow.it",
  senders: {
    noreply: "noreply",
  },
  templates: {
    "invite-v1": {
      source: "./templates/invite.html",
    },
  },
});

const schema = n
  .schema({
    Document: n
      .model({
        documentId: a.id().required(),
        name: a.string().required(),
        description: a.string(),
        owner: n.owner().required(),
        coOwners: n.coOwners(),
        editors: n.editors(),
        readers: n.readers(),
        paragraphs: n
          .hasMany("DocumentParagraph", "documentId")
          .inheritsAuthRules(),
      })
      .identifier(["documentId"])
      .collaborative()
      .localFirst(),

    DocumentParagraph: n
      .model({
        paragraphId: a.id().required(),
        documentId: a.string().required(),
        document: n.belongsTo("Document", "documentId"),
        content: a.string(),
        sortOrder: a.integer().required(),
        comments: n
          .hasMany("ParagraphComment", "paragraphId")
          .inheritsAuthRules(),
      })
      .identifier(["paragraphId"]),

    ParagraphComment: n
      .model({
        commentId: a.id().required(),
        paragraphId: a.string().required(),
        paragraph: n.belongsTo("DocumentParagraph", "paragraphId"),
        text: a.string().required(),
        authorId: a.string().required(),
        createdAt: a.datetime().required(),
      })
      .identifier(["commentId"]),

    // Actions
    inviteCollaborator: n
      .email({
        sender: "noreply",
        subject: ({ inviterName }) =>
          `${inviterName} invited you to collaborate`,
        template: "invite-v1",
      })
      .arguments({
        recipientEmail: a.email().required(),
        inviterName: a.string().required(),
        documentId: a.id().required(),
        documentName: a.string().required(),
        role: a.enum(["editor", "reader"]).required(),
      })
      .returns(
        a.customType({
          messageId: a.string(),
          status: a.enum(["sent", "queued", "failed"]),
        }),
      )
      .authorization((allow) => [allow.authenticated()])
      .audit({ enabled: true }),
  })
  .conflicts("automerge")
  .localFirst({
    leases: {
      coOwner: "7d",
      editor: "48h",
      reader: "7d",
    },
  });

const data = defineData({ schema: schema.toAmplifySchema() });

const backend = defineBackend({ auth, data, email });

new OvertoneConstruct(backend.data.stack, "Overtone", {
  schema,
  amplifyData: backend.data,
  email,
});
```

### 6.2 Client Usage

```typescript
// app/page.tsx
import { generateClient } from "@nxsflow/amplify-overtone/client";
import type { Schema } from "../amplify/data/resource";

const client = generateClient<Schema>();

// Create a document
const { data: doc } = await client.models.Document.create({
  documentId: crypto.randomUUID(),
  name: "Project Brief",
  description: "Q4 strategy document",
});

// Add a collaborator
await client.models.Document.update({
  documentId: doc.documentId,
  editors: [...(doc.editors || []), "user-sub-xyz"],
});

// Send invite email
const { data: emailResult } = await client.actions.inviteCollaborator({
  recipientEmail: "colleague@example.com",
  inviterName: "Carsten",
  documentId: doc.documentId,
  documentName: doc.name,
  role: "editor",
});

// Start collaborative editing
const session = await client.models.Document.getCollaborativeSession({
  documentId: doc.documentId,
});

session.change((d) => {
  d.name = "Updated Project Brief";
});

session.onRemoteChange((updatedDoc, patches) => {
  // Re-render UI with updatedDoc
});

// Create a paragraph (auth inherited from Document)
await client.models.DocumentParagraph.create({
  paragraphId: crypto.randomUUID(),
  documentId: doc.documentId,
  content: "Executive summary...",
  sortOrder: 1,
});

// Check sync status
const status = client.models.Document.getSyncStatus({
  documentId: doc.documentId,
});
// → { state: "synced" | "syncing" | "offline" | "error", pendingOps: 0, lastSyncedAt: ... }

// Handle lease expiration
client.models.Document.onLeaseExpired(({ modelId, role, action }) => {
  toast.warning("Your offline access has expired. Please reconnect.");
});
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Weeks 1–4)

- [ ] `n.schema()` and `n.model()` builders with TypeScript types
- [ ] Authorization fields (`n.owner()`, `n.editors()`, etc.)
- [ ] AppSync resolver generation for auth field-based access control
- [ ] Basic CDK construct that wraps Amplify's data construct
- [ ] Unit tests for schema parsing and resolver generation

### Phase 2: Authorization Inheritance (Weeks 5–7)

- [ ] `.inheritsAuthRules()` on `n.hasMany()`
- [ ] Auth denormalization on child creation (resolver)
- [ ] DDB Stream + Lambda for auth propagation
- [ ] Cascading propagation for deep inheritance (up to 3 levels)
- [ ] Integration tests with real AppSync + DDB

### Phase 3: Collaborative (CRDT) (Weeks 8–12)

- [ ] OpsLog table generation
- [ ] Automerge integration (operations encoding/decoding)
- [ ] Write path: client → OpsLog → subscription broadcast
- [ ] Read path: State Table + OpsLog merge
- [ ] Compaction Lambda
- [ ] Version vector sync protocol
- [ ] `CollaborativeSession` client API
- [ ] Presence (optional, via AppSync subscriptions)

### Phase 4: Local-First (Weeks 13–17)

- [ ] cr-sqlite WASM integration
- [ ] Local schema generation from model definitions
- [ ] Sync engine (Web Worker)
- [ ] Offline mutation queue
- [ ] Lease-based authorization (grant, renewal, expiry, revocation)
- [ ] `onLeaseExpired` event API
- [ ] Conflict resolution on reconnect

### Phase 5: Actions (Weeks 18–21)

- [ ] `n.email()` schema builder
- [ ] `defineEmail()` backend construct (SES domain, templates)
- [ ] AppSync resolver for email sending
- [ ] `n.pushNotification()` schema builder (SNS/Pinpoint)
- [ ] `n.webhook()` schema builder (Lambda-based HTTP)
- [ ] Action audit log
- [ ] Client codegen for `client.actions.*`

### Phase 6: Polish & Documentation (Weeks 22–24)

- [ ] End-to-end integration tests
- [ ] Performance benchmarks (OpsLog compaction, sync latency)
- [ ] Developer documentation
- [ ] Example application (collaborative document editor)
- [ ] npm publish pipeline

---

## 8. Open Questions & Decisions

These items require further investigation or decisions before implementation:

1. **Automerge bundle size.** Automerge's WASM binary is ~200KB gzipped. Is this acceptable for the client bundle? Alternative: run Automerge only in the sync Web Worker and expose a simpler API to the main thread.

2. **cr-sqlite stability.** cr-sqlite is relatively new. Fallback plan: use raw IndexedDB with a custom query layer if cr-sqlite proves unstable in production.

3. **AppSync subscription limits.** AppSync has a limit of 100 subscriptions per connection. For documents with many paragraphs each being observed, this could be hit. Solution: multiplex observations through a single document-level subscription.

4. **Amplify Gen 2 internal API stability.** The `n.schema()` → `a.schema()` bridge depends on Amplify's internal schema builder API. If Amplify changes this (they have no stability guarantee for internals), the bridge breaks. Mitigation: pin Amplify versions and maintain an adapter layer.

5. **Authorization propagation latency.** When an editor is removed, the DDB Stream + Lambda propagation is eventually consistent (typically < 1 second, but can spike under load). During this window, the removed editor can still access children. Acceptable? Alternative: add a synchronous parent-check resolver as fallback for write operations.

6. **Lease duration configurability per model.** Current design sets leases globally in `.localFirst()`. Should this be overridable per model?

7. **CRDT for structured data vs. rich text.** Automerge handles JSON well but collaborative rich text editing (e.g., a paragraph's content as rich text) may benefit from Yjs's text CRDT. Consider supporting a hybrid: Automerge for document structure, Yjs for text fields marked with `a.richText()`.

---

## 9. Non-Goals (Explicitly Out of Scope)

- **Real-time cursor positions / selection sharing.** Presence shows who is editing, not where. Cursor sync is a UI-layer concern.
- **File/blob storage.** Amplify Storage handles this. nxsflow does not manage S3 objects.
- **Custom authentication providers.** Only Cognito (via Amplify Auth) is supported for authorization fields.
- **Multi-region replication.** Single-region DynamoDB. Global tables support is a future consideration.
- **Schema migrations.** Adding/removing collaborative or local-first capabilities to existing production models requires manual migration. The library does not auto-migrate.
