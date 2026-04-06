import { compileSubject } from "./subject-compiler.js";
import type {
    ArgumentsDef,
    AuthorizationAllow,
    AuthRule,
    CompiledEmailAction,
    EmailActionBuilder,
    EmailActionConfig,
    ReturnTypeDef,
} from "./types.js";

const defaultReturnType: ReturnTypeDef = {
    messageId: { typeName: "String", required: false, isList: false },
};

const allow: AuthorizationAllow = {
    authenticated: () => ({ strategy: "authenticated" }),
    owner: () => ({ strategy: "owner" }),
    publicApiKey: () => ({ strategy: "public", provider: "apiKey" }),
    groups: (groups: string[]) => ({ strategy: "group", groups }),
};

class EmailActionBuilderImpl implements EmailActionBuilder {
    constructor(
        private readonly config: EmailActionConfig,
        private readonly _arguments: ArgumentsDef = {},
        private readonly _returnType: ReturnTypeDef = defaultReturnType,
        private readonly _authRules: AuthRule[] = [],
    ) {}

    arguments(args: ArgumentsDef): EmailActionBuilder {
        return new EmailActionBuilderImpl(this.config, args, this._returnType, this._authRules);
    }

    returns(returnType: ReturnTypeDef): EmailActionBuilder {
        return new EmailActionBuilderImpl(
            this.config,
            this._arguments,
            returnType,
            this._authRules,
        );
    }

    authorization(
        callback: (allow: AuthorizationAllow) => AuthRule | AuthRule[],
    ): EmailActionBuilder {
        const result = callback(allow);
        const rules = Array.isArray(result) ? result : [result];
        return new EmailActionBuilderImpl(this.config, this._arguments, this._returnType, rules);
    }

    _compile(name: string): CompiledEmailAction {
        return {
            name,
            config: this.config,
            subjectTemplate: compileSubject(this.config.subject),
            arguments: this._arguments,
            returnType: this._returnType,
            authRules: this._authRules,
        };
    }
}

export function emailAction(config: EmailActionConfig): EmailActionBuilder {
    return new EmailActionBuilderImpl(config);
}
