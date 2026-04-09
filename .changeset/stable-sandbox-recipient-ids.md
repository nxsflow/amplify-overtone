---
"@nxsflow/amplify-overtone": patch
---

Use hash-based construct IDs for sandbox recipient identities instead of array indices. Prevents identity shuffling, accidental deletions, and IAM permission errors when reordering or removing entries from sandboxRecipients.
