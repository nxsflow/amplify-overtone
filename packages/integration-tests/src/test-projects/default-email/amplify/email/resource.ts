import { defineEmail } from "@nxsflow/amplify-overtone";

// Mode 1: no custom domain — use SenderWithEmail
// Both sender and receiver are on the test-infra recipient domain,
// so the domain identity covers SES sandbox verification.
export const email = defineEmail({
    senders: {
        noreply: {
            senderEmail: "owner@amp-recv.nxsflowmail.com",
            displayName: "Overtone Test",
        },
    },
    sandboxRecipients: ["reader@amp-recv.nxsflowmail.com"],
});
