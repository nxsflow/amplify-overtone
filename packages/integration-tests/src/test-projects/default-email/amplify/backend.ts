import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource.js";
import { data } from "./data/resource.js";
import { email } from "./email/resource.js";

defineBackend({ auth, data, email });
