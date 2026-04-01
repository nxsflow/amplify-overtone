"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CopyMdButtonProps {
    mdPath: string;
}

export function CopyMdButton({ mdPath }: CopyMdButtonProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const showCopied = useCallback((label: string) => {
        setCopied(label);
        setOpen(false);
        setTimeout(() => setCopied(null), 2000);
    }, []);

    const copyLink = useCallback(async () => {
        const url = `${window.location.origin}${mdPath}`;
        await navigator.clipboard.writeText(url);
        showCopied("Link copied!");
    }, [mdPath, showCopied]);

    const copyContent = useCallback(async () => {
        const url = `${window.location.origin}${mdPath}`;
        const res = await fetch(url);
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        showCopied("Markdown copied!");
    }, [mdPath, showCopied]);

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button
                type="button"
                onClick={() => (copied ? null : setOpen(!open))}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 10px",
                    fontSize: "12px",
                    background: "transparent",
                    border: "1px solid hsl(var(--color-fd-border))",
                    borderRadius: "6px",
                    color: "hsl(var(--color-fd-muted-foreground))",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "color 0.15s, border-color 0.15s",
                }}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <title>Copy</title>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copied ?? ".md"}
                {!copied && (
                    <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <title>Expand</title>
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                )}
            </button>
            {open && (
                <div
                    style={{
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 4px)",
                        zIndex: 50,
                        minWidth: "160px",
                        padding: "4px",
                        background: "hsl(var(--color-fd-popover))",
                        border: "1px solid hsl(var(--color-fd-border))",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}
                >
                    <button
                        type="button"
                        onClick={copyLink}
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "6px 10px",
                            fontSize: "13px",
                            color: "hsl(var(--color-fd-foreground))",
                            background: "transparent",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "hsl(var(--color-fd-accent))";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                        }}
                    >
                        Copy .md link
                    </button>
                    <button
                        type="button"
                        onClick={copyContent}
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "6px 10px",
                            fontSize: "13px",
                            color: "hsl(var(--color-fd-foreground))",
                            background: "transparent",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "hsl(var(--color-fd-accent))";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                        }}
                    >
                        Copy markdown
                    </button>
                </div>
            )}
        </div>
    );
}
