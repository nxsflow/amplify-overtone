import { defineEmail } from "@nxsflow/amplify-overtone";

const domain = process.env.TEST_SENDER_DOMAIN!;
const hostedZoneId = process.env.TEST_SENDER_HOSTED_ZONE_ID!;
const hostedZoneDomain = process.env.TEST_SENDER_HOSTED_ZONE_DOMAIN!;
const recipientDomain = process.env.TEST_RECIPIENT_DOMAIN!;

if (!domain || !hostedZoneId || !hostedZoneDomain) {
    throw new Error(
        "Missing required env vars: TEST_SENDER_DOMAIN, TEST_SENDER_HOSTED_ZONE_ID, TEST_SENDER_HOSTED_ZONE_DOMAIN",
    );
}

export const email = defineEmail({
    domain,
    hostedZoneId,
    hostedZoneDomain,
    senders: {
        noreply: { senderPrefix: "noreply", displayName: "Overtone Test" },
        support: { senderPrefix: "support", displayName: "Overtone Support" },
    },
    defaultSender: "noreply",
    sandboxRecipients: recipientDomain ? [`test@${recipientDomain}`] : [],
});
