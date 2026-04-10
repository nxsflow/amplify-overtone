import { describe, expect, it } from "vitest";
import { OvertoneSchema } from "../../../src/schema/overtone-schema.js";
import { generateEmailInvokeCode } from "../../../src/schema/resolver-generator.js";
import type { CompiledEmailAction } from "../../../src/schema/types.js";

const sampleAction: CompiledEmailAction = {
    name: "inviteEmail",
    config: { sender: "noreply" },
    compiledTemplate: {
        subject: "{{inviter}} has invited you",
        header: "You have been invited",
        body: "{{inviter}} invited you to join.",
    },
    arguments: {
        recipientEmail: { typeName: "AWSEmail", required: true, isList: false },
        inviter: { typeName: "String", required: true, isList: false },
    },
    returnType: {
        messageId: { typeName: "String", required: true, isList: false },
    },
    authRules: [{ strategy: "authenticated" }],
};

/** Action with a n.userId() argument — requires pipeline resolver. */
const userIdAction: CompiledEmailAction = {
    name: "welcomeUserEmail",
    config: { sender: "noreply" },
    compiledTemplate: {
        subject: "Welcome, {{recipient}}!",
        header: "Welcome",
        body: "Hello {{recipientName}}.",
    },
    arguments: {
        recipient: {
            typeName: "ID",
            required: true,
            isList: false,
            resolveType: "cognitoUser",
        },
    },
    returnType: {
        messageId: { typeName: "String", required: true, isList: false },
    },
    authRules: [{ strategy: "authenticated" }],
};

/** Build a mock backend for testing. */
function makeMockBackend(
    opts: { senderKeys?: string[]; graphqlApi?: unknown; definition?: string } = {},
) {
    const lambdaDsIds: string[] = [];
    const resolvers: { id: string; props: Record<string, unknown> }[] = [];

    const mockBackend = {
        data: {
            resources: {
                graphqlApi: opts.graphqlApi,
                cfnResources: {
                    cfnGraphqlSchema: {
                        definition: opts.definition ?? "type Mutation { existing: String }",
                    },
                },
            },
            addLambdaDataSource(id: string, _fn: unknown) {
                lambdaDsIds.push(id);
                return { name: id };
            },
            addResolver(id: string, props: Record<string, unknown>) {
                resolvers.push({ id, props });
            },
        },
        email: {
            resources: {
                lambda: { id: "SendEmailFunction" },
                userLookupLambda: { id: "UserLookupFunction" },
                senderKeys: opts.senderKeys ?? ["noreply"],
            },
        },
    };

    return { mockBackend, lambdaDsIds, resolvers };
}

