import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Markdown } from "fumadocs-core/content";
import defaultMdxComponents from "fumadocs-ui/mdx";

async function getReadmeContent(): Promise<string | null> {
    const readmePath = join(process.cwd(), "..", "..", "README.md");
    try {
        const raw = await readFile(readmePath, "utf-8");
        // Strip the first H1 line (# Amplify Overtone) since the hero handles it
        return raw.replace(/^# .+\n/, "");
    } catch {
        return null;
    }
}

export default async function HomePage() {
    const readme = await getReadmeContent();

    return (
        <main>
            {/* Hero */}
            <section
                style={{
                    textAlign: "center",
                    padding: "100px 24px 80px",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: "-200px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "800px",
                        height: "800px",
                        background:
                            "radial-gradient(circle, rgba(6,182,212,0.08) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)",
                        pointerEvents: "none",
                    }}
                />
                <h1
                    style={{
                        fontFamily: "Merriweather, Georgia, serif",
                        fontSize: "52px",
                        fontWeight: 700,
                        marginBottom: "24px",
                        position: "relative",
                    }}
                >
                    Amplify{" "}
                    <span
                        style={{
                            background: "linear-gradient(90deg, #06b6d4, #8b5cf6)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        Overtone
                    </span>
                </h1>
                <p
                    style={{
                        color: "hsl(var(--color-fd-muted-foreground))",
                        fontSize: "20px",
                        maxWidth: "640px",
                        margin: "0 auto 40px",
                        lineHeight: 1.6,
                    }}
                >
                    Extend AWS Amplify Gen 2 with email, collaboration, notifications, local-first
                    sync, and AI agents — declared in your schema, generated as infrastructure.
                </p>
                <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
                    <a
                        href="/docs/getting-started"
                        style={{
                            display: "inline-flex",
                            padding: "12px 28px",
                            background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                            color: "white",
                            fontWeight: 600,
                            fontSize: "15px",
                            borderRadius: "8px",
                            textDecoration: "none",
                        }}
                    >
                        Get Started
                    </a>
                    <a
                        href="https://github.com/nxsflow/amplify-overtone"
                        style={{
                            display: "inline-flex",
                            padding: "12px 28px",
                            background: "transparent",
                            color: "hsl(var(--color-fd-foreground))",
                            fontWeight: 600,
                            fontSize: "15px",
                            border: "1px solid hsl(var(--color-fd-border))",
                            borderRadius: "8px",
                            textDecoration: "none",
                        }}
                    >
                        View on GitHub
                    </a>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "12px",
                        margin: "32px auto 0",
                        padding: "14px 24px",
                        maxWidth: "480px",
                        background: "hsl(var(--color-fd-secondary))",
                        border: "1px solid hsl(var(--color-fd-border))",
                        borderRadius: "10px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "14px",
                    }}
                >
                    <span style={{ opacity: 0.5 }}>$</span>
                    <code style={{ color: "#06b6d4" }}>pnpm add @nxsflow/amplify-overtone</code>
                </div>
            </section>

            {/* README content */}
            {readme && (
                <section
                    style={{
                        maxWidth: "800px",
                        margin: "0 auto",
                        padding: "0 24px 80px",
                    }}
                    className="prose"
                >
                    <Markdown components={defaultMdxComponents}>{readme}</Markdown>
                </section>
            )}
        </main>
    );
}
