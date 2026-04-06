import type { CompiledEmailAction } from "./types.js";

/**
 * Generates inline AppSync JS resolver code for an email action.
 *
 * The resolver:
 * 1. Builds a subject string by interpolating {{variable}} placeholders with args
 * 2. Constructs a SendEmailPayload from mutation arguments
 * 3. Injects built-in variables (__callerUserId, __callerEmail, __timestamp)
 * 4. Invokes the email Lambda via the data source
 */
export function generateResolverCode(action: CompiledEmailAction): string {
    const sender = JSON.stringify(action.config.sender);
    const template = JSON.stringify(action.config.template);
    const subjectTemplate = JSON.stringify(action.subjectTemplate);

    return `
export function request(ctx) {
  const args = ctx.args;

  // Interpolate subject template
  let subject = ${subjectTemplate};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      subject = subject.split('{{' + key + '}}').join(value);
    }
  }

  // Build template data from all arguments + built-in variables
  const data = {};
  for (const [key, value] of Object.entries(args)) {
    if (value != null) data[key] = String(value);
  }

  // Inject built-in variables
  const identity = ctx.identity || {};
  data.__callerUserId = identity.sub || '';
  data.__callerEmail = identity.claims?.email || '';
  data.__timestamp = new Date().toISOString();

  return {
    operation: 'Invoke',
    payload: {
      template: ${template},
      to: ctx.args.recipientEmail,
      sender: ${sender},
      subject: subject,
      data: data,
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
    status: result.messageId ? 'sent' : 'failed',
  };
}
`.trim();
}
