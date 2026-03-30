// src/email/functions/send/handler.ts
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { renderTemplate } from "../../templates/renderer.js";

const ses = new SESv2Client({});

export interface SendEmailPayload {
    /** Template to render. */
    template: "confirmation-code" | "password-reset" | "invite" | "getting-started";
    /** Full recipient email address. */
    to: string;
    /** Key from the senders map. Defaults to DEFAULT_SENDER env var. */
    sender?: string;
    /** Template data values. */
    data: Record<string, string>;
}

export interface SendEmailResult {
    messageId: string | undefined;
}

export const handler = async (event: SendEmailPayload): Promise<SendEmailResult> => {
    // Read env vars
    const sendersConfigRaw = process.env.SENDERS_CONFIG ?? "{}";
    const defaultSenderKey = process.env.DEFAULT_SENDER ?? "noreply";
    const emailDomain = process.env.EMAIL_DOMAIN;

    // Parse senders config
    const sendersConfig: Record<string, { localPart: string; displayName: string }> =
        JSON.parse(sendersConfigRaw);

    // Resolve sender key
    const senderKey = event.sender ?? defaultSenderKey;
    const senderConfig = sendersConfig[senderKey];

    if (!senderConfig) {
        throw new Error(
            `Sender "${senderKey}" not found in SENDERS_CONFIG. Available senders: ${Object.keys(sendersConfig).join(", ")}`,
        );
    }

    const { localPart, displayName } = senderConfig;

    // Build the From address
    let fromAddress: string;
    if (emailDomain) {
        const address = `${localPart}@${emailDomain}`;
        fromAddress = displayName ? `"${displayName}" <${address}>` : address;
    } else {
        fromAddress = localPart;
    }

    // Render template
    const { subject, html, text } = renderTemplate(event.template, event.data, displayName);

    // Call SES
    const result = await ses.send(
        new SendEmailCommand({
            FromEmailAddress: fromAddress,
            Destination: { ToAddresses: [event.to] },
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
    console.log("Email sent:", { messageId, to: event.to });
    return { messageId };
};
