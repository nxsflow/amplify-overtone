export interface TemplateDefinition {
    /** Default subject line for this template. */
    subject: string;
    /** Render the HTML body. All data values are pre-escaped. */
    renderHtml: (data: Record<string, string>, brandName: string) => string;
    /** Render the plain-text body. */
    renderText: (data: Record<string, string>, brandName: string) => string;
}
