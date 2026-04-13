import { a } from "@aws-amplify/data-schema";
import { n } from "@nxsflow/amplify-overtone";

export const schemaDefinition = {
    sendInvite: n
        .email({ sender: "noreply" })
        .arguments({
            recipient: n.userId(),
            invitedBy: n.userId(),
            projectName: a.string().required(),
        })
        .template({
            subject: ({ invitedBy, projectName }) =>
                `${invitedBy.givenName} invited you to ${projectName}`,
            header: ({ invitedBy }) => `${invitedBy.name} wants to collaborate`,
            body: ({ invitedBy, recipient, projectName }) =>
                `${invitedBy.givenName} ${invitedBy.familyName} (${invitedBy.email}) invited ${recipient.name} to collaborate on ${projectName}.`,
            callToAction: {
                label: "Accept Invitation",
                href: "https://app.example.com/accept",
            },
            footer: "If you did not expect this invitation, you can ignore this email.",
        })
        .authorization((allow) => [allow.authenticated()]),
};

export const schema = a.schema(schemaDefinition);
