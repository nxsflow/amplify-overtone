import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import fsp from "node:fs/promises";
import { cpus } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { glob } from "glob";

/**
 * Runs an npm script across all workspace packages, optionally in parallel.
 *
 * Uses tsconfig.tsbuildinfo hashes to skip packages whose build output hasn't
 * changed since the last run, avoiding redundant work.
 *
 * Usage:
 *   tsx scripts/concurrent_workspace_script.ts <npm-script> [args...]
 *
 * Cache file format:
 *   {
 *     "<script-with-args>": {
 *       "packages/<name>": "<tsbuildinfo-sha512-hash>"
 *     }
 *   }
 */

// Limit concurrency to avoid OOM (e.g. from TypeScript compiler processes).
const MAX_CONCURRENCY = Math.max(1, Math.min(cpus().length, 4));

const cacheFilePath = new URL("./concurrent_workspace_script_cache.json", import.meta.url);

// Load existing cache or start fresh.
const hashCache: Record<string, Record<string, string>> = existsSync(cacheFilePath)
    ? (JSON.parse(await fsp.readFile(cacheFilePath, "utf-8")) as Record<
          string,
          Record<string, string>
      >)
    : {};

// The npm script (and optional extra args) to run in each package.
const runArgs = process.argv.slice(2);
if (runArgs.length === 0) {
    throw new Error("Usage: tsx scripts/concurrent_workspace_script.ts <npm-script> [args...]");
}

const commandCacheKey = runArgs.join("-");
const commandHashCache = hashCache[commandCacheKey] ?? {};

const packagePaths = await glob("./packages/*");

const runInDir = (dir: string) =>
    execa("npm", ["run", ...runArgs], {
        cwd: dir,
        stdio: "inherit",
    });

const runWithConcurrencyLimit = async (
    tasks: Array<() => Promise<unknown>>,
    limit: number,
): Promise<unknown[]> => {
    const results: unknown[] = [];
    let index = 0;

    const runNext = async (): Promise<void> => {
        while (index < tasks.length) {
            const currentIndex = index++;
            results[currentIndex] = await tasks[currentIndex]!();
        }
    };

    const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
    await Promise.all(workers);
    return results;
};

// Build the task list, one per package.
const tasks = packagePaths.map((packagePath) => async () => {
    const tsBuildInfoPath = path.join(packagePath, "tsconfig.tsbuildinfo");

    // If no tsbuildinfo exists, always run.
    if (!existsSync(tsBuildInfoPath)) {
        return runInDir(packagePath);
    }

    const currentHash = createHash("sha512")
        .update(await fsp.readFile(tsBuildInfoPath))
        .digest("hex");

    // Run only when the hash differs from the cached value.
    if (commandHashCache[packagePath] !== currentHash) {
        await runInDir(packagePath);
    }

    // Persist the new hash regardless of whether we ran.
    commandHashCache[packagePath] = currentHash;
    return undefined;
});

await runWithConcurrencyLimit(tasks, MAX_CONCURRENCY);

// Persist updated cache.
hashCache[commandCacheKey] = commandHashCache;
await fsp.writeFile(cacheFilePath, `${JSON.stringify(hashCache, null, 2)}\n`);