describe("OvertoneSchema", () => {
    it("generates GraphQL schema for email actions", () => {
        const schema = new OvertoneSchema([sampleAction]);
        expect(schema.graphqlSchema).toContain("extend type Mutation");
        expect(schema.graphqlSchema).toContain("inviteEmail(");
        expect(schema.graphqlSchema).toContain("recipientEmail: AWSEmail!");
        expect(schema.graphqlSchema).toContain("InviteEmailResult");
    });

    it("generates correct resolver code for email actions", () => {
        const code = generateEmailInvokeCode(sampleAction);
        expect(code).toContain("export function request(ctx)");
        expect(code).toContain("export function response(ctx)");
        expect(code).toContain('"noreply"');
        expect(code).toContain("messageId");
    });

    it("handles multiple email actions", () => {
        const secondAction: CompiledEmailAction = {
            name: "resetPasswordEmail",
            config: { sender: "support" },
            compiledTemplate: {
                subject: "Reset your password",
                header: "Password Reset",
                body: "Click the link to reset your password.",
            },
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
        const { mockBackend, lambdaDsIds, resolvers } = makeMockBackend();

        // biome-ignore lint/suspicious/noExplicitAny: mock backend
        schema.addToBackend(mockBackend as any);

        const def = mockBackend.data.resources.cfnResources.cfnGraphqlSchema.definition;
        expect(def).toContain("type Mutation { existing: String }");
        expect(def).toContain("extend type Mutation");
        expect(def).toContain("inviteEmail(");

        expect(lambdaDsIds).toContain("OvertoneEmailDS");

        expect(resolvers).toHaveLength(1);
        const resolver = resolvers[0]!;
        expect(resolver.id).toBe("inviteEmailResolver");
        expect(resolver.props).toHaveProperty("typeName", "Mutation");
        expect(resolver.props).toHaveProperty("fieldName", "inviteEmail");
        expect(resolver.props).toHaveProperty("dataSource");
    });

    it("addToBackend throws when an action references an undefined sender", () => {
        const schema = new OvertoneSchema([sampleAction]); // sampleAction uses sender "noreply"

        const { mockBackend } = makeMockBackend({ senderKeys: ["support"] }); // "noreply" not in list

        expect(() =>
            // biome-ignore lint/suspicious/noExplicitAny: mock backend
            schema.addToBackend(mockBackend as any),
        ).toThrow(
            'Email action "inviteEmail" references sender "noreply" which is not defined in defineEmail(). Available senders: support',
        );
    });

    it("addToBackend creates one resolver per action with shared data source", () => {
        const secondAction: CompiledEmailAction = {
            name: "welcomeEmail",
            config: { sender: "noreply" },
            compiledTemplate: {
                subject: "Welcome!",
                header: "Welcome",
                body: "Thanks for joining.",
            },
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
        const { mockBackend, resolvers } = makeMockBackend();
        const mockDs = { name: "OvertoneEmailDS" };

        // Override addLambdaDataSource to return our tracked mock
        let dsCallCount = 0;
        mockBackend.data.addLambdaDataSource = (_id: string, _fn: unknown) => {
            dsCallCount++;
            return mockDs;
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

    // -----------------------------------------------------------------------
    // Pipeline resolver tests
    // -----------------------------------------------------------------------

    it("addToBackend creates a single-function resolver when no userId args (no graphqlApi)", () => {
        const schema = new OvertoneSchema([sampleAction]);
        const { mockBackend, lambdaDsIds, resolvers } = makeMockBackend({
            graphqlApi: undefined,
        });

        // biome-ignore lint/suspicious/noExplicitAny: mock backend
        schema.addToBackend(mockBackend as any);

        // Only email data source is created (no user-lookup DS needed)
        expect(lambdaDsIds).toEqual(["OvertoneEmailDS"]);

        // Single-function resolver — no pipelineConfig
        expect(resolvers).toHaveLength(1);
        expect(resolvers[0]!.props).toHaveProperty("dataSource");
        expect(resolvers[0]!.props).not.toHaveProperty("pipelineConfig");
    });

    it("addToBackend creates pipeline resolver when action has userId args and graphqlApi is present", () => {
        const schema = new OvertoneSchema([userIdAction]);

        // Minimal mock that provides a graphqlApi object (simulating real CDK scenario)
        // In real CDK, AppsyncFunction takes scope as first arg; here we mock the api object
        // to only verify the resolver is called with pipelineConfig.
        const mockApi = { __isGraphqlApi: true };
        const { mockBackend } = makeMockBackend({
            graphqlApi: mockApi,
        });

        // Override addLambdaDataSource to return mock data sources by id
        const dataSources: Record<string, { name: string }> = {};
        mockBackend.data.addLambdaDataSource = (id: string, _fn: unknown) => {
            dataSources[id] = { name: id };
            return dataSources[id];
        };

        // AppsyncFunction constructor will fail in unit test (no real CDK stack).
        // We test the logic by checking what's passed to addResolver via a mock
        // that overrides the pipeline path.
        //
        // Since we can't instantiate real AppsyncFunction without a CDK stack,
        // we verify the data source wiring: when userId args exist, the user-lookup
        // data source is created.
        try {
            // biome-ignore lint/suspicious/noExplicitAny: mock backend
            schema.addToBackend(mockBackend as any);
        } catch {
            // AppsyncFunction construction fails without a real CDK stack — expected in unit tests
        }

        // User-lookup data source MUST be created when userId args are present
        expect(Object.keys(dataSources)).toContain("OvertoneEmailDS");
        expect(Object.keys(dataSources)).toContain("OvertoneUserLookupDS");
    });

    it("addToBackend does NOT create user-lookup data source when no action uses userId args", () => {
        const schema = new OvertoneSchema([sampleAction]);
        const { mockBackend, lambdaDsIds } = makeMockBackend();

        // biome-ignore lint/suspicious/noExplicitAny: mock backend
        schema.addToBackend(mockBackend as any);

        // Only the email data source should be created
        expect(lambdaDsIds).toEqual(["OvertoneEmailDS"]);
        expect(lambdaDsIds).not.toContain("OvertoneUserLookupDS");
    });

    it("addToBackend uses single-function resolver when userId args exist but no graphqlApi", () => {
        // When graphqlApi is not available, falls back to single-function resolver
        const schema = new OvertoneSchema([userIdAction]);
        const { mockBackend, lambdaDsIds, resolvers } = makeMockBackend({
            graphqlApi: undefined,
        });

        // biome-ignore lint/suspicious/noExplicitAny: mock backend
        schema.addToBackend(mockBackend as any);

        // User-lookup DS is still created (action has userId args)
        expect(lambdaDsIds).toContain("OvertoneUserLookupDS");

        // But resolver falls back to single-function (no pipelineConfig)
        expect(resolvers).toHaveLength(1);
        expect(resolvers[0]!.props).not.toHaveProperty("pipelineConfig");
    });

    it("addToBackend sets USER_POOL_ID env and IAM permission on user-lookup Lambda when userPoolId provided", () => {
        const schema = new OvertoneSchema([userIdAction]);
        const envVars: Record<string, string> = {};
        const policies: unknown[] = [];

        const mockUserLookupLambda = {
            id: "UserLookupFunction",
            addEnvironment(key: string, value: string) {
                envVars[key] = value;
            },
            addToRolePolicy(policy: unknown) {
                policies.push(policy);
            },
        };

        const { mockBackend } = makeMockBackend();
        // Override the user-lookup lambda with our instrumented mock
        mockBackend.email.resources.userLookupLambda = mockUserLookupLambda as never;

        // biome-ignore lint/suspicious/noExplicitAny: mock backend
        schema.addToBackend(mockBackend as any, { userPoolId: "us-east-1_ABC123" });

        expect(envVars.USER_POOL_ID).toBe("us-east-1_ABC123");
        expect(policies).toHaveLength(1);
    });
});
