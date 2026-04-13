import { a } from "@aws-amplify/data-schema";
import { n } from "@nxsflow/amplify-overtone";

export const schemaDefinition = {
    sendNotification: n
        .email({ sender: "noreply" })
        .arguments({
            recipient: a.email().required(),
            subject: a.string().required(),
            header: a.string().required(),
            body: a.string().required(),
        })
        .template({
            subject: ({ subject }) => subject,
            header: ({ header }) => header,
            body: ({ body }) => body,
            footer: "Sent by Overtone Test",
        })
        .authorization((allow) => [allow.authenticated()]),
};

export const schema = a.schema(schemaDefinition);
