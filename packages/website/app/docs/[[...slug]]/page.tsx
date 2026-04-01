import { source } from "@/lib/source";
import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";

interface PageProps {
    params: Promise<{ slug?: string[] }>;
}

export default async function Page(props: PageProps) {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();

    const MDX = page.data.body;

    return (
        <DocsPage toc={page.data.toc} full={page.data.full}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "8px",
                }}
            >
                <DocsTitle>{page.data.title}</DocsTitle>
                <CopyMdButton slug={params.slug} />
            </div>
            <DocsDescription>{page.data.description}</DocsDescription>
            <DocsBody>
                <MDX
                    components={getMDXComponents({
                        a: createRelativeLink(source, page),
                    })}
                />
            </DocsBody>
        </DocsPage>
    );
}

function CopyMdButton({ slug }: { slug?: string[] }) {
    const mdPath = `/docs/${(slug ?? []).join("/")}.md`;
    return (
        <button
            type="button"
            data-copy-md={mdPath}
            style={{
                padding: "4px 12px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
                background: "hsl(var(--color-fd-secondary))",
                border: "1px solid hsl(var(--color-fd-border))",
                borderRadius: "6px",
                color: "hsl(var(--color-fd-muted-foreground))",
                cursor: "pointer",
                whiteSpace: "nowrap",
            }}
            onClick={undefined}
        >
            Copy .md link
        </button>
    );
}

export async function generateStaticParams() {
    return source.generateParams();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();
    return {
        title: page.data.title,
        description: page.data.description,
    };
}
