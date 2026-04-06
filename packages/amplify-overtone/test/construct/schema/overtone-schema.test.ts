import { describe, expect, it } from "vitest";
import { OvertoneSchema } from "../../../src/schema/overtone-schema.js";
import { generateResolverCode } from "../../../src/schema/resolver-generator.js";
import type { CompiledEmailAction } from "../../../src/schema/types.js";

const sampleAction: CompiledEmailAction = {
    name: "inviteEmail",
    config: { sender: "noreply", template: "invite" },
    subjectTemplate: "{{inviter}} has invited you",
    arguments: {
        recipientEmail: { typeName: "AWSEmail", required: true, isList: false },
        inviter: { typeName: "String", required: true, isList: false },
    },
    returnType: {
        messageId: { typeName: "String", required: true, isList: false },
    },
    authRules: [{ strategy: "authenticated" }],
};

describe("OvertoneSchema", () => {
    it("generates GraphQL schema for email actions", () => {
        const schema = new OvertoneSchema([sampleAction]);
        expect(schema.graphqlSchema).toContain("extend type Mutation");
        expect(schema.graphqlSchema).toContain("inviteEmail(");
        expect(schema.graphqlSchema).toContain("recipientEmail: AWSEmail!");
        expect(schema.graphqlSchema).toContain("InviteEmailResult");
    });

    it("generates correct resolver code for email actions", () => {
        const code = generateResolverCode(sampleAction);
        expect(code).toContain("export function request(ctx)");
        expect(code).toContain("export function response(ctx)");
        expect(code).toContain('"noreply"');
        expect(code).toContain('"invite"');
        expect(code).toContain("messageId");
    });

    it("handles multiple email actions", () => {
        const secondAction: CompiledEmailAction = {
            name: "resetPasswordEmail",
            config: { sender: "support", template: "reset" },
            subjectTemplate: "Reset your password",
            arguments: {
                recipientEmail: {
                    typeName: "AWSEmail",
                    required: true,
                    isList: false,
                },
                resetLink: {
                    typeName: "String",
                    required: true,
                    isList: false,
                },
            },
            returnType: {
                messageId: {
                    typeName: "String",
                    required: true,
                    isList: false,
                },
            },
            authRules: [{ strategy: "public", provider: "iam" }],
        };

        const schema = new OvertoneSchema([sampleAction, secondAction]);
        expect(schema.graphqlSchema).toContain("inviteEmail(");
        expect(schema.graphqlSchema).toContain("resetPasswordEmail(");
        expect(schema.graphqlSchema).toContain("InviteEmailResult");
        expect(schema.graphqlSchema).toContain("ResetPasswordEmailResult");
        expect(schema.emailActions).toHaveLength(2);
    });

    it("addToBackend extends schema and creates data source and resolvers", () => {
        const schema = new OvertoneSchema([sampleAction]);

        let lambdaDsId = "";
        const resolvers: { id: string; props: Record<string, unknown> }[] = [];

        const mockBackend = {
            data: {
                resources: {
                    cfnResources: {
                        cfnGraphqlSchema: {
                            definition: "type Mutation { existing: String }",
                        },
                    },
                },
                addLambdaDataSource(id: string, _fn: unknown) {
                    lambdaDsId = id;
                    return { name: "OvertoneEmailDS" };
                },
                addResolver(id: string, props: Record<string, unknown>) {
                    resolvers.push({ id, props });
                },
            },
            email: {
                resources: { lambda: {} },
            },
        };

        // biome-ignore lint/suspicious/noExplicitAny: mock backend
        schema.addToBackend(mockBackend as any);

        const def = mockBackend.data.resources.cfnResources.cfnGraphqlSchema.definition;
        expect(def).toContain("type Mutation { existing: String }");
        expect(def).toContain("extend type Mutation");
        expect(def).toContain("inviteEmail(");

        expect(lambdaDsId).toBe("OvertoneEmailDS");

        expect(resolvers).toHaveLength(1);
        const resolver = resolvers[0]!;
        expect(resolver.id).toBe("inviteEmailResolver");
        expect(resolver.props).toHaveProperty("typeName", "Mutation");
        expect(resolver.props).toHaveProperty("fieldName", "inviteEmail");
        expect(resolver.props).toHaveProperty("dataSource");
    });

    it("addToBackend creates one resolver per action with shared data source", () => {
        const secondAction: CompiledEmailAction = {
            name: "welcomeEmail",
            config: { sender: "noreply", template: "welcome" },
            subjectTemplate: "Welcome!",
            arguments: {
                recipientEmail: {
                    typeName: "AWSEmail",
                    required: true,
                    isList: false,
                },
            },
            returnType: {
                messageId: {
                    typeName: "String",
                    required: true,
                    isList: false,
                },
            },
            authRules: [{ strategy: "authenticated" }],
        };

        const schema = new OvertoneSchema([sampleAction, secondAction]);
        let dsCallCount = 0;
        const resolvers: { id: string; props: Record<string, unknown> }[] = [];
        const mockDs = { name: "OvertoneEmailDS" };

        const mockBackend = {
            data: {
                resources: {
                    cfnResources: {
                        cfnGraphqlSchema: { definition: "" },
                    },
                },
                addLambdaDataSource(_id: string, _fn: unknown) {
                    dsCallCount++;
                    return mockDs;
                },
                addResolver(id: string, props: Record<string, unknown>) {
                    resolvers.push({ id, props });
                },
            },
            email: {
                resources: { lambda: {} },
            },
        };

        // biome-ignore lint/suspicious/noExplicitAny: mock backend
        schema.addToBackend(mockBackend as any);

        expect(dsCallCount).toBe(1);
        expect(resolvers).toHaveLength(2);
        const first = resolvers[0]!;
        const second = resolvers[1]!;
        expect(first.id).toBe("inviteEmailResolver");
        expect(second.id).toBe("welcomeEmailResolver");
        expect(first.props.dataSource).toBe(mockDs);
        expect(second.props.dataSource).toBe(mockDs);
    });
});
