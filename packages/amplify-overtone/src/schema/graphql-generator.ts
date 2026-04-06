import type { AuthRule, CompiledEmailAction, FieldDef } from "./types.js";

function pascalCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFieldType(field: FieldDef): string {
    const base = field.isList ? `[${field.typeName}]` : field.typeName;
    return field.required ? `${base}!` : base;
}

function authDirectives(rules: AuthRule[]): string {
    const directives: string[] = [];
    for (const rule of rules) {
        switch (rule.strategy) {
            case "authenticated":
            case "owner":
                directives.push("@aws_cognito_user_pools");
                break;
            case "public":
                directives.push(rule.provider === "iam" ? "@aws_iam" : "@aws_api_key");
                break;
            case "group":
                directives.push(
                    `@aws_cognito_user_pools(cognito_groups: [${rule.groups.map((g) => `"${g}"`).join(", ")}])`,
                );
                break;
        }
    }
    // Deduplicate
    return [...new Set(directives)].length > 0 ? ` ${[...new Set(directives)].join(" ")}` : "";
}

function returnTypeName(actionName: string): string {
    return `${pascalCase(actionName)}Result`;
}

export function generateGraphqlSchema(actions: CompiledEmailAction[]): string {
    const mutations: string[] = [];
    const types: string[] = [];

    for (const action of actions) {
        const args = Object.entries(action.arguments)
            .map(([name, field]) => `${name}: ${formatFieldType(field)}`)
            .join(", ");

        const typeName = returnTypeName(action.name);
        const auth = authDirectives(action.authRules);

        mutations.push(`  ${action.name}(${args}): ${typeName}${auth}`);

        const fields = Object.entries(action.returnType)
            .map(([name, field]) => `  ${name}: ${formatFieldType(field)}`)
            .join("\n");

        types.push(`type ${typeName}${auth} {\n${fields}\n}`);
    }

    const mutationExtension = `extend type Mutation {\n${mutations.join("\n")}\n}`;
    return [mutationExtension, ...types].join("\n\n");
}
