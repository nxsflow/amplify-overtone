import { describe, expect, it } from "vitest";
import { emailAction } from "../../../src/schema/email-action.js";

describe("emailAction", () => {
    it("compiles minimal config", () => {
        const action = emailAction({ sender: "noreply", template: "invite" });
        const compiled = action._compile("inviteEmail");

        expect(compiled.name).toBe("inviteEmail");
        expect(compiled.config.sender).toBe("noreply");
        expect(compiled.config.template).toBe("invite");
        expect(compiled.arguments).toEqual({});
        expect(compiled.returnType).toEqual({
            messageId: { typeName: "String", required: false, isList: false },
        });
        expect(compiled.authRules).toEqual([]);
    });

    it("compiles with arguments and returns", () => {
        const action = emailAction({
            sender: "noreply",
            template: "invite",
            subject: ({ inviter }) => `${inviter} has invited you`,
        })
            .arguments({
                recipientEmail: { typeName: "AWSEmail", required: true, isList: false },
                inviter: { typeName: "String", required: true, isList: false },
            })
            .returns({
                messageId: { typeName: "String", required: true, isList: false },
                status: { typeName: "String", required: false, isList: false },
            });

        const compiled = action._compile("inviteEmail");
        expect(compiled.subjectTemplate).toBe("{{inviter}} has invited you");
        expect(compiled.arguments).toHaveProperty("recipientEmail");
        expect(compiled.arguments.recipientEmail.required).toBe(true);
        expect(compiled.returnType).toHaveProperty("status");
    });

    it("compiles with authorization", () => {
        const action = emailAction({ sender: "noreply", template: "invite" }).authorization(
            (allow) => [allow.authenticated()],
        );

        const compiled = action._compile("sendEmail");
        expect(compiled.authRules).toEqual([{ strategy: "authenticated" }]);
    });

    it("is immutable — methods return new builders", () => {
        const base = emailAction({ sender: "noreply", template: "invite" });
        const withArgs = base.arguments({
            to: { typeName: "String", required: true, isList: false },
        });

        expect(base._compile("a").arguments).toEqual({});
        expect(withArgs._compile("b").arguments).toHaveProperty("to");
    });
});
