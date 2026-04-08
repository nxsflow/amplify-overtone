import {
    AlreadyExistsException,
    CreateEmailIdentityCommand,
    DeleteEmailIdentityCommand,
    NotFoundException,
    SESv2Client,
} from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({});

interface CfnEvent {
    RequestType: "Create" | "Update" | "Delete";
    ResourceProperties: { Email: string; ServiceToken: string };
    OldResourceProperties?: { Email: string; ServiceToken: string };
    PhysicalResourceId?: string;
}

interface CfnResponse {
    PhysicalResourceId: string;
    Data?: Record<string, string>;
}

function makePhysicalId(email: string, preExisted: boolean): string {
    return `ses-identity:${email}:${preExisted ? "preexisted" : "created"}`;
}

function parsePhysicalId(physicalId: string): { email: string; preExisted: boolean } {
    const parts = physicalId.split(":");
    return { email: parts[1] ?? "", preExisted: parts[2] === "preexisted" };
}

export const handler = async (event: CfnEvent): Promise<CfnResponse> => {
    const email = event.ResourceProperties.Email;

    switch (event.RequestType) {
        case "Create": {
            let preExisted = false;
            try {
                await ses.send(new CreateEmailIdentityCommand({ EmailIdentity: email }));
            } catch (error) {
                if (error instanceof AlreadyExistsException) {
                    preExisted = true;
                } else {
                    throw error;
                }
            }
            console.log(`Create: ${email}, preExisted=${preExisted}`);
            return { PhysicalResourceId: makePhysicalId(email, preExisted) };
        }

        case "Update": {
            const oldEmail = event.OldResourceProperties?.Email;
            if (oldEmail !== email) {
                // Email changed → new physical ID triggers replacement (Create new + Delete old)
                let preExisted = false;
                try {
                    await ses.send(new CreateEmailIdentityCommand({ EmailIdentity: email }));
                } catch (error) {
                    if (error instanceof AlreadyExistsException) {
                        preExisted = true;
                    } else {
                        throw error;
                    }
                }
                console.log(`Update (replacement): ${email}, preExisted=${preExisted}`);
                return { PhysicalResourceId: makePhysicalId(email, preExisted) };
            }
            // Email unchanged → ensure identity still exists (handles drift)
            try {
                await ses.send(new CreateEmailIdentityCommand({ EmailIdentity: email }));
                console.log(`Update (re-created after drift): ${email}`);
            } catch (error) {
                if (error instanceof AlreadyExistsException) {
                    console.log(`Update (no-op, identity exists): ${email}`);
                } else {
                    throw error;
                }
            }
            return { PhysicalResourceId: event.PhysicalResourceId! };
        }

        case "Delete": {
            const { email: identityEmail, preExisted } = parsePhysicalId(event.PhysicalResourceId!);
            if (preExisted) {
                console.log(`Skipping delete: ${identityEmail} pre-existed before stack creation`);
                return { PhysicalResourceId: event.PhysicalResourceId! };
            }
            try {
                await ses.send(new DeleteEmailIdentityCommand({ EmailIdentity: identityEmail }));
                console.log(`Deleted SES identity: ${identityEmail}`);
            } catch (error) {
                if (error instanceof NotFoundException) {
                    console.log(`Identity ${identityEmail} already deleted`);
                } else {
                    throw error;
                }
            }
            return { PhysicalResourceId: event.PhysicalResourceId! };
        }
    }
};
