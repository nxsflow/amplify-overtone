import { defineAuth } from "@aws-amplify/backend";
import { createUser } from "../functions/create-user/resource";

export const auth = defineAuth({
    name: "overtone-test-infra",
    loginWith: { email: true },
    userAttributes: {
        familyName: { mutable: false, required: true },
        givenName: { mutable: false, required: true },
        fullname: { mutable: false, required: true },
    },
    access: (allow) => [
        allow.resource(createUser).to(["createUser", "setUserPassword", "deleteUser"]),
    ],
});
