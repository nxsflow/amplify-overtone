import { defineBackend } from "@aws-amplify/backend";
import { email } from "./email/resource.js";

defineBackend({ email });
