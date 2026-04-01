import { CopyObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({});

const BUCKET = process.env.BUCKET_NAME!;

/**
 * Parses raw email headers to extract To and Subject.
 * Only reads the header section (before the first blank line).
 */
function parseHeaders(raw: string): { to: string | undefined; subject: string | undefined } {
    const headerEnd = raw.indexOf("\r\n\r\n");
    const headerSection = headerEnd > -1 ? raw.substring(0, headerEnd) : raw;

    const getHeader = (name: string): string | undefined => {
        const regex = new RegExp(`^${name}:\\s*(.+)$`, "mi");
        const match = headerSection.match(regex);
        return match?.[1]?.trim();
    };

    return {
        to: getHeader("To"),
        subject: getHeader("Subject"),
    };
}

/**
 * Converts a string to a URL-safe slug.
 * e.g., "Your confirmation code" → "your-confirmation-code"
 */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Extracts the local part (prefix) from an email address.
 * e.g., "reader@amp-recv.nxsflowmail.com" → "reader"
 */
function extractPrefix(email: string): string {
    // Handle "Display Name <address>" format
    const match = email.match(/<([^>]+)>/);
    const address = match ? match[1]! : email;
    return address.split("@")[0]!;
}

/**
 * SES receipt rule Lambda handler.
 *
 * Triggered after SES stores the raw email in S3 at raw/{messageId}.
 * Reads the email, parses headers, and copies to:
 *   emails/{to-prefix}/{subject-slug}-{timestamp}
 */
export const handler = async (event: {
    Records: Array<{
        ses: {
            mail: {
                messageId: string;
                timestamp: string;
                destination: string[];
            };
        };
    }>;
}): Promise<void> => {
    for (const record of event.Records) {
        const { messageId, timestamp, destination } = record.ses.mail;
        const rawKey = `raw/${messageId}`;

        // Read the raw email from S3
        const rawObj = await s3.send(
            new GetObjectCommand({
                Bucket: BUCKET,
                Key: rawKey,
            }),
        );

        const rawBody = (await rawObj.Body?.transformToString("utf-8")) ?? "";
        const { to, subject } = parseHeaders(rawBody);

        // Use the first destination address (from SES event) as fallback for To header
        const toAddress = to ?? destination[0] ?? "unknown";
        const toPrefix = extractPrefix(toAddress);
        const subjectSlug = subject ? slugify(subject) : "no-subject";
        const ts = Math.floor(new Date(timestamp).getTime() / 1000);

        const targetKey = `emails/${toPrefix}/${subjectSlug}-${ts}`;

        // Copy from raw/ to structured path
        await s3.send(
            new CopyObjectCommand({
                Bucket: BUCKET,
                CopySource: `${BUCKET}/${rawKey}`,
                Key: targetKey,
            }),
        );

        console.log(`Routed: ${rawKey} → ${targetKey} (to=${toPrefix}, subject=${subject})`);
    }
};
