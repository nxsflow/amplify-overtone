import type {
    ConstructFactory,
    ConstructFactoryGetInstanceProps,
    ResourceProvider,
} from "@aws-amplify/plugin-types";
import { AmplifyEmail } from "./construct.js";
import type { EmailDefinition, EmailProps, EmailResources } from "./types.js";

/**
 * Singleton factory for AmplifyEmail constructs.
 * Mirrors the DataFactory / FunctionFactory pattern from @aws-amplify/backend.
 *
 * Only one defineEmail() call is allowed per Amplify backend.
 */
export class EmailFactory implements ConstructFactory<ResourceProvider<EmailResources>> {
    static factoryCount = 0;
    private instance: ResourceProvider<EmailResources> | undefined;

    constructor(private readonly props: EmailProps) {
        EmailFactory.factoryCount++;
        if (EmailFactory.factoryCount > 1) {
            throw new Error(
                "defineEmail() can only be called once per Amplify backend. " +
                    "Pass a single defineEmail() result to defineBackend().",
            );
        }
    }

    getInstance(factoryProps: ConstructFactoryGetInstanceProps): ResourceProvider<EmailResources> {
        if (!this.instance) {
            const emailProps = this.props;
            const provider = factoryProps.constructContainer.getOrCompute({
                resourceGroupName: "email",
                generateContainerEntry: ({ scope }) => {
                    const construct = new AmplifyEmail(scope, "AmplifyEmail", emailProps);
                    return { resources: construct.resources };
                },
            });
            this.instance = provider as ResourceProvider<EmailResources>;
        }
        return this.instance;
    }
}

/**
 * Creates an email infrastructure factory for an Amplify Gen 2 backend.
 *
 * Provisions Amazon SES domain identity, send-email Lambda with built-in
 * templates, and optionally creates DNS records in Route 53. Pass the
 * result to `defineBackend()` to include email in your Amplify backend.
 *
 * Can only be called once per backend.
 *
 * @example No custom domain (simplest setup)
 * ```ts
 * import { defineEmail } from "@nxsflow/amplify-overtone";
 * export const email = defineEmail({});
 * ```
 *
 * @example Custom domain with Route 53 (automatic DNS)
 * ```ts
 * export const email = defineEmail({
 *   domain: "mail.nxsflow.com",
 *   hostedZoneId: "Z0123456789ABCDEFGHIJ",
 *   hostedZoneDomain: "nxsflow.com",
 *   senders: {
 *     noreply: { senderPrefix: "noreply", displayName: "NexusFlow" },
 *     support: { senderPrefix: "support", displayName: "NexusFlow Support" },
 *   },
 * });
 * ```
 *
 * @example Custom domain with external DNS (manual record creation)
 * ```ts
 * export const email = defineEmail({
 *   domain: "mail.example.com",
 *   senders: { noreply: { senderPrefix: "noreply", displayName: "MyApp" } },
 * });
 * ```
 *
 * @example No custom domain (individual sender verification)
 * ```ts
 * export const email = defineEmail({
 *   senders: {
 *     noreply: { senderEmail: "noreply@gmail.com", displayName: "MyApp" },
 *   },
 * });
 * ```
 */
export const defineEmail = (props: EmailProps = {}): EmailDefinition => new EmailFactory(props);
