import { describe, expect, it } from "vitest";
import { generateGraphqlSchema } from "../../../src/schema/graphql-generator.js";
import type { CompiledEmailAction } from "../../../src/schema/types.js";

const sampleAction: CompiledEmailAction = {
    name: "inviteEmail",
    config: { sender: "noreply", template: "invite" },
    subjectTemplate: "{{inviter}} has invited you",
    arguments: {
        recipientEmail: { typeName: "AWSEmail", required: true, isList: false },
        inviter: { typeName: "String", required: true, isList: false },
        documentName: { typeName: "String", required: false, isList: false },
    },
    returnType: {
        messageId: { typeName: "String", required: true, isList: false },
        status: { typeName: "String", required: false, isList: false },
    },
    authRules: [{ strategy: "authenticated" }],
};

describe("generateGraphqlSchema", () => {
    it("generates extend type Mutation with arguments", () => {
        const sdl = generateGraphqlSchema([sampleAction]);
        expect(sdl).toContain("extend type Mutation");
        expect(sdl).toContain("inviteEmail(");
        expect(sdl).toContain("recipientEmail: AWSEmail!");
        expect(sdl).toContain("inviter: String!");
        expect(sdl).toContain("documentName: String");
        expect(sdl).toContain("): InviteEmailResult");
    });

    it("generates return type", () => {
        const sdl = generateGraphqlSchema([sampleAction]);
        expect(sdl).toContain("type InviteEmailResult");
        expect(sdl).toContain("messageId: String!");
        expect(sdl).toContain("status: String");
    });

    it("generates auth directive for authenticated", () => {
        const sdl = generateGraphqlSchema([sampleAction]);
        expect(sdl).toContain("@aws_cognito_user_pools");
    });

    it("generates multiple mutations", () => {
        const second: CompiledEmailAction = {
            ...sampleAction,
            name: "welcomeEmail",
            arguments: {
                recipientEmail: { typeName: "AWSEmail", required: true, isList: false },
            },
            returnType: {
                messageId: { typeName: "String", required: false, isList: false },
            },
        };
        const sdl = generateGraphqlSchema([sampleAction, second]);
        expect(sdl).toContain("inviteEmail(");
        expect(sdl).toContain("welcomeEmail(");
        expect(sdl).toContain("type InviteEmailResult");
        expect(sdl).toContain("type WelcomeEmailResult");
    });
});
