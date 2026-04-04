"use server";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

type EmailTemplateName = "confirmation-code" | "password-reset" | "invite" | "getting-started";

interface SendEmailPayload {
    template: EmailTemplateName;
    to: string;
    sender?: string;
    data: Record<string, string>;
}

const lambda = new LambdaClient({});

const RECIPIENT = "carsten.koch@hey.com";

const templateData: Record<EmailTemplateName, Record<string, string>> = {
    "confirmation-code": {
        code: "483291",
        expiresInMinutes: "10",
    },
    "password-reset": {
        resetLink: "https://example.com/reset?token=abc123",
        expiresInMinutes: "15",
    },
    invite: {
        inviterName: "Amplify Overtone",
        inviteLink: "https://example.com/invite/abc123",
        resourceName: "Email Templates Demo",
    },
    "getting-started": {
        userName: "Carsten",
        dashboardLink: "https://example.com/dashboard",
    },
};

function getFunctionName(): string {
    const outputsPath = resolve(process.cwd(), "amplify_outputs.json");
    const outputs = JSON.parse(readFileSync(outputsPath, "utf-8"));
    return outputs.custom.email.sendFunctionName;
}

export async function sendTemplateEmail(
    template: EmailTemplateName,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let functionName: string;
    try {
        functionName = getFunctionName();
    } catch {
        return { success: false, error: "amplify_outputs.json not found — run ampx sandbox first" };
    }

    const payload: SendEmailPayload = {
        template,
        to: RECIPIENT,
        data: templateData[template],
    };

    try {
        const result = await lambda.send(
            new InvokeCommand({
                FunctionName: functionName,
                InvocationType: "RequestResponse",
                Payload: new TextEncoder().encode(JSON.stringify(payload)),
            }),
        );

        const response = JSON.parse(new TextDecoder().decode(result.Payload));

        if (result.FunctionError) {
            return { success: false, error: response.errorMessage ?? "Lambda invocation failed" };
        }

        return { success: true, messageId: response.messageId };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
}
