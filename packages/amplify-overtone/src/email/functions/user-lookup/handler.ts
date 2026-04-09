import {
    AdminGetUserCommand,
    CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

const cognito = new CognitoIdentityProviderClient({});

interface UserLookupPayload {
    /** Map of argument name → Cognito user ID (sub). */
    userIdArgs: Record<string, string>;
}

interface ResolvedUser {
    name: string;
    email: string;
    givenName: string;
    familyName: string;
}

type UserLookupResult = Record<string, ResolvedUser>;

function extractAttribute(
    attrs: { Name?: string; Value?: string }[] | undefined,
    name: string,
): string {
    return attrs?.find((a) => a.Name === name)?.Value ?? "";
}

export const handler = async (
    event: UserLookupPayload,
): Promise<UserLookupResult> => {
    const userPoolId = process.env.USER_POOL_ID;
    if (!userPoolId) {
        throw new Error("USER_POOL_ID environment variable is not set");
    }

    const result: UserLookupResult = {};

    const entries = Object.entries(event.userIdArgs);
    const resolved = await Promise.all(
        entries.map(async ([argName, userId]) => {
            const response = await cognito.send(
                new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: userId,
                }),
            );
            const attrs = response.UserAttributes;
            return [
                argName,
                {
                    name: extractAttribute(attrs, "name"),
                    email: extractAttribute(attrs, "email"),
                    givenName: extractAttribute(attrs, "given_name"),
                    familyName: extractAttribute(attrs, "family_name"),
                },
            ] as const;
        }),
    );

    for (const [argName, user] of resolved) {
        result[argName] = user;
    }

    return result;
};
