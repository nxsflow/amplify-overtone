import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import StaticSearchDialog from "@/components/search-dialog";

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
        <html lang="en" suppressHydrationWarning>
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Merriweather+Sans:wght@300;400;700&family=JetBrains+Mono:wght@400;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <RootProvider
                    theme={{ defaultTheme: "light", forcedTheme: "light" }}
                    search={{ SearchDialog: StaticSearchDialog }}
                >
                    {children}
                </RootProvider>
            </body>
        </html>
    );
}
