import { SparseTestMatrixGenerator } from "./components/sparse_test_matrix_generator.js";

// This script generates a sparse test matrix for Overtone E2E tests.
// Every test must run on each Node version, but we avoid the full cartesian product.

if (process.argv.length < 5) {
    console.log(
        "Usage: npx tsx scripts/generate_sparse_test_matrix.ts '<test-glob-pattern>' '<node-versions-as-json-array>' '<os-as-json-array>' [max-tests-per-job]",
    );
    process.exit(1);
}

const testGlobPattern = process.argv[2] ?? "";
const nodeVersions = JSON.parse(process.argv[3] ?? "[]") as Array<string>;
const os = JSON.parse(process.argv[4] ?? "[]") as Array<string>;
const maxTestsPerJobArg = process.argv[5];
const maxTestsPerJob = maxTestsPerJobArg ? Number.parseInt(maxTestsPerJobArg) : 1;

if (!Number.isInteger(maxTestsPerJob)) {
    throw new Error(
        "Invalid max tests per job. If you are using a glob pattern with stars in bash, put it in quotes",
    );
}

const matrix = await new SparseTestMatrixGenerator({
    testGlobPattern,
    maxTestsPerJob,
    dimensions: {
        "node-version": nodeVersions,
        os,
    },
}).generate();

console.log(JSON.stringify(matrix));
