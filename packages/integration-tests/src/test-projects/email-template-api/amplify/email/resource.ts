import { defineEmail } from "@nxsflow/amplify-overtone";

export const email = defineEmail({
    senders: {
        noreply: {
            senderEmail: "owner@amp-recv.nxsflowmail.com",
            displayName: "Template API Test",
        },
    },
    sandboxRecipients: ["reader@amp-recv.nxsflowmail.com"],
});
