interface ThemeConfig {
    name: string;
    isDark: boolean;
    colors: {
        // Backgrounds
        backgroundPrimary: string;
        backgroundSecondary: string;
        backgroundHover: string;
        backgroundActive: string;

        // Text
        textPrimary: string;
        textSecondary: string;
        textDisabled: string;

        // Accents
        accentPrimary: string;
        accentHover: string;
        accentActive: string;

        // Borders
        borderPrimary: string;
        borderSecondary: string;

        // Shadows
        shadowPrimary: string;
        shadowSecondary: string;

        // Other
        error: string;
        success: string;
        warning: string;

        textTertiary: string;
    };
    typography: {
        fontFamily: string;
        fontSize: {
            small: string;
            medium: string;
            large: string;
            xlarge: string;
        };
        lineHeight: {
            small: string;
            medium: string;
            large: string;
            xlarge: string;
        };
        fontWeight: {
            normal: number;
            medium: number;
            bold: number;
            semibold: number;
        };
    };
    spacing: {
        xxsmall: string;
        xsmall: string;
        small: string;
        medium: string;
        large: string;
        xlarge: string;
        xxlarge: string;
    };
    borderRadius: {
        none: string;
        small: string;
        medium: string;
        large: string;
        full: string;
    };
    shadows: {
        none: string;
        small: string;
        medium: string;
        large: string;
        xlarge: string;
    };
    transitions: {
        duration: {
            fast: string;
            normal: string;
            slow: string;
        };
        easing: string;
    };
}

// Default Dracula theme configuration
const defaultDraculaTheme: ThemeConfig = {
    name: "Dracula",
    isDark: true,
    colors: {
        // Backgrounds
        backgroundPrimary: "#1e1e2e",
        backgroundSecondary: "#282a36",
        backgroundHover: "#2a2a3c",
        backgroundActive: "#343746",

        // Text
        textPrimary: "#e5e5e5",
        textSecondary: "#c0c0dd",
        textDisabled: "#626270",

        // Accents
        accentPrimary: "#f38ba8",
        accentHover: "#f76e94",
        accentActive: "#e05a7f",

        // Borders
        borderPrimary: "#3b3b4d",
        borderSecondary: "#4a4a5e",

        // Shadows
        shadowPrimary: "rgba(0, 0, 0, 0.5)",
        shadowSecondary: "rgba(0, 0, 0, 0.7)",

        // Other
        error: "#ff5555",
        success: "#50fa7b",
        warning: "#f1fa8c",

        textTertiary: "#6B7280",
    },
    typography: {
        fontFamily: '"Inter", "Arial", sans-serif',
        fontSize: {
            small: "12px",
            medium: "16px",
            large: "20px",
            xlarge: "24px",
        },
        lineHeight: {
            small: "1.4",
            medium: "1.6",
            large: "1.8",
            xlarge: "2",
        },
        fontWeight: {
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
        },
    },
    spacing: {
        xxsmall: "4px",
        xsmall: "8px",
        small: "12px",
        medium: "16px",
        large: "24px",
        xlarge: "32px",
        xxlarge: "48px",
    },
    borderRadius: {
        none: "0",
        small: "6px",
        medium: "12px",
        large: "16px",
        full: "9999px",
    },
    shadows: {
        none: "none",
        small: "0 2px 4px rgba(0, 0, 0, 0.3)",
        medium: "0 4px 20px rgba(0, 0, 0, 0.5)",
        large: "0 8px 30px rgba(0, 0, 0, 0.6)",
        xlarge: "0 12px 40px rgba(0, 0, 0, 0.7)",
    },
    transitions: {
        duration: {
            fast: "150ms",
            normal: "300ms",
            slow: "500ms",
        },
        easing: "ease-in-out",
    },
};

export const theme = defaultDraculaTheme;
