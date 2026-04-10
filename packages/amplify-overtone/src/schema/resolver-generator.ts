import type { CompiledEmailAction } from "./types.js";

const COGNITO_FIELDS = [
    ["Name", "name"],
    ["Email", "email"],
    ["GivenName", "givenName"],
    ["FamilyName", "familyName"],
] as const;

/** Check if any arguments have resolveType (need pipeline resolver). */
export function hasUserIdArgs(action: CompiledEmailAction): boolean {
    return Object.values(action.arguments).some((def) => def.resolveType === "cognitoUser");
}

/**
 * Converts `{{variable}}` placeholders into JS string concatenation.
 * The `varsObj` parameter is the JS variable name holding the flat args map.
 */
function interpolationExpr(template: string, varsObj: string): string {
    const parts = template.split(/(\{\{[^}]+\}\})/g);
    const jsFragments = parts.map((part) => {
        const match = part.match(/^\{\{([^}]+)\}\}$/);
        if (match) {
            return `(${varsObj}.${match[1]} != null ? String(${varsObj}.${match[1]}) : '')`;
        }
        return JSON.stringify(part);
    });
    return jsFragments.join(" + ");
}

/**
 * Pipeline function 1: Invoke user-lookup Lambda with userId args.
 */
export function generateUserLookupCode(action: CompiledEmailAction): string {
    const userIdEntries = Object.entries(action.arguments)
        .filter(([, def]) => def.resolveType === "cognitoUser")
        .map(([name]) => `      ${name}: ctx.args.${name},`);

    return `
export function request(ctx) {
  return {
    operation: 'Invoke',
    payload: {
      userIdArgs: {
${userIdEntries.join("\n")}
      },
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    return util.error(ctx.error.message, ctx.error.type);
  }
  ctx.stash.resolvedUsers = ctx.result;
  return {};
}
`.trim();
}

/**
 * Pipeline function 2 (with userId args): Flatten resolved users + plain args,
 * interpolate template, invoke email Lambda.
 *
 * Also used as a single-function resolver when no userId args exist.
 */
export function generateEmailInvokeCode(action: CompiledEmailAction): string {
    const sender = action.config.sender ? JSON.stringify(action.config.sender) : "undefined";
    const template = action.compiledTemplate;

    if (!template) {
        throw new Error(`Email action "${action.name}" has no .template() definition.`);
    }

    const hasUserIds = hasUserIdArgs(action);
    const hasRecipientUserId = action.arguments.recipient?.resolveType === "cognitoUser";

    // Build the args flattening code
    let flattenBlock: string;
    if (hasUserIds) {
        const flattenLines: string[] = [];
        for (const [name, def] of Object.entries(action.arguments)) {
            if (def.resolveType !== "cognitoUser") {
                flattenLines.push(`  vars.${name} = ctx.args.${name};`);
            }
        }
        flattenLines.push("  const resolved = ctx.stash.resolvedUsers || {};");
        for (const [name, def] of Object.entries(action.arguments)) {
            if (def.resolveType === "cognitoUser") {
                flattenLines.push(`  const ${name} = resolved.${name} || {};`);
                for (const [suffix, attr] of COGNITO_FIELDS) {
                    flattenLines.push(`  vars.${name}${suffix} = ${name}.${attr} || '';`);
                }
            }
        }
        flattenBlock = flattenLines.join("\n");
    } else {
        const lines = Object.keys(action.arguments).map(
            (name) => `  vars.${name} = ctx.args.${name};`,
        );
        flattenBlock = lines.join("\n");
    }

    let toExpr: string;
    if (hasRecipientUserId) {
        toExpr = "vars.recipientEmail";
    } else {
        toExpr = "ctx.args.recipientEmail";
    }

    const subjectExpr = interpolationExpr(template.subject, "vars");
    const headerExpr = interpolationExpr(template.header, "vars");
    const bodyExpr = interpolationExpr(template.body, "vars");

    let ctaBlock = "";
    if (template.callToAction) {
        const labelExpr = interpolationExpr(template.callToAction.label, "vars");
        const hrefExpr = interpolationExpr(template.callToAction.href, "vars");
        ctaBlock = `
      callToAction: {
        label: ${labelExpr},
        href: ${hrefExpr},
      },`;
    }

    let footerLine = "";
    if (template.footer) {
        const footerExpr = interpolationExpr(template.footer, "vars");
        footerLine = `
      footer: ${footerExpr},`;
    }

    return `
export function request(ctx) {
  const vars = {};
${flattenBlock}

  return {
    operation: 'Invoke',
    payload: {
      to: ${toExpr},
      sender: ${sender},
      subject: ${subjectExpr},
      header: ${headerExpr},
      body: ${bodyExpr},${ctaBlock}${footerLine}
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    return util.error(ctx.error.message, ctx.error.type);
  }
  const result = ctx.result;
  return {
    messageId: result.messageId || null,
  };
}
`.trim();
}
