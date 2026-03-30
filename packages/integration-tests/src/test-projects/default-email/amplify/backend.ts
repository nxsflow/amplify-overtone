import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource.js";
import { email } from "./email/resource.js";

defineBackend({ auth, email });
