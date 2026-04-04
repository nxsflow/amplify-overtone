"use client";

import { useState } from "react";
import { sendTemplateEmail } from "./actions";

type EmailTemplateName = "confirmation-code" | "password-reset" | "invite" | "getting-started";

interface TemplateButton {
    template: EmailTemplateName;
    label: string;
    description: string;
}

const templates: TemplateButton[] = [
    {
        template: "confirmation-code",
        label: "Confirmation Code",
        description: "Sends a 6-digit verification code",
    },
    {
        template: "password-reset",
        label: "Password Reset",
        description: "Sends a password reset link",
    },
    {
        template: "invite",
        label: "Invite",
        description: "Sends a collaboration invite",
    },
    {
        template: "getting-started",
        label: "Getting Started",
        description: "Sends a welcome onboarding email",
    },
];

export default function Home() {
    const [status, setStatus] = useState<Record<string, string>>({});
    const [sending, setSending] = useState<Record<string, boolean>>({});

    async function handleSend(template: EmailTemplateName) {
        setSending((prev) => ({ ...prev, [template]: true }));
        setStatus((prev) => ({ ...prev, [template]: "" }));

        const result = await sendTemplateEmail(template);

        if (result.success) {
            setStatus((prev) => ({ ...prev, [template]: `Sent (${result.messageId})` }));
        } else {
            setStatus((prev) => ({ ...prev, [template]: `Error: ${result.error}` }));
        }

        setSending((prev) => ({ ...prev, [template]: false }));
    }

    return (
        <main className="min-h-screen bg-white flex items-center justify-center p-8">
            <div className="max-w-xl w-full">
                <h1
                    className="text-3xl font-bold text-center mb-2"
                    style={{
                        fontFamily: "'Merriweather', serif",
                        background: "linear-gradient(135deg, #A78BFA, #F472B6)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Email Templates
                </h1>
                <p className="text-center mb-8" style={{ color: "#6B6B6B" }}>
                    Send a test email to carsten.koch+overtone@hey.com
                </p>

                <div className="grid gap-4">
                    {templates.map(({ template, label, description }) => (
                        <div
                            key={template}
                            className="rounded-lg p-4 flex items-center justify-between"
                            style={{ border: "1px solid #E5E5E0" }}
                        >
                            <div>
                                <h2
                                    className="font-semibold text-base"
                                    style={{
                                        color: "#1C1C1C",
                                        fontFamily: "'Merriweather', serif",
                                    }}
                                >
                                    {label}
                                </h2>
                                <p className="text-sm" style={{ color: "#6B6B6B" }}>
                                    {description}
                                </p>
                                {status[template] && (
                                    <p
                                        className="text-xs mt-1"
                                        style={{
                                            color: status[template].startsWith("Error")
                                                ? "#ef4444"
                                                : "#A78BFA",
                                        }}
                                    >
                                        {status[template]}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSend(template)}
                                disabled={sending[template]}
                                className="px-4 py-2 rounded-md text-white text-sm font-medium transition-opacity disabled:opacity-50"
                                style={{
                                    background: "linear-gradient(135deg, #A78BFA, #F472B6)",
                                    cursor: sending[template] ? "not-allowed" : "pointer",
                                }}
                            >
                                {sending[template] ? "Sending..." : "Send"}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
