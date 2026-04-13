import { type LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";

/**
 * Discovers a Lambda function name by scanning all functions in the account
 * and matching against the project name and construct ID substring.
 *
 * CDK-generated Lambda function names follow the pattern:
 *   {stackName}-{constructPath}-{hash}
 *
 * The stack name includes the sanitized package.json name, and the construct
 * path includes the construct ID (e.g., "SendEmailFunction").
 */
export async function discoverFunctionName(
    client: LambdaClient,
    projectName: string,
    constructIdSubstring: string,
): Promise<string> {
    const sanitizedProject = projectName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const constructLower = constructIdSubstring.toLowerCase();
    let marker: string | undefined;

    do {
        const result = await client.send(new ListFunctionsCommand({ Marker: marker }));
        const match = result.Functions?.find((f) => {
            const name = f.FunctionName?.toLowerCase() ?? "";
            return name.includes(sanitizedProject) && name.includes(constructLower);
        });
        if (match?.FunctionName) return match.FunctionName;
        marker = result.NextMarker;
    } while (marker);

    throw new Error(
        `No Lambda function found matching project "${projectName}" and construct "${constructIdSubstring}"`,
    );
}
