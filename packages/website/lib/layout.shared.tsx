import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: (
                <span
                    style={{
                        fontFamily: "Merriweather, Georgia, serif",
                        fontWeight: 700,
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
                </span>
            ),
        },
        themeSwitch: false,
        links: [{ text: "Docs", url: "/docs", active: "nested-url" }],
        githubUrl: "https://github.com/nxsflow/amplify-overtone",
    };
}
