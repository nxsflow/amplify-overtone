import assert from "node:assert";

export interface EmailOutputs {
    sendFunctionName: string;
    domain?: string;
    senders?: Record<string, { localPart: string; displayName: string }>;
    defaultSender?: string;
}

function getEmailOutputs(outputs: Record<string, unknown>): EmailOutputs {
    // Amplify serializes custom outputs as a JSON string under a numeric key.
    // The structure is: { "0": "{\"custom\":{\"email\":{...}}}", ... }
    // We need to find and parse that JSON string.
    let custom: Record<string, unknown> | undefined;

    // First, check if 'custom' exists at the top level (direct structure)
    if (outputs.custom && typeof outputs.custom === "object") {
        custom = outputs.custom as Record<string, unknown>;
    } else {
        // Search numeric keys for a JSON string containing custom outputs
        for (const value of Object.values(outputs)) {
            if (typeof value === "string") {
                try {
                    const parsed = JSON.parse(value) as Record<string, unknown>;
                    if (parsed.custom && typeof parsed.custom === "object") {
                        custom = parsed.custom as Record<string, unknown>;
                        break;
                    }
                } catch {
                    // Not valid JSON, skip
                }
            }
        }
    }

    assert.ok(custom, "amplify_outputs.json should contain custom email outputs");

    const email = custom.email as EmailOutputs | undefined;
    assert.ok(email, "amplify_outputs.json custom section should have an 'email' key");

    return email;
}

export function assertEmailOutputsExist(outputs: Record<string, unknown>): EmailOutputs {
    const email = getEmailOutputs(outputs);

    assert.ok(email.sendFunctionName, "custom.email.sendFunctionName should be present");

    return email;
}

export function assertEmailDomainOutput(
    outputs: Record<string, unknown>,
    expectedDomain: string,
): void {
    const email = getEmailOutputs(outputs);

    assert.strictEqual(
        email.domain,
        expectedDomain,
        `custom.email.domain should be '${expectedDomain}'`,
    );
}

export function assertEmailSendersOutput(
    outputs: Record<string, unknown>,
    expectedSenderKeys: string[],
): void {
    const email = getEmailOutputs(outputs);

    assert.ok(email.senders, "custom.email.senders should be present");
    for (const key of expectedSenderKeys) {
        assert.ok(email.senders[key], `custom.email.senders should contain sender '${key}'`);
        assert.ok(
            email.senders[key]!.localPart,
            `custom.email.senders['${key}'].localPart should be present`,
        );
        assert.ok(
            email.senders[key]!.displayName,
            `custom.email.senders['${key}'].displayName should be present`,
        );
    }
}

export function assertDefaultSenderOutput(
    outputs: Record<string, unknown>,
    expectedDefaultSender: string,
): void {
    const email = getEmailOutputs(outputs);

    assert.strictEqual(
        email.defaultSender,
        expectedDefaultSender,
        `custom.email.defaultSender should be '${expectedDefaultSender}'`,
    );
}
