import {
    AdminGetUserCommand,
    type AttributeType,
    CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { renderEmail } from "../../templates/renderer.js";
import type { SendEmailResult } from "../../types.js";

const ses = new SESv2Client({});
const cognito = new CognitoIdentityProviderClient({});

interface NormalizedSender {
    email: string;
    displayName: string;
}

interface TemplateConfig {
    subject: string;
    header: string;
    body: string;
    callToAction?: { label: string; href: string };
    footer?: string;
    sender?: string;
    userIdArgs: string[];
    recipientArg?: string;
}

export interface EmailActionEvent {
    actionId: string;
    fieldName: string;
    arguments: Record<string, string>;
}

function extractAttribute(attrs: AttributeType[] | undefined, name: string): string {
    return attrs?.find((a) => a.Name === name)?.Value ?? "";
}

function interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export const handler = async (event: EmailActionEvent): Promise<SendEmailResult> => {
    // 1. Load template config
    const emailTemplatesRaw = process.env.EMAIL_TEMPLATES ?? "{}";
    const emailTemplates: Record<string, TemplateConfig> = JSON.parse(emailTemplatesRaw);

    const templateConfig = emailTemplates[event.actionId];
    if (!templateConfig) {
        throw new Error(
            `Template config for action "${event.actionId}" not found in EMAIL_TEMPLATES. Available actions: ${Object.keys(emailTemplates).join(", ")}`,
        );
    }

    // 2. Resolve Cognito users for userId args
    const resolvedUsers: Record<
        string,
        { name: string; email: string; givenName: string; familyName: string }
    > = {};

    if (templateConfig.userIdArgs && templateConfig.userIdArgs.length > 0) {
        const userPoolId = process.env.USER_POOL_ID;
        if (!userPoolId) {
            throw new Error("USER_POOL_ID environment variable is not set");
        }

        const resolved = await Promise.all(
            templateConfig.userIdArgs.map(async (argName) => {
                const userId = event.arguments[argName];
                if (!userId) {
                    return [
                        argName,
                        { name: "", email: "", givenName: "", familyName: "" },
                    ] as const;
                }
                const response = await cognito.send(
                    new AdminGetUserCommand({
                        UserPoolId: userPoolId,
                        Username: userId,
                    }),
                );
                const attrs = response.UserAttributes;
                return [
                    argName,
                    {
                        name: extractAttribute(attrs, "name"),
                        email: extractAttribute(attrs, "email"),
                        givenName: extractAttribute(attrs, "given_name"),
                        familyName: extractAttribute(attrs, "family_name"),
                    },
                ] as const;
            }),
        );

        for (const [argName, user] of resolved) {
            resolvedUsers[argName] = user;
        }
    }

    // 3. Build flat vars map
    const vars: Record<string, string> = { ...event.arguments };
    for (const [argName, user] of Object.entries(resolvedUsers)) {
        vars[`${argName}Name`] = user.name;
        vars[`${argName}Email`] = user.email;
        vars[`${argName}GivenName`] = user.givenName;
        vars[`${argName}FamilyName`] = user.familyName;
    }

    // 4. Interpolate template strings
    const subject = interpolate(templateConfig.subject, vars);
    const header = interpolate(templateConfig.header, vars);
    const body = interpolate(templateConfig.body, vars);
    const footer = templateConfig.footer ? interpolate(templateConfig.footer, vars) : undefined;
    const callToAction = templateConfig.callToAction
        ? {
              label: interpolate(templateConfig.callToAction.label, vars),
              href: interpolate(templateConfig.callToAction.href, vars),
          }
        : undefined;

    // 5. Determine recipient
    let to: string;
    if (templateConfig.recipientArg && resolvedUsers[templateConfig.recipientArg]?.email) {
        to = resolvedUsers[templateConfig.recipientArg].email;
    } else {
        to = event.arguments.recipient ?? event.arguments.to ?? "";
    }

    if (!to) {
        throw new Error("Could not determine recipient email address");
    }

    // 6. Look up sender
    const sendersConfigRaw = process.env.SENDERS_CONFIG ?? "{}";
    const defaultSenderKey = process.env.DEFAULT_SENDER ?? "noreply";
    const sendersConfig: Record<string, NormalizedSender> = JSON.parse(sendersConfigRaw);

    const senderKey = templateConfig.sender ?? defaultSenderKey;
    const senderConfig = sendersConfig[senderKey];

    if (!senderConfig) {
        throw new Error(
            `Sender "${senderKey}" not found in SENDERS_CONFIG. Available senders: ${Object.keys(sendersConfig).join(", ")}`,
        );
    }

    const { email: senderEmail, displayName } = senderConfig;
    const fromAddress = displayName ? `"${displayName}" <${senderEmail}>` : senderEmail;

    // 7. Render and send
    const data: Record<string, string> = { header, body };
    if (callToAction) {
        data.callToActionLabel = callToAction.label;
        data.callToActionHref = callToAction.href;
    }
    if (footer) {
        data.footer = footer;
    }

    const { html, text } = renderEmail(data, displayName);

    const result = await ses.send(
        new SendEmailCommand({
            FromEmailAddress: fromAddress,
            Destination: { ToAddresses: [to] },
            Content: {
                Simple: {
                    Subject: { Data: subject, Charset: "UTF-8" },
                    Body: {
                        Text: { Data: text, Charset: "UTF-8" },
                        Html: { Data: html, Charset: "UTF-8" },
                    },
                },
            },
        }),
    );

    const messageId = result.MessageId;
    console.log("Email sent:", { messageId, to });
    return { messageId };
};
