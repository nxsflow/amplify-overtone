import { describe, expect, it } from "vitest";
import { emailAction } from "../../../src/schema/email-action.js";
import { schema } from "../../../src/schema/schema-builder.js";

describe("schema", () => {
    it("compiles email actions into OvertoneSchema", () => {
        const s = schema({
            inviteEmail: emailAction({
                sender: "noreply",
                template: "invite",
                subject: ({ inviter }) => `${inviter} has invited you`,
            })
                .arguments({
                    recipientEmail: { typeName: "AWSEmail", required: true, isList: false },
                    inviter: { typeName: "String", required: true, isList: false },
                })
                .authorization((allow) => [allow.authenticated()]),
        });

        expect(s.emailActions).toHaveLength(1);
        expect(s.emailActions[0].name).toBe("inviteEmail");
        expect(s.emailActions[0].config.sender).toBe("noreply");
    });

    it("compiles multiple email actions", () => {
        const s = schema({
            inviteEmail: emailAction({ sender: "noreply", template: "invite" }),
            welcomeEmail: emailAction({
                sender: "noreply",
                template: "getting-started",
            }),
        });

        expect(s.emailActions).toHaveLength(2);
        const names = s.emailActions.map((a) => a.name);
        expect(names).toContain("inviteEmail");
        expect(names).toContain("welcomeEmail");
    });

    it("generates GraphQL SDL", () => {
        const s = schema({
            inviteEmail: emailAction({ sender: "noreply", template: "invite" })
                .arguments({
                    recipientEmail: { typeName: "AWSEmail", required: true, isList: false },
                })
                .authorization((allow) => [allow.authenticated()]),
        });

        expect(s.graphqlSchema).toContain("extend type Mutation");
        expect(s.graphqlSchema).toContain("inviteEmail(");
    });
});
