"use client";

import { useCallback, useState } from "react";

interface CopyMdButtonProps {
    mdPath: string;
}

export function CopyMdButton({ mdPath }: CopyMdButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        const url = `${window.location.origin}${mdPath}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [mdPath]);

    return (
        <button
            type="button"
            onClick={handleCopy}
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
        >
            {copied ? "Copied!" : "Copy .md link"}
        </button>
    );
}
