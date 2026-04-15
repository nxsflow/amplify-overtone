import {
    CloudFormationClient,
    DeleteStackCommand,
    ListStacksCommand,
    type ListStacksCommandOutput,
    StackStatus,
    type StackSummary,
} from "@aws-sdk/client-cloudformation";
import {
    CognitoIdentityProviderClient,
    DeleteUserPoolCommand,
    DeleteUserPoolDomainCommand,
    DescribeUserPoolCommand,
    ListUserPoolsCommand,
    type ListUserPoolsCommandOutput,
    type UserPoolDescriptionType,
} from "@aws-sdk/client-cognito-identity-provider";
import {
    DeleteRoleCommand,
    DeleteRolePolicyCommand,
    DetachRolePolicyCommand,
    IAMClient,
    ListAttachedRolePoliciesCommand,
    type ListAttachedRolePoliciesCommandOutput,
    ListRolePoliciesCommand,
    type ListRolePoliciesCommandOutput,
    ListRolesCommand,
    type ListRolesCommandOutput,
    type Role,
} from "@aws-sdk/client-iam";
import {
    type Bucket,
    DeleteBucketCommand,
    DeleteObjectsCommand,
    ListBucketsCommand,
    ListObjectsV2Command,
    type ListObjectsV2CommandOutput,
    ListObjectVersionsCommand,
    type ObjectIdentifier,
    S3Client,
} from "@aws-sdk/client-s3";
import {
    DeleteEmailIdentityCommand,
    type IdentityInfo,
    ListEmailIdentitiesCommand,
    type ListEmailIdentitiesCommandOutput,
    SESv2Client,
} from "@aws-sdk/client-sesv2";
import {
    DeleteParameterCommand,
    DescribeParametersCommand,
    type DescribeParametersCommandOutput,
    type ParameterMetadata,
    SSMClient,
} from "@aws-sdk/client-ssm";

const cfnClient = new CloudFormationClient({ maxAttempts: 5 });
const cognitoClient = new CognitoIdentityProviderClient({ maxAttempts: 5 });
const iamClient = new IAMClient({ maxAttempts: 5 });
const s3Client = new S3Client({ maxAttempts: 5 });
const sesClient = new SESv2Client({ maxAttempts: 5 });
const ssmClient = new SSMClient({ maxAttempts: 5 });

const now = new Date();

/**
 * Stacks are considered stale after 4 hours.
 * Other resources are also considered stale after 4 hours
 * (stack deletion triggers async cleanup; we defer direct deletion by an extra hour to avoid interference).
 */
const STACK_STALE_MS = 4 * 60 * 60 * 1000;
const RESOURCE_STALE_MS = 5 * 60 * 60 * 1000;

const STACK_PREFIXES = ["amplify-", "overtone-"];
const BUCKET_PREFIXES = ["amplify-", "overtone-"];
const IAM_ROLE_PREFIXES = ["amplify-", "overtone-"];
const SSM_PATH_PREFIXES = ["/amplify/", "/overtone/"];

const isStackStale = (stack: StackSummary): boolean => {
    if (!stack.CreationTime) return false;
    return now.getTime() - stack.CreationTime.getTime() > STACK_STALE_MS;
};

const isStale = (date: Date | undefined): boolean => {
    if (!date) return false;
    return now.getTime() - date.getTime() > RESOURCE_STALE_MS;
};

// ---------------------------------------------------------------------------
// CloudFormation stacks
// ---------------------------------------------------------------------------

const listAllStaleStacks = async (): Promise<Array<StackSummary>> => {
    let nextToken: string | undefined;
    const results: Array<StackSummary> = [];
    do {
        const response: ListStacksCommandOutput = await cfnClient.send(
            new ListStacksCommand({
                NextToken: nextToken,
                StackStatusFilter: Object.keys(StackStatus).filter(
                    (s) => s !== StackStatus.DELETE_COMPLETE,
                ) as Array<StackStatus>,
            }),
        );
        nextToken = response.NextToken;
        for (const stack of response.StackSummaries ?? []) {
            const matchesPrefix = STACK_PREFIXES.some((prefix) =>
                stack.StackName?.startsWith(prefix),
            );
            if (matchesPrefix && isStackStale(stack)) {
                results.push(stack);
            }
        }
    } while (nextToken);
    return results;
};

