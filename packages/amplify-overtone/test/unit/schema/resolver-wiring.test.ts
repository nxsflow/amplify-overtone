import { describe, expect, it } from "vitest";
import { extractEmailActions } from "../../../src/schema/resolver-wiring.js";
import { OVERTONE_EMAIL_META, type OvertoneEmailMeta } from "../../../src/schema/types.js";

function makeEmailAction(meta: OvertoneEmailMeta): unknown {
    return {
        [OVERTONE_EMAIL_META]: meta,
        data: { typeName: "Mutation" },
    };
}

describe("extractEmailActions", () => {
    it("extracts Overtone email actions from schema entries", () => {
        const schemaEntries = {
            sendInvite: makeEmailAction({
                sender: "noreply",
                compiledTemplate: {
                    subject: "{{invitedByName}} invited you",
                    header: "Invitation",
                    body: "You are invited.",
                },
                userIdArgNames: ["invitedBy"],
                hasRecipientUserId: false,
            }),
            UserModel: { data: { type: "model" } },
        };

        const actions = extractEmailActions(schemaEntries);
        expect(actions).toHaveLength(1);
        expect(actions[0].name).toBe("sendInvite");
        expect(actions[0].meta.sender).toBe("noreply");
    });

    it("returns empty array when no email actions found", () => {
        const schemaEntries = {
            UserModel: { data: { type: "model" } },
        };

        const actions = extractEmailActions(schemaEntries);
        expect(actions).toHaveLength(0);
    });

    it("extracts multiple email actions", () => {
        const schemaEntries = {
            sendInvite: makeEmailAction({
                sender: "noreply",
                compiledTemplate: { subject: "Invite", header: "Hi", body: "Body." },
                userIdArgNames: [],
                hasRecipientUserId: false,
            }),
            sendWelcome: makeEmailAction({
                sender: "noreply",
                compiledTemplate: { subject: "Welcome", header: "Hi", body: "Body." },
                userIdArgNames: [],
                hasRecipientUserId: false,
            }),
        };

        const actions = extractEmailActions(schemaEntries);
        expect(actions).toHaveLength(2);
    });

    it("identifies actions with userId args", () => {
        const schemaEntries = {
            sendInvite: makeEmailAction({
                sender: "noreply",
                compiledTemplate: { subject: "Invite", header: "Hi", body: "Body." },
                userIdArgNames: ["recipient", "invitedBy"],
                hasRecipientUserId: true,
            }),
        };

        const actions = extractEmailActions(schemaEntries);
        expect(actions[0].meta.userIdArgNames).toEqual(["recipient", "invitedBy"]);
        expect(actions[0].meta.hasRecipientUserId).toBe(true);
    });
});
