import path from "node:path";
import { glob } from "glob";

// See https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow
type JobMatrix = {
    include?: Array<Record<string, string>>;
} & Record<string, string>;

export type SparseTestMatrixGeneratorProps = {
    testGlobPattern: string;
    maxTestsPerJob: number;
    dimensions: Record<string, Array<string>>;
};

/**
 * Generates a sparse test matrix.
 *
 * Sparse matrix is created such that:
 * 1. Every test is included
 * 2. Every dimension's value is included
 * 3. Algorithm avoids cartesian product of dimensions — just the minimal subset that uses all values.
 */
export class SparseTestMatrixGenerator {
    constructor(private readonly props: SparseTestMatrixGeneratorProps) {
        if (Object.keys(props.dimensions).length === 0) {
            throw new Error("At least one dimension is required");
        }
    }

    generate = async (): Promise<JobMatrix> => {
        const testPaths = await glob(this.props.testGlobPattern);

        const matrix: JobMatrix = {};
        matrix.include = [];

        for (const testPathsBatch of this.chunkArray(testPaths, this.props.maxTestsPerJob)) {
            const dimensionsIndexes: Record<string, number> = {};
            const dimensionCoverageComplete: Record<string, boolean> = {};

            for (const key of Object.keys(this.props.dimensions)) {
                dimensionsIndexes[key] = 0;
                dimensionCoverageComplete[key] = false;
            }

            let allDimensionsComplete = false;

            do {
                const matrixEntry: Record<string, string> = {};
                matrixEntry.displayNames = testPathsBatch
                    .map((testPath) => path.basename(testPath))
                    .join(" ");
                for (const key of Object.keys(this.props.dimensions)) {
                    const dim = this.props.dimensions[key];
                    const idx = dimensionsIndexes[key] ?? 0;
                    matrixEntry[key] = dim?.[idx] ?? "";
                }
                matrixEntry.testPaths = testPathsBatch.join(" ");
                matrix.include?.push(matrixEntry);

                for (const key of Object.keys(this.props.dimensions)) {
                    dimensionsIndexes[key] = (dimensionsIndexes[key] ?? 0) + 1;
                    const dim = this.props.dimensions[key];
                    if (dimensionsIndexes[key] === dim?.length) {
                        dimensionCoverageComplete[key] = true;
                        dimensionsIndexes[key] = 0;
                    }
                }

                allDimensionsComplete = Object.keys(this.props.dimensions).reduce(
                    (acc: boolean, key: string) => acc && dimensionCoverageComplete[key] === true,
                    true,
                );
            } while (!allDimensionsComplete);
        }

        return matrix;
    };

    private chunkArray = <T>(array: Array<T>, chunkSize: number): Array<Array<T>> => {
        const result: Array<Array<T>> = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            result.push(array.slice(i, i + chunkSize));
        }
        return result;
    };
}