console.log("Cleaning up stale CloudFormation stacks...");
const staleStacks = await listAllStaleStacks();
for (const stack of staleStacks) {
    const stackName = stack.StackName;
    if (!stackName) continue;
    try {
        await cfnClient.send(new DeleteStackCommand({ StackName: stackName }));
        console.log(`Successfully kicked off deletion of stack: ${stackName}`);
    } catch (e) {
        console.log(
            `Failed to kick off deletion of stack: ${stackName}. ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}

// ---------------------------------------------------------------------------
// S3 buckets
// ---------------------------------------------------------------------------

const emptyAndDeleteBucket = async (bucketName: string): Promise<void> => {
    // Delete current objects
    let continuationToken: string | undefined;
    do {
        const listResponse: ListObjectsV2CommandOutput = await s3Client.send(
            new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: continuationToken,
            }),
        );
        const toDelete: ObjectIdentifier[] =
            listResponse.Contents?.map((obj) => ({ Key: obj.Key })) ?? [];
        if (toDelete.length > 0) {
            await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: bucketName,
                    Delete: { Objects: toDelete },
                }),
            );
        }
        continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    // Delete versioned objects and delete markers
    let keyMarker: string | undefined;
    do {
        const versionsResponse = await s3Client.send(
            new ListObjectVersionsCommand({ Bucket: bucketName, KeyMarker: keyMarker }),
        );
        const toDelete: ObjectIdentifier[] = [
            ...(versionsResponse.DeleteMarkers?.map((m) => ({
                Key: m.Key,
                VersionId: m.VersionId,
            })) ?? []),
            ...(versionsResponse.Versions?.map((v) => ({
                Key: v.Key,
                VersionId: v.VersionId,
            })) ?? []),
        ];
        if (toDelete.length > 0) {
            await s3Client.send(
                new DeleteObjectsCommand({
                    Bucket: bucketName,
                    Delete: { Objects: toDelete },
                }),
            );
        }
        keyMarker = versionsResponse.NextKeyMarker;
    } while (keyMarker);

    await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
};

const listStaleBuckets = async (): Promise<Array<Bucket>> => {
    const response = await s3Client.send(new ListBucketsCommand({}));
    return (
        response.Buckets?.filter(
            (bucket) =>
                isStale(bucket.CreationDate) &&
                BUCKET_PREFIXES.some((prefix) => bucket.Name?.startsWith(prefix)),
        ) ?? []
    );
};

console.log("Cleaning up stale S3 buckets...");
const staleBuckets = await listStaleBuckets();
for (const bucket of staleBuckets) {
    const bucketName = bucket.Name;
    if (!bucketName) continue;
    try {
        await emptyAndDeleteBucket(bucketName);
        console.log(`Successfully deleted bucket: ${bucketName}`);
    } catch (e) {
        console.log(
            `Failed to delete bucket: ${bucketName}. ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}

// ---------------------------------------------------------------------------
// Cognito user pools
// ---------------------------------------------------------------------------

const listStaleCognitoUserPools = async (): Promise<Array<UserPoolDescriptionType>> => {
    let nextToken: string | undefined;
    const results: Array<UserPoolDescriptionType> = [];
    do {
        const response: ListUserPoolsCommandOutput = await cognitoClient.send(
            new ListUserPoolsCommand({ NextToken: nextToken, MaxResults: 60 }),
        );
        nextToken = response.NextToken;
        for (const pool of response.UserPools ?? []) {
            if (isStale(pool.CreationDate)) {
                results.push(pool);
            }
        }
    } while (nextToken);
    return results;
};

console.log("Cleaning up stale Cognito user pools...");
const staleUserPools = await listStaleCognitoUserPools();
for (const pool of staleUserPools) {
    if (!pool.Name || !pool.Id) continue;
    try {
        const describe = await cognitoClient.send(
            new DescribeUserPoolCommand({ UserPoolId: pool.Id }),
        );
        if (describe.UserPool?.Domain) {
            await cognitoClient.send(
                new DeleteUserPoolDomainCommand({
                    UserPoolId: pool.Id,
                    Domain: describe.UserPool.Domain,
                }),
            );
        }
        await cognitoClient.send(new DeleteUserPoolCommand({ UserPoolId: pool.Id }));
        console.log(`Successfully deleted Cognito user pool: ${pool.Name}`);
    } catch (e) {
        console.log(
            `Failed to delete Cognito user pool: ${pool.Name}. ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}

// ---------------------------------------------------------------------------
// SES email identities
// ---------------------------------------------------------------------------

const listStaleSesIdentities = async (): Promise<Array<IdentityInfo>> => {
    let nextToken: string | undefined;
    const results: Array<IdentityInfo> = [];
    do {
        const response: ListEmailIdentitiesCommandOutput = await sesClient.send(
            new ListEmailIdentitiesCommand({ NextToken: nextToken }),
        );
        nextToken = response.NextToken;
        // SES identities don't have a creation date in the list API;
        // include all identities that look like test resources (contain "overtone" or "amplify")
        for (const identity of response.EmailIdentities ?? []) {
            const name = identity.IdentityName ?? "";
            if (name.includes("overtone") || name.includes("amplify-test")) {
                results.push(identity);
            }
        }
    } while (nextToken);
    return results;
};

console.log("Cleaning up stale SES email identities...");
const staleSesIdentities = await listStaleSesIdentities();
for (const identity of staleSesIdentities) {
    const name = identity.IdentityName;
    if (!name) continue;
    try {
        await sesClient.send(new DeleteEmailIdentityCommand({ EmailIdentity: name }));
        console.log(`Successfully deleted SES identity: ${name}`);
    } catch (e) {
        console.log(
            `Failed to delete SES identity: ${name}. ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}

// ---------------------------------------------------------------------------
// IAM roles
// ---------------------------------------------------------------------------

const listStaleIamRoles = async (): Promise<Array<Role>> => {
    let marker: string | undefined;
    const results: Array<Role> = [];
    do {
        const response: ListRolesCommandOutput = await iamClient.send(
            new ListRolesCommand({ Marker: marker }),
        );
        marker = response.Marker;
        for (const role of response.Roles ?? []) {
            const matchesPrefix = IAM_ROLE_PREFIXES.some((prefix) =>
                role.RoleName?.startsWith(prefix),
            );
            if (matchesPrefix && isStale(role.CreateDate)) {
                results.push(role);
            }
        }
    } while (marker);
    return results;
};

console.log("Cleaning up stale IAM roles...");
const staleRoles = await listStaleIamRoles();
for (const role of staleRoles) {
    if (!role.RoleName) continue;
    try {
        // Delete inline policies
        const inlinePolicies: ListRolePoliciesCommandOutput = await iamClient.send(
            new ListRolePoliciesCommand({ RoleName: role.RoleName }),
        );
        for (const policyName of inlinePolicies.PolicyNames ?? []) {
            await iamClient.send(
                new DeleteRolePolicyCommand({
                    RoleName: role.RoleName,
                    PolicyName: policyName,
                }),
            );
        }
        // Detach managed policies
        const attachedPolicies: ListAttachedRolePoliciesCommandOutput = await iamClient.send(
            new ListAttachedRolePoliciesCommand({ RoleName: role.RoleName }),
        );
        for (const policy of attachedPolicies.AttachedPolicies ?? []) {
            await iamClient.send(
                new DetachRolePolicyCommand({
                    RoleName: role.RoleName,
                    PolicyArn: policy.PolicyArn,
                }),
            );
        }
        await iamClient.send(new DeleteRoleCommand({ RoleName: role.RoleName }));
        console.log(`Successfully deleted IAM role: ${role.RoleName}`);
    } catch (e) {
        console.log(
            `Failed to delete IAM role: ${role.RoleName}. ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}

// ---------------------------------------------------------------------------
// SSM parameters
// ---------------------------------------------------------------------------

const listStaleSSMParameters = async (): Promise<Array<ParameterMetadata>> => {
    const results: Array<ParameterMetadata> = [];
    for (const pathPrefix of SSM_PATH_PREFIXES) {
        let nextToken: string | undefined;
        do {
            const response: DescribeParametersCommandOutput = await ssmClient.send(
                new DescribeParametersCommand({
                    NextToken: nextToken,
                    MaxResults: 50,
                    ParameterFilters: [{ Key: "Name", Option: "BeginsWith", Values: [pathPrefix] }],
                }),
            );
            nextToken = response.NextToken;
            for (const param of response.Parameters ?? []) {
                if (isStale(param.LastModifiedDate)) {
                    results.push(param);
                }
            }
        } while (nextToken);
    }
    return results;
};

console.log("Cleaning up stale SSM parameters...");
const staleParams = await listStaleSSMParameters();
for (const param of staleParams) {
    if (!param.Name) continue;
    try {
        await ssmClient.send(new DeleteParameterCommand({ Name: param.Name }));
        console.log(`Successfully deleted SSM parameter: ${param.Name}`);
    } catch (e) {
        console.log(
            `Failed to delete SSM parameter: ${param.Name}. ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}

console.log("E2E resource cleanup complete.");
