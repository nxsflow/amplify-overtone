import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: {
        template: "%s | Amplify Overtone",
        default: "Amplify Overtone",
    },
    description:
        "Extend AWS Amplify Gen 2 with email, collaboration, notifications, local-first sync, and AI agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="dark" suppressHydrationWarning>
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Merriweather+Sans:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <RootProvider>{children}</RootProvider>
            </body>
        </html>
    );
}
