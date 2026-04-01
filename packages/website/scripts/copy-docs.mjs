/**
 * Copies all .md files from packages/docs/ into public/docs/ so they are
 * served as static files at /docs/<path>.md for agent consumption.
 *
 * Mapping:
 *   packages/docs/email/define-email.md  →  public/docs/email/define-email.md
 *   packages/docs/email/index.md         →  public/docs/email.md
 *   packages/docs/getting-started/index.md → public/docs/getting-started.md
 */

import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, "..", "..", "docs");
const publicDocsDir = join(__dirname, "..", "public", "docs");

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

async function main() {
    const files = await walk(docsDir);

    for (const src of files) {
        const rel = relative(docsDir, src); // e.g. "email/define-email.md" or "email/index.md"
        const parts = rel.split("/");

        let dest;
        if (parts.length >= 2 && parts[parts.length - 1] === "index.md") {
            // packages/docs/email/index.md → public/docs/email.md
            const dirParts = parts.slice(0, -1);
            dest = join(publicDocsDir, ...dirParts.slice(0, -1), `${dirParts[dirParts.length - 1]}.md`);
        } else {
            // packages/docs/email/define-email.md → public/docs/email/define-email.md
            dest = join(publicDocsDir, ...parts);
        }

        await mkdir(dirname(dest), { recursive: true });
        await copyFile(src, dest);
        console.log(`  ${rel} → public/docs/${relative(publicDocsDir, dest)}`);
    }

    console.log(`\nCopied ${files.length} markdown file(s) to public/docs/`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
