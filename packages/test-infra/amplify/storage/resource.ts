import { defineStorage } from "@aws-amplify/backend";
import { routeEmail } from "../functions/route-email/resource";

export const storage = defineStorage({
    name: "receive-email",
    access: (allow) => ({
        "raw/*": [allow.resource(routeEmail).to(["read"])],
        "emails/*": [allow.resource(routeEmail).to(["read", "write"])],
    }),
});
