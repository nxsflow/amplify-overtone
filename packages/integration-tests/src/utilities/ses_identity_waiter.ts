import { GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({});

/**
 * Polls SES until the given identity is verified for sending.
 * DKIM verification typically takes 1-5 minutes after DNS records are created.
 *
 * @param identity - Domain or email identity to check
 * @param timeoutMs - Maximum time to wait (default: 5 minutes)
 * @param pollIntervalMs - Interval between checks (default: 15 seconds)
 * @throws If the identity is not verified within the timeout
 */
export async function waitForSesVerification(
    identity: string,
    timeoutMs = 300_000,
    pollIntervalMs = 15_000,
): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const result = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: identity }));

        if (result.VerifiedForSendingStatus) {
            console.log(
                `SES identity "${identity}" verified after ${Math.round((Date.now() - startTime) / 1000)}s`,
            );
            return;
        }

        console.log(
            `SES identity "${identity}" not yet verified (${Math.round((Date.now() - startTime) / 1000)}s elapsed), retrying in ${pollIntervalMs / 1000}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
        `SES identity "${identity}" was not verified within ${timeoutMs / 1000}s. ` +
            "Check that DKIM DNS records are correctly configured.",
    );
}
