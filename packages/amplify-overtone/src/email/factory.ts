import type {
    ConstructFactory,
    ConstructFactoryGetInstanceProps,
    ResourceProvider,
} from "@aws-amplify/plugin-types";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { Function as LambdaFunction, IFunction } from "aws-cdk-lib/aws-lambda";
import { getRegisteredActions } from "../schema/action-registry.js";
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
            let emailConstruct: AmplifyEmail | undefined;

            const provider = factoryProps.constructContainer.getOrCompute({
                resourceGroupName: "email",
                generateContainerEntry: ({ scope }) => {
                    emailConstruct = new AmplifyEmail(scope, "AmplifyEmail", emailProps);
                    return { resources: emailConstruct.resources };
                },
            });
            this.instance = provider as ResourceProvider<EmailResources>;

            // Auto-wire email action resolvers after construct creation
            if (emailConstruct) {
                this.wireEmailActions(emailConstruct, factoryProps);
            }
        }
        return this.instance;
    }

    private wireEmailActions(
        construct: AmplifyEmail,
        factoryProps: ConstructFactoryGetInstanceProps,
    ): void {
        const actions = getRegisteredActions();
        if (actions.length === 0) return;

        // Validate senders
        const validSenders = construct.resources.senderKeys;
        for (const action of actions) {
            if (action.meta.sender && !validSenders.includes(action.meta.sender)) {
                throw new Error(
                    `Email action "${action.id}" references sender "${action.meta.sender}" ` +
                        `which is not defined in defineEmail(). Available senders: ${validSenders.join(", ")}`,
                );
            }
        }

        // Discover the data construct via the construct container.
        // If data was already computed (registered by defineData()), getOrCompute returns the
        // cached AmplifyGraphqlApi instance. If not, the generator throws and we skip wiring.
        // biome-ignore lint/suspicious/noExplicitAny: AmplifyGraphqlApi not imported as peer dep
        let dataConstruct: any;
        try {
            dataConstruct = factoryProps.constructContainer.getOrCompute({
                resourceGroupName: "data",
                generateContainerEntry: () => {
                    throw new Error("No data construct registered");
                },
            });
        } catch {
            // No data construct — email actions require defineData() in the backend
            return;
        }

        // Register sendLambda as a Lambda data source on the AppSync API
        const emailDS = dataConstruct.addLambdaDataSource(
            "OvertoneEmailDS",
            construct.resources.sendLambda,
        );

        // Build EMAIL_TEMPLATES env var (keyed by action ID)
        const templateMap: Record<string, unknown> = {};
        for (const action of actions) {
            templateMap[action.id] = {
                subject: action.meta.compiledTemplate?.subject,
                header: action.meta.compiledTemplate?.header,
                body: action.meta.compiledTemplate?.body,
                callToAction: action.meta.compiledTemplate?.callToAction,
                footer: action.meta.compiledTemplate?.footer,
                sender: action.meta.sender,
                userIdArgs: action.meta.userIdArgNames,
                recipientArg: action.meta.hasRecipientUserId ? "recipient" : undefined,
            };
        }
        (construct.resources.sendLambda as LambdaFunction).addEnvironment(
            "EMAIL_TEMPLATES",
            JSON.stringify(templateMap),
        );

        // If any action needs Cognito user lookup, discover auth and set USER_POOL_ID
        const needsUserLookup = actions.some((a) => a.meta.userIdArgNames.length > 0);
        if (needsUserLookup) {
            const authFactory =
                factoryProps.constructContainer.getConstructFactory("AuthResources");
            if (authFactory) {
                const authProvider = authFactory.getInstance(factoryProps);
                // biome-ignore lint/suspicious/noExplicitAny: AuthResources type not imported
                const authResources = (authProvider as any).resources;
                const userPoolId: string | undefined = authResources?.userPool?.userPoolId;

                if (userPoolId) {
                    (construct.resources.sendLambda as LambdaFunction).addEnvironment(
                        "USER_POOL_ID",
                        userPoolId,
                    );

                    // Grant AdminGetUser permission
                    (construct.resources.sendLambda as IFunction).addToRolePolicy?.(
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ["cognito-idp:AdminGetUser"],
                            resources: [authResources.userPool.userPoolArn],
                        }),
                    );
                }
            }
        }
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
