import {
    DeleteObjectsCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    S3Client,
} from "@aws-sdk/client-s3";

export interface ParsedEmail {
    raw: string;
    subject: string | undefined;
    from: string | undefined;
    to: string | undefined;
    body: string;
}

function parseRawEmail(raw: string): ParsedEmail {
    const headerEndIdx = raw.indexOf("\r\n\r\n");
    const headerSection = headerEndIdx > -1 ? raw.substring(0, headerEndIdx) : raw;
    const bodySection = headerEndIdx > -1 ? raw.substring(headerEndIdx + 4) : "";

    const getHeader = (name: string): string | undefined => {
        const regex = new RegExp(`^${name}:\\s*(.+)$`, "mi");
        const match = headerSection.match(regex);
        return match?.[1]?.trim();
    };

    return {
        raw,
        subject: getHeader("Subject"),
        from: getHeader("From"),
        to: getHeader("To"),
        body: bodySection,
    };
}

export class S3Mailbox {
    private readonly s3: S3Client;

    constructor(
        private readonly bucketName: string,
        private readonly prefix = "emails/",
    ) {
        this.s3 = new S3Client({});
    }

    async waitForEmail(
        recipientOrPrefix: string,
        timeoutMs = 60_000,
        pollIntervalMs = 5_000,
    ): Promise<ParsedEmail> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const email = await this.getLatestEmail(recipientOrPrefix);
            if (email) {
                return email;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        throw new Error(`No email arrived for '${recipientOrPrefix}' within ${timeoutMs / 1000}s`);
    }

    async getLatestEmail(recipientOrPrefix: string): Promise<ParsedEmail | undefined> {
        const keyPrefix = `${this.prefix}${recipientOrPrefix}`;

        const listResult = await this.s3.send(
            new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: keyPrefix,
            }),
        );

        if (!listResult.Contents || listResult.Contents.length === 0) {
            return undefined;
        }

        const sorted = listResult.Contents.sort(
            (a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
        );

        const latest = sorted[0]!;
        const getResult = await this.s3.send(
            new GetObjectCommand({
                Bucket: this.bucketName,
                Key: latest.Key,
            }),
        );

        const raw = (await getResult.Body?.transformToString("utf-8")) ?? "";
        return parseRawEmail(raw);
    }

    async clearMailbox(recipientOrPrefix?: string): Promise<void> {
        const keyPrefix = recipientOrPrefix ? `${this.prefix}${recipientOrPrefix}` : this.prefix;

        const listResult = await this.s3.send(
            new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: keyPrefix,
            }),
        );

        if (!listResult.Contents || listResult.Contents.length === 0) {
            return;
        }

        await this.s3.send(
            new DeleteObjectsCommand({
                Bucket: this.bucketName,
                Delete: {
                    Objects: listResult.Contents.map((obj) => ({ Key: obj.Key })),
                },
            }),
        );
    }
}
