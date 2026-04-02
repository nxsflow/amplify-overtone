import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Markdown } from "fumadocs-core/content";
import defaultMdxComponents from "fumadocs-ui/mdx";
import remarkGfm from "remark-gfm";

const categories = [
    { name: "Email", icon: "✉️", status: "In Progress" as const },
    { name: "Collaboration", icon: "🤝", status: "Planned" as const },
    { name: "Local-First", icon: "📡", status: "Planned" as const },
    { name: "Notifications", icon: "🔔", status: "Planned" as const },
    { name: "Agent", icon: "🤖", status: "Planned" as const },
];

interface ReadmeSections {
    before: string;
    categories: { name: string; icon: string; status: "In Progress" | "Planned"; body: string }[];
    after: string;
}

function parseReadme(raw: string): ReadmeSections {
    const withoutTitle = raw.replace(/^# .+\n/, "");

    // Find the ## Roadmap section
    const roadmapStart = withoutTitle.indexOf("## Roadmap");
    if (roadmapStart === -1) {
        return { before: withoutTitle, categories: [], after: "" };
    }

    // Find the next ## heading after Roadmap (the section after all ### categories)
    const afterRoadmap = withoutTitle.slice(roadmapStart + "## Roadmap".length);
    const nextH2Match = afterRoadmap.match(/\n## /);
    const roadmapContent = nextH2Match ? afterRoadmap.slice(0, nextH2Match.index) : afterRoadmap;
    const afterContent = nextH2Match
        ? afterRoadmap.slice(nextH2Match.index! + 1) // +1 to skip the leading \n
        : "";

    // Extract each ### category from the roadmap
    const parsed = categories.map((cat) => {
        const heading = `### ${cat.name}`;
        const start = roadmapContent.indexOf(heading);
        if (start === -1) return { ...cat, body: "" };

        const rest = roadmapContent.slice(start + heading.length);
        const nextH3 = rest.match(/\n### /);
        const body = (nextH3 ? rest.slice(0, nextH3.index) : rest).trim();
        return { ...cat, body };
    });

    return {
        before: withoutTitle.slice(0, roadmapStart).trim(),
        categories: parsed,
        after: afterContent.trim(),
    };
}

async function getReadmeContent(): Promise<ReadmeSections | null> {
    const readmePath = join(process.cwd(), "..", "..", "README.md");
    try {
        const raw = await readFile(readmePath, "utf-8");
        return parseReadme(raw);
    } catch {
        return null;
    }
}

const mdxComponents = {
    ...defaultMdxComponents,
    img: (props: React.ComponentProps<"img">) => <img alt="" {...props} />,
};

function MarkdownSection({ children }: { children: string }) {
    return (
        <Markdown remarkPlugins={[remarkGfm]} components={mdxComponents}>
            {children}
        </Markdown>
    );
}

function CategoryCards({ items }: { items: ReadmeSections["categories"] }) {
    return (
        <section style={{ padding: "60px 24px", maxWidth: "1100px", margin: "0 auto" }}>
            <h2
                style={{
                    fontFamily: "Merriweather, Georgia, serif",
                    fontSize: "32px",
                    fontWeight: 700,
                    textAlign: "center",
                    marginBottom: "12px",
                }}
            >
                Roadmap
            </h2>
            <p
                style={{
                    textAlign: "center",
                    color: "hsl(var(--color-fd-muted-foreground))",
                    marginBottom: "48px",
                    fontSize: "17px",
                }}
            >
                Five categories every production app needs — built the Amplify way.
            </p>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "20px",
                }}
            >
                {items.slice(0, 3).map((cat) => (
                    <CategoryCard key={cat.name} {...cat} />
                ))}
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "20px",
                    marginTop: "20px",
                    maxWidth: "740px",
                    marginLeft: "auto",
                    marginRight: "auto",
                }}
            >
                {items.slice(3).map((cat) => (
                    <CategoryCard key={cat.name} {...cat} />
                ))}
            </div>
        </section>
    );
}

function CategoryCard({ name, icon, status, body }: ReadmeSections["categories"][number]) {
    const description = body.split("\n")[0] ?? "";

    return (
        <a
            href={`/docs/${name.toLowerCase()}`}
            style={{
                display: "block",
                background: "hsl(var(--color-fd-card))",
                border: "1px solid hsl(var(--color-fd-border))",
                borderRadius: "12px",
                padding: "28px",
                textDecoration: "none",
                color: "inherit",
                transition: "border-color 0.2s",
            }}
        >
            <div
                style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    marginBottom: "16px",
                    background: "rgba(6, 182, 212, 0.1)",
                }}
            >
                {icon}
            </div>
            <h3
                style={{
                    fontFamily: "Merriweather, Georgia, serif",
                    fontSize: "18px",
                    fontWeight: 700,
                    marginBottom: "8px",
                }}
            >
                {name}
            </h3>
            <p
                style={{
                    color: "hsl(var(--color-fd-muted-foreground))",
                    fontSize: "14px",
                    lineHeight: 1.6,
                }}
            >
                {description}
            </p>
            <span
                style={{
                    display: "inline-block",
                    marginTop: "12px",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    background:
                        status === "In Progress"
                            ? "rgba(6, 182, 212, 0.15)"
                            : "rgba(139, 92, 246, 0.15)",
                    color: status === "In Progress" ? "#06b6d4" : "#8b5cf6",
                }}
            >
                {status}
            </span>
        </a>
    );
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

            {readme && (
                <>
                    {/* Vision + Packages (before Roadmap) */}
                    {readme.before && (
                        <section
                            style={{
                                maxWidth: "800px",
                                margin: "0 auto",
                                padding: "0 24px 40px",
                            }}
                            className="prose"
                        >
                            <MarkdownSection>{readme.before}</MarkdownSection>
                        </section>
                    )}

                    {/* Roadmap as category cards */}
                    {readme.categories.length > 0 && <CategoryCards items={readme.categories} />}

                    {/* Getting Started, Contributing, License (after Roadmap) */}
                    {readme.after && (
                        <section
                            style={{
                                maxWidth: "800px",
                                margin: "0 auto",
                                padding: "0 24px 80px",
                            }}
                            className="prose"
                        >
                            <MarkdownSection>{readme.after}</MarkdownSection>
                        </section>
                    )}
                </>
            )}
        </main>
    );
}
