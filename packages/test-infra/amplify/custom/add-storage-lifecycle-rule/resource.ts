import { Bucket, type CfnBucket, type IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

interface AddLifeCycleRuleProps {
    s3Bucket: IBucket;
    expirationInDays?: number;
    prefix?: string;
}

export class AddLifeCycleRule extends Construct {
    constructor(scope: Construct, id: string, props: AddLifeCycleRuleProps) {
        super(scope, id);
        if (!(props.s3Bucket instanceof Bucket))
            throw new Error("bucket is not an instance of Bucket");

        const cfnBucket = props.s3Bucket.node.defaultChild as CfnBucket;
        cfnBucket.addOverride("Properties.LifecycleConfiguration", {
            Rules: [
                {
                    Id: "expire-cache-in-7-days",
                    Status: "Enabled",

                    ExpirationInDays: props.expirationInDays ?? 90,
                    ...(!props.prefix ? {} : { Prefix: props.prefix }),
                },
            ],
        });
    }
}
