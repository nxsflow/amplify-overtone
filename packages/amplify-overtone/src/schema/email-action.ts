import { compileTemplateField } from "./template-compiler.js";
import type {
    ArgumentsDef,
    AuthorizationAllow,
    AuthRule,
    CompiledEmailAction,
    CompiledTemplate,
    EmailActionBuilder,
    EmailActionConfig,
    EmailTemplateInput,
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
        private readonly _template: EmailTemplateInput | undefined = undefined,
        private readonly _returnType: ReturnTypeDef = defaultReturnType,
        private readonly _authRules: AuthRule[] = [],
    ) {}

    arguments(args: ArgumentsDef): EmailActionBuilder {
        return new EmailActionBuilderImpl(this.config, args, this._template, this._returnType, this._authRules);
    }

    template(def: EmailTemplateInput): EmailActionBuilder {
        return new EmailActionBuilderImpl(this.config, this._arguments, def, this._returnType, this._authRules);
    }

    returns(returnType: ReturnTypeDef): EmailActionBuilder {
        return new EmailActionBuilderImpl(this.config, this._arguments, this._template, returnType, this._authRules);
    }

    authorization(callback: (allow: AuthorizationAllow) => AuthRule | AuthRule[]): EmailActionBuilder {
        const result = callback(allow);
        const rules = Array.isArray(result) ? result : [result];
        return new EmailActionBuilderImpl(this.config, this._arguments, this._template, this._returnType, rules);
    }

    _compile(name: string): CompiledEmailAction {
        let compiledTemplate: CompiledTemplate | undefined;

        if (this._template) {
            compiledTemplate = {
                subject: compileTemplateField(this._template.subject, this._arguments),
                header: compileTemplateField(this._template.header, this._arguments),
                body: compileTemplateField(this._template.body, this._arguments),
            };
            if (this._template.callToAction) {
                compiledTemplate.callToAction = {
                    label: compileTemplateField(this._template.callToAction.label, this._arguments),
                    href: compileTemplateField(this._template.callToAction.href, this._arguments),
                };
            }
            if (this._template.footer) {
                compiledTemplate.footer = compileTemplateField(this._template.footer, this._arguments);
            }
        }

        return {
            name,
            config: this.config,
            compiledTemplate,
            arguments: this._arguments,
            returnType: this._returnType,
            authRules: this._authRules,
        };
    }
}

export function emailAction(config: EmailActionConfig): EmailActionBuilder {
    return new EmailActionBuilderImpl(config);
}
