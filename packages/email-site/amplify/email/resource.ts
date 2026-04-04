import { defineEmail } from "@nxsflow/amplify-overtone";

export const email = defineEmail({
    senders: {
        noreply: {
            senderEmail: "owner@amp-recv.nxsflowmail.com",
            displayName: "Overtone Templates",
        },
    },
    sandboxRecipients: ["carsten.koch+overtone@hey.com"],
});
