import { defineEmail } from "@nxsflow/amplify-overtone";

const domain = process.env.TEST_SENDER_DOMAIN!;
const hostedZoneId = process.env.TEST_SENDER_HOSTED_ZONE_ID!;
const hostedZoneDomain = process.env.TEST_SENDER_HOSTED_ZONE_DOMAIN!;

if (!domain || !hostedZoneId || !hostedZoneDomain) {
    throw new Error(
        "Missing required env vars: TEST_SENDER_DOMAIN, TEST_SENDER_HOSTED_ZONE_ID, TEST_SENDER_HOSTED_ZONE_DOMAIN",
    );
}

// Mode 3: custom domain + Route 53 — uses SenderWithPrefix
// sandboxRecipients uses a test user on the recipient domain (verified by test-infra)
export const email = defineEmail({
    domain,
    hostedZoneId,
    hostedZoneDomain,
    senders: {
        noreply: { senderPrefix: "noreply", displayName: "Overtone Test" },
        support: { senderPrefix: "support", displayName: "Overtone Support" },
    },
    defaultSender: "noreply",
    sandboxRecipients: ["editor@amp-recv.nxsflowmail.com"],
});
