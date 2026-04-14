import { defineBackend } from "@aws-amplify/backend";
import { addEmailResolvers, extractEmailActions } from "@nxsflow/amplify-overtone";
import { auth, userPoolId } from "./auth/resource.js";
import { data, schemaDefinition } from "./data/resource.js";
import { email } from "./email/resource.js";

const backend = defineBackend({ auth, data, email });

const emailActions = extractEmailActions(schemaDefinition);
addEmailResolvers(backend, emailActions, { userPoolId });
