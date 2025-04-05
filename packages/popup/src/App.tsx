// packages/popup/src/App.tsx
import logo from "./assets/logo.svg";
import { theme } from "@shared"; // Import the theme object
import "./App.css"; // Keep for any non-theme related base styles if needed

function App() {
    // --- Helper function for conditional dark mode class (optional) ---
    // This helps if you have global dark mode styles or need to toggle
    const themeModeClass = theme.isDark ? "dark" : "light";

    return (
        <div
            // Apply theme styles directly using the style prop
            // Also add the theme mode class for potential global overrides
            className={`AppContainer ${themeModeClass}`} // Use a base container class + theme mode
            style={{
                backgroundColor: theme.colors.backgroundPrimary,
                color: theme.colors.textPrimary,
                fontFamily: theme.typography.fontFamily,
                padding: theme.spacing.large, // Use 'large' for 'lg' spacing
                // Mimic flex layout with CSS (or keep flex classes if Tailwind base is imported)
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                textAlign: "center",
                // Mimic space-y-md (adjust gap value as needed)
                gap: theme.spacing.medium, // Use 'medium' for 'md' spacing
            }}
        >
            {/* Logo */}
            <img
                src={logo}
                alt="Extension Logo"
                style={{ width: "64px", height: "64px" }} // Equivalent to w-16, h-16
            />

            {/* Title */}
            <h1
                style={{
                    fontSize: theme.typography.fontSize.xlarge, // Use xlarge for text-xl
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.accentPrimary,
                }}
            >
                ChatGPT Extension
            </h1>

            {/* Brief Description */}
            <p
                style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.typography.fontSize.small, // Use small for text-sm
                }}
            >
                Your enhancement tools are ready!
            </p>

            {/* Core Instruction */}
            <div
                style={{
                    backgroundColor: theme.colors.backgroundSecondary,
                    padding: theme.spacing.medium, // Use 'medium' for 'md' padding
                    borderRadius: theme.borderRadius.medium, // Use medium for rounded-base (adjust if needed)
                    border: `1px solid ${theme.colors.borderSecondary}`,
                    width: "100%",
                    maxWidth: "24rem", // Equivalent to max-w-sm
                    boxShadow: theme.shadows.small, // Use a theme shadow (e.g., small)
                }}
            >
                <p
                    style={{
                        color: theme.colors.textPrimary,
                        fontWeight: theme.typography.fontWeight.medium,
                        marginBottom: theme.spacing.small, // Use 'small' for 'sm' margin
                        fontSize: theme.typography.fontSize.medium, // Use 'medium' for 'text-base'
                    }}
                >
                    How to Access Tools:
                </p>
                <p
                    style={{
                        color: theme.colors.textSecondary,
                        fontSize: theme.typography.fontSize.small, // Use 'small' for 'text-sm'
                        marginBottom: theme.spacing.medium, // Use 'medium' for 'md' margin
                    }}
                >
                    While on{" "}
                    <code
                        style={{
                            color: theme.colors.accentPrimary,
                            fontSize: theme.typography.fontSize.small, // Use 'small' for 'text-xs'
                            backgroundColor: theme.colors.backgroundActive,
                            paddingLeft: theme.spacing.xsmall, // px-1 equivalent
                            paddingRight: theme.spacing.xsmall, // px-1 equivalent
                            borderRadius: theme.borderRadius.small, // rounded-sm equivalent
                        }}
                    >
                        chatgpt.com
                    </code>
                    , press the following keys together:
                </p>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: theme.spacing.xsmall, // Use 'xsmall' for 'xs' gap
                    }}
                >
                    <kbd
                        style={{
                            display: "inline-block",
                            padding: `${theme.spacing.xxsmall} ${theme.spacing.xsmall}`, // py-1 px-2
                            fontSize: theme.typography.fontSize.small, // text-sm
                            fontWeight: theme.typography.fontWeight.semibold,
                            color: theme.colors.accentPrimary,
                            backgroundColor: theme.colors.backgroundActive,
                            border: `1px solid ${theme.colors.borderPrimary}`,
                            borderRadius: theme.borderRadius.small, // rounded-sm
                            boxShadow: theme.shadows.small, // shadow-sm
                        }}
                    >
                        CTRL
                    </kbd>
                    <span
                        style={{
                            color: theme.colors.textSecondary,
                            fontWeight: theme.typography.fontWeight.bold,
                            fontSize: theme.typography.fontSize.large, // text-lg
                            marginLeft: theme.spacing.xsmall, // mx-xs
                            marginRight: theme.spacing.xsmall, // mx-xs
                        }}
                    >
                        +
                    </span>
                    <kbd
                         style={{
                            display: "inline-block",
                            padding: `${theme.spacing.xxsmall} ${theme.spacing.xsmall}`, // py-1 px-2
                            fontSize: theme.typography.fontSize.small, // text-sm
                            fontWeight: theme.typography.fontWeight.semibold,
                            color: theme.colors.accentPrimary,
                            backgroundColor: theme.colors.backgroundActive,
                            border: `1px solid ${theme.colors.borderPrimary}`,
                            borderRadius: theme.borderRadius.small, // rounded-sm
                            boxShadow: theme.shadows.small, // shadow-sm
                        }}
                    >
                        G
                    </kbd>
                </div>
            </div>

            {/* Footer Hint */}
            <p
                style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.typography.fontSize.small, // text-xs approx
                    paddingTop: theme.spacing.small, // pt-sm
                    opacity: 0.8,
                }}
            >
                You can close this popup. The main window opens directly on the
                page.
            </p>
        </div>
    );
}

export default App;
