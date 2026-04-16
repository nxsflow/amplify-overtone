/**
 * Copies all .md files from packages/docs/ into public/docs/ so they are
 * served as static files at /docs/<path>.md for agent consumption.
 *
 * Also transforms API.api.md files from published packages into
 * Fumadocs-compatible markdown in public/docs/api-reference/.
 *
 * Mapping:
 *   packages/docs/email/define-email.md  →  public/docs/email/define-email.md
 *   packages/docs/email/index.md         →  public/docs/email.md
 *   packages/docs/getting-started/index.md → public/docs/getting-started.md
 *
 * API reports:
 *   packages/amplify-overtone/API.api.md → public/docs/api-reference/amplify-overtone.md
 *   packages/amplify-overtone-client/API.api.md → public/docs/api-reference/amplify-overtone-client.md
 */

import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, "..", "..", "docs");
const publicDocsDir = join(__dirname, "..", "public", "docs");
const packagesDir = join(__dirname, "..", "..");

/** Packages whose API.api.md should be transformed into docs. */
const apiPackages = [
    { dir: "amplify-overtone", npm: "@nxsflow/amplify-overtone" },
    { dir: "amplify-overtone-client", npm: "@nxsflow/amplify-overtone-client" },
];

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walk(full)));
        } else if (entry.name.endsWith(".md")) {
            files.push(full);
        }
    }
    return files;
}

/**
 * Transforms an API.api.md file into a Fumadocs page.
 * Strips the api-extractor header/footer, extracts the fenced code block,
 * and prepends frontmatter.
 */
function transformApiReport(rawContent, npmName) {
    // Normalize line endings to LF so fence detection works regardless of CRLF
    const content = rawContent.replace(/\r\n/g, "\n");

    // Extract content inside the ```ts ... ``` fence
    const fenceStart = content.indexOf("```ts\n");
    const fenceEnd = content.lastIndexOf("\n```");
    if (fenceStart === -1 || fenceEnd === -1) {
        throw new Error(`Could not find TypeScript code fence in API report for ${npmName}`);
    }

    const codeBlock = content.slice(fenceStart + 5, fenceEnd).trim();

    // Remove trailing comment lines (warnings, @packageDocumentation notes)
    const lines = codeBlock.split("\n");
    while (lines.length > 0 && lines[lines.length - 1].startsWith("//")) {
        lines.pop();
    }
    // Remove trailing blank lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
    }

    const cleanedCode = lines.join("\n");

    return `---
title: "${npmName}"
description: API reference for ${npmName}
---

\`\`\`ts
${cleanedCode}
\`\`\`
`;
}

async function copyDocsFiles() {
    const files = await walk(docsDir);

    for (const src of files) {
        const rel = relative(docsDir, src);
        const parts = rel.split("/");

        let dest;
        if (parts.length >= 2 && parts[parts.length - 1] === "index.md") {
            const dirParts = parts.slice(0, -1);
            dest = join(
                publicDocsDir,
                ...dirParts.slice(0, -1),
                `${dirParts[dirParts.length - 1]}.md`,
            );
        } else {
            dest = join(publicDocsDir, ...parts);
        }

        await mkdir(dirname(dest), { recursive: true });
        await copyFile(src, dest);
        console.log(`  ${rel} → public/docs/${relative(publicDocsDir, dest)}`);
    }

    console.log(`\nCopied ${files.length} markdown file(s) to public/docs/`);
}

async function transformApiReports() {
    const apiRefDir = join(publicDocsDir, "api-reference");
    await mkdir(apiRefDir, { recursive: true });

    let count = 0;
    for (const pkg of apiPackages) {
        const src = join(packagesDir, pkg.dir, "API.api.md");
        const content = await readFile(src, "utf8");
        const transformed = transformApiReport(content, pkg.npm);
        const dest = join(apiRefDir, `${pkg.dir}.md`);
        await writeFile(dest, transformed, "utf8");
        console.log(`  ${pkg.dir}/API.api.md → public/docs/api-reference/${pkg.dir}.md`);
        count++;
    }

    console.log(`\nTransformed ${count} API report(s) to public/docs/api-reference/`);
}

async function main() {
    await copyDocsFiles();
    await transformApiReports();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
