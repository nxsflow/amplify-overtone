import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

function TuningForkIcon() {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 260 260"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <defs>
                <clipPath id="nav-rb1">
                    <rect x="-42" y="8" width="32" height="26" />
                </clipPath>
                <clipPath id="nav-rb2">
                    <rect x="-38" y="20" width="55" height="38" />
                </clipPath>
                <clipPath id="nav-rb3">
                    <rect x="15" y="8" width="30" height="48" />
                </clipPath>
            </defs>
            <g transform="translate(130, 130)">
                <path clipPath="url(#nav-rb1)" d="M-27,12 C-27,24 -22,38 -6,42 C6,45 22,40 28,26 C30,18 28,12 28,12" stroke="#A78BFA" strokeWidth="28" fill="none" strokeLinecap="round"/>
                <path clipPath="url(#nav-rb2)" d="M-27,12 C-27,24 -22,38 -6,42 C6,45 22,40 28,26 C30,18 28,12 28,12" stroke="#A78BFA" strokeWidth="28" fill="none" strokeLinecap="round"/>
                <path clipPath="url(#nav-rb3)" d="M-27,12 C-27,24 -22,38 -6,42 C6,45 22,40 28,26 C30,18 28,12 28,12" stroke="#A78BFA" strokeWidth="28" fill="none" strokeLinecap="round"/>
            </g>
            <g transform="translate(131, 130)">
                <path d="M27,-90 C28,-72 27,-50 28,-28 C29,-12 28,3 28,12" stroke="#A78BFA" strokeWidth="28" strokeLinecap="round" fill="none"/>
            </g>
            <g transform="translate(130, 130)">
                <path d="M-27,-91 C-28,-70 -29,-48 -27,-28 C-26,-14 -27,2 -27,12" stroke="#A78BFA" strokeWidth="28" strokeLinecap="round" fill="none"/>
                <path d="M0,43 C1,60 -1,74 0,82 C1,90 0,100 0,102" stroke="#A78BFA" strokeWidth="28" strokeLinecap="round" fill="none"/>
            </g>
        </svg>
    );
}

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: (
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                    }}
                >
                    <TuningForkIcon />
                    Amplify{" "}
                    <span
                        style={{
                            background: "linear-gradient(135deg, #A78BFA, #F472B6)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        Overtone
                    </span>
                </span>
            ),
        },
        links: [{ text: "Docs", url: "/docs", active: "nested-url" }],
        githubUrl: "https://github.com/nxsflow/amplify-overtone",
    };
}
