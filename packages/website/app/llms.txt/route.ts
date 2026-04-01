import { source } from "@/lib/source";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

const BASE_URL = "https://overtone.nxsflow.com";

export async function GET() {
    const pages = source.getPages();
    const lines = pages.map((page) => {
        const mdUrl = `${BASE_URL}${page.url}.md`;
        return `- [${page.data.title}](${mdUrl})`;
    });

    const content = `# Amplify Overtone

> Extend AWS Amplify Gen 2 with email, collaboration, notifications, local-first sync, and AI agents.

## Docs

${lines.join("\n")}
`;

    return new NextResponse(content, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
        },
    });
}
