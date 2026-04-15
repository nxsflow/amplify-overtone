import { glob } from "glob";

let result = await glob("packages/*");

// Exclude packages that don't have unit tests run via this script
result = result.filter(
    (pkg) =>
        !pkg.includes("integration-tests") &&
        !pkg.includes("test-infra") &&
        !pkg.includes("test-import") &&
        !pkg.includes("docs") &&
        !pkg.includes("website"),
);

console.log(result.join(" "));
