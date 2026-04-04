import type { Metadata } from "next";
import "./global.css";

export const metadata: Metadata = {
    title: "Amplify Overtone — Email Templates",
    description: "Preview and send built-in email templates",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body style={{ fontFamily: "'Merriweather Sans', sans-serif" }}>{children}</body>
        </html>
    );
}
