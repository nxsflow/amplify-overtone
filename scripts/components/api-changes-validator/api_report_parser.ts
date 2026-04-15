import ts from "typescript";

/**
 * Parses api report into AST representation.
 */
export const parseApiReport = (apiReportContent: string): ts.SourceFile => {
    const codeSnippetStartToken = "```ts";
    const codeSnippetEndToken = "```";
    const apiReportTypeScriptContent = apiReportContent.substring(
        apiReportContent.indexOf(codeSnippetStartToken) + codeSnippetStartToken.length,
        apiReportContent.lastIndexOf(codeSnippetEndToken),
    );
    return ts.createSourceFile(
        "API.api.md",
        apiReportTypeScriptContent,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
    );
};
