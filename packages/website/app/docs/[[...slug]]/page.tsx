import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyMdButton } from "@/components/copy-md-button";
import { getMDXComponents } from "@/components/mdx";
import { source } from "@/lib/source";

interface PageProps {
    params: Promise<{ slug?: string[] }>;
}

export default async function Page(props: PageProps) {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();

    const MDX = page.data.body;

    return (
        <DocsPage toc={page.data.toc} full={page.data.full ?? false}>
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
                <CopyMdButton mdPath={`/docs/${(params.slug ?? []).join("/")}.md`} />
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

export async function generateStaticParams() {
    return [{ slug: [] }, ...source.generateParams()];
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
