import { n } from "@nxsflow/amplify-overtone";

export const emailSchema = n.schema({
    sendInvite: n
        .email({ sender: "noreply" })
        .arguments({
            recipient: n.userId(),
            invitedBy: n.userId(),
            projectName: { typeName: "String", required: true, isList: false },
        })
        .template({
            subject: ({ invitedBy, projectName }) =>
                `${invitedBy.givenName} invited you to ${projectName}`,
            header: "You've been invited!",
            body: ({ invitedBy, projectName }) =>
                `${invitedBy.givenName} (${invitedBy.email}) invited you to collaborate on ${projectName}.`,
            footer: "If you did not expect this invitation, you can ignore this email.",
        })
        .authorization((allow) => [allow.authenticated()]),
});
