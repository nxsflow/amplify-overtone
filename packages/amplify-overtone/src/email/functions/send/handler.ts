import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { renderEmail } from "../../templates/renderer.js";
import type { SendEmailPayload, SendEmailResult } from "../../types.js";

const ses = new SESv2Client({});

interface NormalizedSender {
    email: string;
    displayName: string;
}

export const handler = async (event: SendEmailPayload): Promise<SendEmailResult> => {
    const sendersConfigRaw = process.env.SENDERS_CONFIG ?? "{}";
    const defaultSenderKey = process.env.DEFAULT_SENDER ?? "noreply";

    const sendersConfig: Record<string, NormalizedSender> = JSON.parse(sendersConfigRaw);

    const senderKey = event.sender ?? defaultSenderKey;
    const senderConfig = sendersConfig[senderKey];

    if (!senderConfig) {
        throw new Error(
            `Sender "${senderKey}" not found in SENDERS_CONFIG. Available senders: ${Object.keys(sendersConfig).join(", ")}`,
        );
    }

    const { email: senderEmail, displayName } = senderConfig;
    const fromAddress = displayName ? `"${displayName}" <${senderEmail}>` : senderEmail;

    const data: Record<string, string> = {
        header: event.header,
        body: event.body,
    };
    if (event.callToAction) {
        data.callToActionLabel = event.callToAction.label;
        data.callToActionHref = event.callToAction.href;
    }
    if (event.footer) {
        data.footer = event.footer;
    }

    const { html, text } = renderEmail(data, displayName);

    const result = await ses.send(
        new SendEmailCommand({
            FromEmailAddress: fromAddress,
            Destination: { ToAddresses: [event.to] },
            Content: {
                Simple: {
                    Subject: { Data: event.subject, Charset: "UTF-8" },
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
