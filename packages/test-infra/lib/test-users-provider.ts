import {
    AdminCreateUserCommand,
    AdminDeleteUserCommand,
    AdminSetUserPasswordCommand,
    CognitoIdentityProviderClient,
    UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import {
    CreateSecretCommand,
    DeleteSecretCommand,
    ResourceExistsException,
    SecretsManagerClient,
    UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import type {
    CloudFormationCustomResourceEvent,
    CloudFormationCustomResourceResponse,
} from "aws-lambda";

const cognito = new CognitoIdentityProviderClient({});
const secrets = new SecretsManagerClient({});

const USER_ROLES = ["owner", "coOwner", "editor", "reader"] as const;
const EMAIL_PREFIXES: Record<(typeof USER_ROLES)[number], string> = {
    owner: "owner",
    coOwner: "coowner",
    editor: "editor",
    reader: "reader",
};

function generatePassword(length = 16): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!-";
    const all = upper + lower + digits + symbols;

    // Ensure at least one of each category
    const required = [
        upper[Math.floor(Math.random() * upper.length)]!,
        lower[Math.floor(Math.random() * lower.length)]!,
        digits[Math.floor(Math.random() * digits.length)]!,
        symbols[Math.floor(Math.random() * symbols.length)]!,
    ];

    const remaining = Array.from(
        { length: length - required.length },
        () => all[Math.floor(Math.random() * all.length)]!,
    );

    // Shuffle all characters
    const chars = [...required, ...remaining];
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }

    return chars.join("");
}

async function createOrUpdateUser(
    userPoolId: string,
    email: string,
    password: string,
): Promise<void> {
    try {
        await cognito.send(
            new AdminCreateUserCommand({
                UserPoolId: userPoolId,
                Username: email,
                UserAttributes: [
                    { Name: "email", Value: email },
                    { Name: "email_verified", Value: "true" },
                ],
                MessageAction: "SUPPRESS",
            }),
        );
    } catch (error) {
        if (!(error instanceof UsernameExistsException)) {
            throw error;
        }
        // User already exists (re-deploy) — just update the password below
    }

    await cognito.send(
        new AdminSetUserPasswordCommand({
            UserPoolId: userPoolId,
            Username: email,
            Password: password,
            Permanent: true,
        }),
    );
}

async function deleteUser(userPoolId: string, email: string): Promise<void> {
    try {
        await cognito.send(
            new AdminDeleteUserCommand({
                UserPoolId: userPoolId,
                Username: email,
            }),
        );
    } catch {
        // Ignore errors — user may already be deleted
    }
}

async function createOrUpdateSecret(secretName: string, secretValue: string): Promise<string> {
    try {
        const result = await secrets.send(
            new CreateSecretCommand({
                Name: secretName,
                SecretString: secretValue,
            }),
        );
        return result.ARN!;
    } catch (error) {
        if (!(error instanceof ResourceExistsException)) {
            throw error;
        }
        // Secret already exists — update it
        const result = await secrets.send(
            new UpdateSecretCommand({
                SecretId: secretName,
                SecretString: secretValue,
            }),
        );
        return result.ARN!;
    }
}

async function deleteSecret(secretName: string): Promise<void> {
    try {
        await secrets.send(
            new DeleteSecretCommand({
                SecretId: secretName,
                ForceDeleteWithoutRecovery: true,
            }),
        );
    } catch {
        // Ignore errors — secret may already be deleted
    }
}

export async function handler(
    event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceResponse> {
    const { UserPoolId, RecipientDomain, SecretName } = event.ResourceProperties;

    if (event.RequestType === "Delete") {
        for (const role of USER_ROLES) {
            const email = `${EMAIL_PREFIXES[role]}@${RecipientDomain}`;
            await deleteUser(UserPoolId, email);
        }
        await deleteSecret(SecretName);

        return {
            Status: "SUCCESS",
            PhysicalResourceId: event.PhysicalResourceId ?? "deleted",
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
        };
    }

    // Create or Update
    const testUsers: Record<string, { email: string; password: string }> = {};

    for (const role of USER_ROLES) {
        const email = `${EMAIL_PREFIXES[role]}@${RecipientDomain}`;
        const password = generatePassword();
        await createOrUpdateUser(UserPoolId, email, password);
        testUsers[role] = { email, password };
    }

    const secretArn = await createOrUpdateSecret(SecretName, JSON.stringify(testUsers));

    return {
        Status: "SUCCESS",
        PhysicalResourceId: secretArn,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: {
            SecretArn: secretArn,
        },
    };
}
